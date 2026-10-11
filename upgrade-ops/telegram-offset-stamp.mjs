#!/usr/bin/env node
// One-shot cutover helper for the 2026.2.16 -> 2026.10.1 fork upgrade (operator-run, Gateway stopped).
//
// Doctor imports the legacy Telegram update offset faithfully, but the migrated row has no bot
// identity (botId/tokenFingerprint = null). OpenClaw 2026.10.1 classifies such a row as
// "legacy-state" at account startup and discards the cursor, so the first poll would start without
// an offset. This helper stamps the identity that the runtime derives from the configured token
// (extensions/telegram/src/token-fingerprint.ts), so startup resumes at lastUpdateId + 1.
// It never prints the token or the fingerprint. A wrong stamp fails safe: the runtime then reports
// "token-rotated" and discards the cursor, which is the upstream default.
import { createHash } from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

function parseArgs(argv) {
  const args = { account: "default", dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = () => {
      const next = argv[i + 1];
      if (next === undefined) {
        throw new Error(`${flag} requires a value`);
      }
      i += 1;
      return next;
    };
    if (flag === "--state-dir") {
      args.stateDir = value();
    } else if (flag === "--config") {
      args.config = value();
    } else if (flag === "--account") {
      args.account = value();
    } else if (flag === "--expect-last-update-id") {
      args.expect = value();
    } else if (flag === "--dry-run") {
      args.dryRun = true;
    } else {
      throw new Error(`unknown argument: ${flag}`);
    }
  }
  return args;
}

export function telegramIdentityFromToken(token) {
  const trimmed = token.trim();
  const rawBotId = trimmed.split(":", 1)[0];
  if (!/^\d+$/.test(rawBotId) || !(Number(rawBotId) > 0)) {
    throw new Error("configured Telegram bot token has no numeric bot id prefix");
  }
  return {
    botId: String(Number(rawBotId)),
    tokenFingerprint: createHash("sha256").update(trimmed).digest("hex").slice(0, 16),
  };
}

function resolveBotToken(cfg, account) {
  const telegram = cfg?.channels?.telegram;
  const scoped = account === "default" ? telegram : telegram?.accounts?.[account];
  const token =
    scoped?.botToken ?? (account === "default" ? telegram?.accounts?.default?.botToken : undefined);
  if (typeof token !== "string" || !token.trim()) {
    throw new Error(
      `no plain-string botToken configured for Telegram account "${account}" (SecretRef/env tokens are not supported by this helper)`,
    );
  }
  return token;
}

function portIsListening(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port }, () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
    socket.setTimeout(1500, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const stateDir = path.resolve(args.stateDir ?? path.join(os.homedir(), ".openclaw"));
  const configPath = path.resolve(args.config ?? path.join(stateDir, "openclaw.json"));
  if (args.expect === undefined || !/^\d+$/.test(args.expect)) {
    throw new Error(
      "--expect-last-update-id <n> is required (the cursor captured after stopping the Gateway)",
    );
  }
  const expected = Number(args.expect);
  const cfg = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const gatewayPort = Number(cfg?.gateway?.port ?? 18789);
  if (await portIsListening(gatewayPort)) {
    throw new Error(
      `a Gateway is listening on 127.0.0.1:${gatewayPort}; stop it before stamping the offset`,
    );
  }
  const identity = telegramIdentityFromToken(resolveBotToken(cfg, args.account));
  const dbPath = path.join(stateDir, "state", "openclaw.sqlite");
  const db = new DatabaseSync(dbPath);
  try {
    db.exec("BEGIN IMMEDIATE");
    const row = db
      .prepare(
        "SELECT value_json FROM plugin_state_entries WHERE plugin_id = 'telegram' AND namespace = 'telegram.update-offsets' AND entry_key = ?",
      )
      .get(args.account);
    if (!row) {
      throw new Error(
        `no migrated Telegram offset row for account "${args.account}" (run Doctor first)`,
      );
    }
    const state = JSON.parse(row.value_json);
    const problems = [];
    if (state.version !== 3) {
      problems.push(`version ${state.version} (expected 3; run the 2026.10.1 Doctor first)`);
    }
    if (state.lastUpdateId !== expected) {
      problems.push(`lastUpdateId ${state.lastUpdateId} != expected ${expected}`);
    }
    if (state.botId !== null || state.tokenFingerprint !== null) {
      problems.push("identity already stamped");
    }
    if (problems.length > 0) {
      db.exec("ROLLBACK");
      throw new Error(`refusing to stamp: ${problems.join("; ")}`);
    }
    const next = { ...state, botId: identity.botId, tokenFingerprint: identity.tokenFingerprint };
    if (args.dryRun) {
      db.exec("ROLLBACK");
    } else {
      db.prepare(
        "UPDATE plugin_state_entries SET value_json = ? WHERE plugin_id = 'telegram' AND namespace = 'telegram.update-offsets' AND entry_key = ?",
      ).run(JSON.stringify(next), args.account);
      db.exec("COMMIT");
    }
    console.log(
      JSON.stringify({
        ok: true,
        dryRun: args.dryRun,
        account: args.account,
        lastUpdateId: state.lastUpdateId,
        resumesAtOffset: state.lastUpdateId + 1,
        stamped: !args.dryRun,
      }),
    );
  } finally {
    db.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }),
    );
    process.exit(1);
  });
}
