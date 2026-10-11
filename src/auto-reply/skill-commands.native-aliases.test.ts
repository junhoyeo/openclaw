import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../config/types.js";
import {
  buildCommandText,
  findCommandByNativeName,
  listNativeCommandNameOverrides,
  listNativeCommandSpecsForConfig,
} from "./commands-registry.js";
import {
  listReservedChatSlashCommandNames,
  listSkillCommandsForAgents,
  listSkillCommandsForWorkspace,
  resolveSkillCommandInvocation,
} from "./skill-commands.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("provider-specific native skill reservations", () => {
  it("reserves all provider-specific native aliases in the shared skill naming path", () => {
    const aliases = listNativeCommandNameOverrides();
    expect(aliases).toEqual(expect.arrayContaining(["voice", "export_session"]));
    const reserved = listReservedChatSlashCommandNames();
    for (const alias of aliases) {
      expect(reserved.has(alias.toLowerCase())).toBe(true);
    }
    expect(reserved.has("export-session")).toBe(true);
    expect(reserved.has("export")).toBe(true);
  });

  it.each(["export-session", "export_session"])(
    "keeps registration and text dispatch aligned for a %s skill",
    async (skillName) => {
      const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-skill-alias-"));
      tempDirs.push(workspaceDir);
      const skillDir = path.join(workspaceDir, "skills", skillName);
      await fs.mkdir(skillDir, { recursive: true });
      await fs.writeFile(
        path.join(skillDir, "SKILL.md"),
        `---\nname: ${skillName}\ndescription: Export collision regression skill\n---\n# Skill\n`,
      );
      const cfg: OpenClawConfig = {
        agents: { defaults: { workspace: workspaceDir } },
        skills: { allowBundled: [] },
      };
      const registrationSkills = listSkillCommandsForAgents({ cfg, agentIds: ["main"] });
      const dispatchSkills = listSkillCommandsForWorkspace({ workspaceDir, cfg });
      const registeredSkill = registrationSkills.find((skill) => skill.skillName === skillName);
      expect(registeredSkill?.name).toBe("export_session_2");
      expect(dispatchSkills.find((skill) => skill.skillName === skillName)?.name).toBe(
        registeredSkill?.name,
      );

      const native = listNativeCommandSpecsForConfig(cfg, {
        provider: "telegram",
        skillCommands: registrationSkills,
      });
      const names = native.map((command) => command.name);
      expect(names.filter((name) => name === "export_session")).toHaveLength(1);
      expect(names.filter((name) => name === "export_session_2")).toHaveLength(1);
      expect(new Set(names).size).toBe(names.length);
      expect(names.every((name) => /^[a-z0-9_]{1,32}$/.test(name))).toBe(true);
      expect(findCommandByNativeName("export_session", "telegram")?.key).toBe("export-session");
      expect(findCommandByNativeName("export_session_2", "telegram")).toBeUndefined();

      const invocation = resolveSkillCommandInvocation({
        commandBodyNormalized: buildCommandText("export_session_2", "run the skill"),
        skillCommands: dispatchSkills,
      });
      expect(invocation?.command.skillName).toBe(skillName);
      expect(invocation?.args).toBe("run the skill");
      expect(
        resolveSkillCommandInvocation({
          commandBodyNormalized: `/skill ${skillName} run the skill`,
          skillCommands: dispatchSkills,
        })?.command.skillName,
      ).toBe(skillName);
    },
  );
});
