# DELIVERY — junhoyeo/openclaw fork upgrade 2026.2.16 → upstream stable v2026.10.1

## Status (read this first)

- **Candidate:** built and tested. Worktree `/Users/junhoyeo/openclaw-worktrees/verify-upgrade-2026-10-1`, branch `chore/verify-upgrade-2026-10-1`, tip ``5a3c4e33baf` (runtime build) + the docs commit that adds this file` (CLI reports `OpenClaw 2026.10.1 (5a3c4e3)`).
- **One-hop cutover (swap symlink/service and start): BLOCKED by design.** Measured on an isolated copy of live state, the 2026.10.1 Doctor refuses with _"Config contains retired pre-July-2026 settings: channels.telegram.streamMode, channels.telegram.blockStreaming … Install OpenClaw 2026.9.5, run openclaw doctor --fix"_ (exit 1). Live state also holds the legacy cron JSON store and legacy Telegram JSON sidecars.
- **Validated migration path: READY FOR PARENT APPROVAL.** Published `openclaw@2026.9.5` Doctor → candidate 2026.10.1 Doctor → Telegram cursor identity stamp → service switch. Validated end-to-end on an isolated copy with exact preservation of cron jobs, schedules, and run history, the Telegram polling cursor, sessions, the Astra default model, and Prime skills. Nothing has been applied to live state. The parent alone executes the runbook below.
- **Live state, CLI, and service were not changed by this work.** Gateway PID 62938 has been running since before this task, the plist mtime is still Oct 11 13:36, and the CLI symlink is unchanged. Four incidents occurred and were reversed or are harmless; see "Incidents".

## Corrections to the preliminary DELIVERY (explicit)

1. **False claim retracted:** "live state has no cron `jobs.json`". It exists: `~/.openclaw/cron/jobs.json` (2 jobs, both disabled), `jobs.json.bak`, 5 stale `jobs.json.*.tmp`, and `cron/runs/*.jsonl` (28 files, 1043 run records). The live 2026.2.16 runtime still writes it. My earlier `ls` covered other directories only; I never listed `cron/`.
2. **Retracted:** "Telegram offset reset is a minor, acceptable impact". The cursor is now preserved exactly (see "Telegram polling cursor").
3. **Superseded:** "candidate tree is byte-identical to upstream". The candidate is upstream v2026.10.1 plus 4 fork commits (1 runtime fix, 2 regression tests, 1 cutover helper) plus this file.
4. **Superseded:** "no bridge needed". The 2026.9.5 bridge Doctor is required (measured, above).

## Target verification

- `gh release list --repo openclaw/openclaw`: `v2026.10.1` is the latest stable release (2026-10-10T23:54:03Z, marked Latest). `v2026.10.5-beta.1` is a pre-release.
- Tag `v2026.10.1` points to `e178c39e9aa` on `upstream/release/2026.10.1`, cut from upstream main at `8ea8bb11a5b` (verified ancestor of `upstream/main`).
- Upstream CI on exactly `e178c39e9aa` is green: CI, Full Release Artifacts, OpenClaw Release Checks, and Full Release Validation (`gh run list --commit e178c39…`).

## Commits on the feature branch (all authored Junho Yeo <i@junho.io>, no trailers)

| Commit        | Purpose                                                                                                                                                                     |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `c96893472a8` | Existing integration merge (parents: upstream `e178c39e9aa` = v2026.10.1, fork runtime `a9bba4be41b`). Tree equals upstream: every fork delta is superseded (matrix below). |
| `1317d54888c` | fix(discord): clear the transient ack reaction once a turn settles (restores the fork outcome of `131dd49f659`)                                                             |
| `5178fc32c07` | test(skills): pin export alias reservation across registration and dispatch (fork `a8660a04949`/`a9bba4be41b`)                                                              |
| `b7398c2d113` | test(telegram): pin offset resume for identity-stamped migrated rows (cutover contract)                                                                                     |
| `5a3c4e33baf` | chore(upgrade): add Telegram offset identity stamp cutover helper (`upgrade-ops/telegram-offset-stamp.mjs`)                                                                 |
| (this commit) | docs(upgrade): this DELIVERY.md                                                                                                                                             |

The sibling worktree `upgrade-2026-10-1` (`c96893472a8`) and its build were not changed. The new runtime fix means the cutover must use **this** worktree's build, not the sibling's.

## Fork-feature matrix (fork change → 2026.10.1 outcome → proof)

All proofs ran on this candidate. "Upstream test" means an existing upstream test from the targeted run (23 files, 637 tests, all passed). "Fork test" means a test added on this branch.

| Fork commit(s)                              | Original fork outcome                                                                                | 2026.10.1 status                                                                                                                                                                                                                | Proof                                                                                                                                                                                                                                                                   |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `a8660a04949`, `68394094ddc`                | Telegram registers `/export_session` (valid name) and the skill menu                                 | Equivalent (plugin-owned name normalization, menu sync)                                                                                                                                                                         | Upstream: `bot-native-command-dispatch.routing.test.ts` (menu has exactly one `export_session`; `/export_session` routes native with `CommandBody /export-session`), `bot-native-commands.registry.test.ts`, `bot-native-command-menu-sync.test.ts`                     |
| `a9bba4be41b`                               | A colliding skill never takes the provider alias; registration and text dispatch agree               | Equivalent. A colliding `export-session`/`export_session` skill becomes `export_session_2` in both paths; `/export_session` never reaches it; `/export_session_2 …` and `/skill <name> …` invoke it                             | Fork test: `chat-commands.discovery.test.ts` › "fork regression: Telegram-native export alias stays with the built-in" (2 cases). Upstream: `skills.test.ts` collision cases. No owner skill collides with any provider alias (checked all 114).                        |
| `131dd49f659`                               | Discord shows only 👀, then clears it on completion (no phase emojis)                                | Phase-free ack is upstream (`presentation: "acknowledgement"`). The clear-on-completion part was not upstream (it retains 👀, shows an error emoji, and retired `messages.removeAckAfterReply`), so `1317d54888c` restores it   | Fork commit `1317d54888c`. The 3 ack tests are re-pinned: one 👀 through reasoning/tools/compaction, then removed on success and on failure. 4 Discord process suites, 72 tests passed                                                                                  |
| `e64f719f210`                               | Restart shutdown timeout restarts instead of exiting                                                 | Superseded by the dedicated restart path (`gateway.restart_shutdown_timeout`, drain budgets, watchdog)                                                                                                                          | Upstream: `run-loop.test.ts` (167 tests)                                                                                                                                                                                                                                |
| `208f44da794`                               | DM thread roots (`thread_ts == ts`) stay in thread when `replyToMode: off`                           | Equivalent for DMs (`isAssistantDmThreadRoot`). **Deliberate divergence:** channel self-thread roots are no longer forced into a thread. Upstream documents that tool threading would otherwise override `replyToMode` to `all` | Upstream: `threading.test.ts` › "sets messageThreadId for DM assistant thread-root messages regardless of replyToMode" and "does not set messageThreadId for channel thread-root messages with non-all replyToMode"                                                     |
| `a7d6ace69bf`                               | app_mention without `thread_ts` still threads                                                        | Superseded: app_mention ownership is resolved by channel type, and canonical message events (carrying `thread_ts`) own delivery                                                                                                 | Upstream: `monitor/events/messages.test.ts`, `message-handler.thread-resolution.test.ts`                                                                                                                                                                                |
| `3bff330fc2a`, `e9fc269a3a2`, `3eeadd35128` | Block streaming: finals still reach external dispatchers; finals already streamed are not duplicated | Equivalent                                                                                                                                                                                                                      | Upstream: `agent-runner-payloads.test.ts` › "preserves unsent text-only final payloads after block pipeline streamed partial content", "drops already-sent text-only final payloads …", "dedupes duplicate same-target reply text without suppressing unrelated finals" |
| `4bae68c1dd6`                               | Slack hot-path caching                                                                               | Superseded by the Slack extension rewrite (performance only)                                                                                                                                                                    | n/a                                                                                                                                                                                                                                                                     |
| `5b2124a477d`…`79acd59c0f1`                 | Slack console.log diagnostics                                                                        | Moot: already removed in the fork tip (`git grep console.log a9bba4be41b -- src/slack` is empty)                                                                                                                                | —                                                                                                                                                                                                                                                                       |
| `a835844e0b1`                               | Kimi models in OpenCode Zen                                                                          | Superseded: dynamic Zen catalog (`opencode/kimi-k3`), Moonshot `kimi-k2.5`/`k2.6`, `kimi-coding`                                                                                                                                | `extensions/opencode/provider-catalog.ts`; upstream `extensions/opencode/index.test.ts`                                                                                                                                                                                 |
| `d9b64dfedec`                               | A free-model cooldown does not block paid opencode models                                            | Superseded: cooldowns are model-scoped (`blockedModel`, `getSoonestCooldownExpiry(…, {forModel})`)                                                                                                                              | Upstream: `auth-profiles.getsoonestcooldownexpiry.test.ts`, `model-fallback.personal-cooldown.test.ts`                                                                                                                                                                  |
| `bae9d11695a`                               | Mattermost test deflake                                                                              | Moot (suite rewritten upstream)                                                                                                                                                                                                 | —                                                                                                                                                                                                                                                                       |
| `58956351302`                               | Whole-repo oxfmt                                                                                     | Moot (upstream owns formatting)                                                                                                                                                                                                 | —                                                                                                                                                                                                                                                                       |

Astra and Prime: the fork has no Astra-specific code (the earlier `astra` grep hits were `astral.sh` and `Transcript`). Astra support is upstream. On the migrated copy, the candidate resolves `ai-gateway/gpt-6-astra` as the **default** model (`alias:astra`, fallback #1 `ai-gateway/openrouter/anthropic/claude-opus-5.5`, all 12 ai-gateway models). The canary gateway logged `agent model: ai-gateway/gpt-6-astra (thinking=high)`. Prime skills `agent-sessions` and `prime-agent-control` (from `skills.load.extraDirs`) are discovered and **eligible**. No provider requests were made: listing used no `--refresh`, and the canary pointed ai-gateway at a dead port.

## Migration validation on isolated copies (never live)

Isolation: `rsync` copy of `~/.openclaw` (excluding `logs/`, `browser/`); minimal workspace copy (bootstrap `.md`, `.openclaw/`, `skills/`, `memory/`, `canvas/`); fake `HOME`. Only the copy's config was rewritten: workspace, the two Prime skill `extraDirs`, `gateway.port` → 18999. No other absolute paths exist in the config (checked, excluding `env`).

| Step (copy)                                                                                                              | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026.10.1 Doctor directly on unbridged state                                                                             | **Refused, exit 1**: retired `channels.telegram.streamMode/blockStreaming` → "Install OpenClaw 2026.9.5, run openclaw doctor --fix"                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026.9.7 Doctor directly                                                                                                 | Refused: retired Telegram JSON sidecars → "Run openclaw doctor --fix on 2026.9.5"                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **2026.9.5 Doctor `--fix --non-interactive`**                                                                            | **exit 0**. Cron store → SQLite and 28 legacy run logs imported; Telegram update offset (1) and sticker cache (2) → plugin state; memory index → per-agent SQLite (84 sources); device pairing (4), device auth, identity, exec approvals, workspace setup state, and telegram allowFrom → SQLite; config moved `telegram.streamMode` → `streaming.mode`, `blockStreaming` → `streaming.block.enabled`; removed retired `gateway.tailscale.resetOnExit`, retired QMD memory config, and runtime knobs. Legacy sources are archived as `*.migrated`, not deleted |
| **2026.10.1 Doctor `--fix --non-interactive`**                                                                           | **exit 0**. Pre-migration SQLite backups saved; agent DB schema migrated (35 sessions); "Normalized 1 Telegram SQLite update offsets"; 164/164 session titles repaired; webhook-listener decisions recorded; stale Codex/OpenAI routing cleared on 11/7 sessions                                                                                                                                                                                                                                                                                                |
| Telegram identity stamp (`upgrade-ops/telegram-offset-stamp.mjs`)                                                        | dry-run OK; stamp OK (`resumesAtOffset` = cursor + 1); re-run refused ("identity already stamped"); refused while a listener held the gateway port                                                                                                                                                                                                                                                                                                                                                                                                              |
| Canary boot (`gateway --update-canary`, `OPENCLAW_SKIP_CHANNELS=1`, `OPENCLAW_SKIP_PROVIDERS=1`, ai-gateway → dead port) | Schema preflight OK (389 ms); 22 plugins; `agent model: ai-gateway/gpt-6-astra`; "candidate gateway ready"; `openclaw health --json` → `ok: true`. Scheduled services (cron, heartbeat) are skipped under canary (verified in `server-startup-finish.ts`)                                                                                                                                                                                                                                                                                                       |

Exact preservation (verified by read-only SQLite queries on the copy):

- **Cron:** both user jobs (`903601d0` cron `0 23 * * *` Asia/Seoul, `4bba1a4d` every 5 min) keep their ids, `enabled=false`, and schedules. **1043 / 1043** legacy run records are in `task_runs` (`runtime=cron`), equal to the 1043 lines in the 28 live `runs/*.jsonl`. New: system job `heartbeat:main` (every 30 min) is the runtime's representation of the default agent heartbeat, not a user job.
- **Telegram cursor:** live JSON `{version:1, lastUpdateId:300190450}` → after 9.5: plugin state v1 `300190450` → after 10.1: v3 `300190450` → after stamp: identity set, resumes at `300190451`. (The live cursor keeps advancing; the runbook captures it at stop time.)
- **Sessions:** 420 entries in SQLite, 0 unreferenced JSONL. Two legacy transcripts are _deferred, originals retained_: one with duplicate primary headers (`da03b446…`), one with a duplicate identity (`8a30ed42…`). Inspect with `openclaw doctor --session-sqlite dry-run --session-sqlite-all-agents`.
- **Skills (default-state layout):** candidate 114 total / 86 eligible vs live 103 / 69. Live-eligible skills that are not eligible on the candidate: `coding-agent` (now opt-in: `skills.entries.coding-agent.enabled`), `session-logs` and `video-frames` (removed upstream), `brand-kit-prompt` (`~/.agents/skills`, no frontmatter `description`, now rejected), `discord`/`slack` (now shipped inside the channel plugins and loaded with the live channels, which the canary skips by design).

### Telegram polling cursor (why the stamp exists)

2026.10.1 `prepareTelegramAccount` treats a migrated offset row without bot identity as a `legacy-state` rotation. It overwrites the cursor with `null` and logs "discarding stale update offset … starting fresh" (`extensions/telegram/src/update-offset-store.ts`, `monitor.ts`). Without intervention, the first poll after cutover would have no offset, and any update not yet confirmed server-side could be redelivered. The helper stamps `botId` (token prefix) and `tokenFingerprint` (`sha256(token)[:16]`), exactly as `token-fingerprint.ts` derives them (parity checked against the product functions on 3 synthetic tokens). The runtime then finds a matching identity and resumes at `lastUpdateId + 1`. It needs no network call and never prints the token. If it ever stamped wrongly, the runtime would see `token-rotated` and discard the cursor, which is today's upstream behavior, so it fails safe. Contract test: `update-offset-store.test.ts` › "resumes a Doctor-migrated offset once its bot identity is stamped".

## Build evidence (this worktree)

- **Dependencies:** `pnpm install --frozen-lockfile` with the pinned **pnpm 12.5.1** (2m20s, lockfile unchanged). Tooling notes: corepack 0.33 cannot launch pnpm 12, because of its bin layout. pnpm's self-managed 12.5.1 install had skipped its own `install.js`, so I ran `~/Library/pnpm/.tools/pnpm/12.5.1/node_modules/pnpm/install.js` to fetch the native binary. pnpm 10 cannot read the pnpm-12 multi-document lockfile.
- **Build:** `pnpm build` (`scripts/build-all.mts`). First build at `c96893472a8`: 34m33s. Rebuild at `5a3c4e33baf`, after the Discord fix: 13m03s. Every runtime phase passed: tsdown, unified, DTS, external plugins (96), CLI bootstrap import guard, assets, `runtime-postbuild` ("verified 53 built modules with native require and checked doctor closures"), `build-stamp` (`head 5a3c4e33baf`, `inputsClean: true`), and `runtime-postbuild-stamp`.
- **Failing step, environmental and root-caused:** `check-plugin-sdk-exports`, a type-compat self-check of the _published plugin-SDK `.d.ts`_ that the runtime does not use. On this host, `openai@7.23.0`'s published `internal/types.d.mts` imports `'../../../../../../../../node_modules/undici-types/index.d.ts'`. In this repo's pnpm layout, that path resolves to the stray `/Users/junhoyeo/node_modules/undici-types` (6.21.0). That file references `~/node_modules/@types/node` **22.19.13**, which splits `http.IncomingMessage` (no `signal`) from 26.6.2's `node:http`. Proved with `tsc --explainFiles`/`--traceResolution` on an exact replica of the check's consumer (`.local/upgrade-evidence/sdk-consumer-*.log`). The same step passes in upstream CI on `e178c39e9aa`.
- **Final steps** (skipped by `build-all` after that check, run manually in the correct order): `write-build-info` (buildId `2026.10.1-5a3c4e33baf3-2026-10-11T20-43-45.744Z`), `write-cli-startup-metadata`, then `node scripts/ui.js build`. That is the same command the Gateway's asset step runs, and the Control UI build ID now matches build-info. `node openclaw.mjs --version` reports `OpenClaw 2026.10.1 (5a3c4e3)`. The later DELIVERY commit changes only this file, which is not a runtime input.
- **Final-artifact boot proof** (canary #2 over the fully migrated copy): no UI rebuild requested; schema preflight 267 ms; `agent model: ai-gateway/gpt-6-astra`; 22 plugins listening; ready in about 12 s; `health --json` returned `ok: true`.

## Test evidence

| Run                                                                                                                                                                                                                                                                                                                                                                    | Result                                                                                                                       | Log                                                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Targeted upstream regression (fork-feature equivalence): Telegram native commands/routing/menu/pipeline/offset, skills, commands registry, export-session, Slack threading/thread-resolution/events, reply payloads (block streaming), model-fallback cooldown, OpenCode, gateway run-loop, Discord ack, Doctor config flow, cron store migration, cron run-log import | **23 files, 637 tests passed, 0 failed** (12 vitest groups; largest group 109.6 s wall)                                      | `.local/upgrade-evidence/04-targeted-tests.log`                     |
| Changed and new tests: 4 Discord `message-handler.process*` suites, skills discovery (2 new fork-regression cases), Telegram offset store (1 new contract test)                                                                                                                                                                                                        | **6 files, 97 tests passed**                                                                                                 | `11-fork-change-tests.log`, `12-telegram-offset-test-after-fmt.log` |
| `oxfmt --check` and `oxlint` on all changed files                                                                                                                                                                                                                                                                                                                      | clean                                                                                                                        | —                                                                   |
| Scoped typecheck of changed TS files (`tsc` 7)                                                                                                                                                                                                                                                                                                                         | changed files clean. The only 2 errors (TS7016 `qrcode` declaration in `src/media/qr-runtime.ts`) come from the ad-hoc scope | `13-scoped-typecheck.log`                                           |
| Cutover helper: identity parity vs `token-fingerprint.ts` (3 synthetic tokens); dry-run, stamp, refuse-restamp, refuse-while-listening                                                                                                                                                                                                                                 | all as expected                                                                                                              | this document                                                       |

Evidence (private, git-ignored, 0700): `/Users/junhoyeo/openclaw-worktrees/verify-upgrade-2026-10-1/.local/upgrade-evidence/`. The Doctor logs for the copy chain are `02-doctor-9.5.log`, `03-doctor-10.1-candidate.log`, `14-doctor-10.1-direct-unbridged.log`, and `01-bridge-9.7-doctor-on-copy.log`. The validated migrated copy is kept at `/tmp/openclaw-mig-verify2` (0700) for spot checks.

## Cutover runbook (parent executes once, after approval)

Run step by step (step 7 is read-only) from an independent Terminal, **not** from the Gateway or an agent session it hosts, as `junhoyeo`. Stop at the first unexpected output and use Rollback. Expected downtime is about 8–12 min. Measured on the copy: 9.5 Doctor ≈ 100 s, 10.1 Doctor a few minutes, cold canary startup ≈ 70 s. Telegram messages sent during downtime wait server-side and are processed after restart. Discord and Slack events that arrive while disconnected are not replayed.

```bash
set -euo pipefail
NEW=/Users/junhoyeo/openclaw-worktrees/verify-upgrade-2026-10-1
BRIDGE=$NEW/.local/bridge-openclaw-2026.9.5/node_modules/.bin/openclaw
BK=$HOME/.openclaw-upgrade-backups/2026-10-12-cutover-$(date +%H%M%S)
GUI=gui/$(id -u)

# 0. Preflight (read-only)
node "$NEW/openclaw.mjs" --version   # expect: OpenClaw 2026.10.1 (5a3c4e3)
"$BRIDGE" --version                  # expect: OpenClaw 2026.9.5 (ec9c1a1)
openclaw --version                   # expect: 2026.2.16
launchctl print "$GUI/ai.openclaw.gateway" | grep -E '^\s+(state|pid) ='

# 1. Stop the Gateway (bootout also stops KeepAlive) and confirm the port is free
launchctl bootout "$GUI/ai.openclaw.gateway"
for i in $(seq 1 60); do lsof -nP -iTCP:18789 -sTCP:LISTEN >/dev/null || break; sleep 1; done
if lsof -nP -iTCP:18789 -sTCP:LISTEN; then echo "port 18789 still busy" >&2; exit 1; fi

# 2. Consistent private backup taken while stopped (this is the rollback source)
install -d -m 700 "$BK"
tar -C "$HOME" -czf "$BK/openclaw-state.tgz" .openclaw
tar -C "$HOME/clawd" -czf "$BK/workspace-dot-openclaw.tgz" .openclaw
cp -p "$HOME/Library/LaunchAgents/ai.openclaw.gateway.plist" "$BK/ai.openclaw.gateway.plist"
readlink /opt/homebrew/bin/openclaw > "$BK/cli-symlink-target.txt"
TG_LAST=$(python3 -c 'import json,os;print(json.load(open(os.path.expanduser("~/.openclaw/telegram/update-offset-default.json")))["lastUpdateId"])')
echo "$TG_LAST" > "$BK/telegram-last-update-id.txt"
chmod 600 "$BK"/*

# 3. Bridge migration (published 2026.9.5 Doctor)
"$BRIDGE" doctor --fix --non-interactive 2>&1 | tee "$BK/doctor-2026.9.5.log"
#    expect exit 0 and lines: "Cron store migrated to SQLite", "Migrated 1 Telegram update offset entry",
#    "Moved channels.telegram.streamMode", "Moved channels.telegram.blockStreaming"

# 4. Candidate Doctor
node "$NEW/openclaw.mjs" doctor --fix --non-interactive 2>&1 | tee "$BK/doctor-2026.10.1.log"
#    expect exit 0 and "Normalized 1 Telegram SQLite update offsets"

# 5. Preserve the Telegram polling cursor (explicit safe conversion, no network)
node "$NEW/upgrade-ops/telegram-offset-stamp.mjs" --expect-last-update-id "$TG_LAST"
#    expect {"ok":true,...,"resumesAtOffset":<TG_LAST+1>,"stamped":true}

# 6. Switch the CLI, then regenerate the LaunchAgent from the new installation (this starts the service)
ln -sfn "$NEW/openclaw.mjs" /opt/homebrew/bin/openclaw
openclaw --version                   # expect: OpenClaw 2026.10.1 (5a3c4e3)
openclaw gateway install --force --port 18789
plutil -p "$HOME/Library/LaunchAgents/ai.openclaw.gateway.plist" | grep -E 'dist/index.js|OPENCLAW_SERVICE_VERSION'
#    expect: $NEW/dist/index.js and 2026.10.1. OPENCODE_API_KEY also comes from config env.vars,
#    so a regenerated plist without it is fine.

# 7. Verify (read-only)
openclaw gateway status --deep
openclaw health --json | head -30
grep -h -E 'agent model: ai-gateway/gpt-6-astra|http server listening|discarding stale update offset' \
  "$HOME/.openclaw/logs/gateway.log" /tmp/openclaw/openclaw-$(date +%F).log | tail -5 || true
#    expect the astra and listening lines, and NO "discarding stale update offset"
openclaw cron list                   # expect 2 disabled user jobs (+ heartbeat)
openclaw models list --provider ai-gateway | head -3        # astra = default
openclaw skills list --eligible | grep -E 'agent-sessions|prime-agent-control'
```

Doctor safety for these steps follows the documented contract (`docs/cli/doctor/recovery.md`), which I read: source checkouts get no automatic service repair authority, and "a stopped service targeting another installation keeps its definition and stop state". Neither Doctor run will repoint or start the LaunchAgent; step 6 does that explicitly.

## Rollback (if any step 3–7 fails)

```bash
launchctl bootout "gui/$(id -u)/ai.openclaw.gateway" 2>/dev/null || true
# If the new Gateway already polled Telegram, carry its cursor back so 2026.2.16 does not replay:
NEWCUR=$(python3 - <<'EOF'
import json, os, sqlite3
p = os.path.expanduser("~/.openclaw/state/openclaw.sqlite")
try:
    row = sqlite3.connect(f"file:{p}?mode=ro", uri=True).execute(
        "select value_json from plugin_state_entries where plugin_id='telegram' and namespace='telegram.update-offsets' and entry_key='default'").fetchone()
    print(json.loads(row[0]).get("lastUpdateId") or "")
except Exception:
    print("")
EOF
)
mv "$HOME/.openclaw" "$HOME/.openclaw.failed-$(date +%Y%m%d%H%M%S)"
tar -C "$HOME" -xzf "$BK/openclaw-state.tgz"
tar -C "$HOME/clawd" -xzf "$BK/workspace-dot-openclaw.tgz"
if [ -n "$NEWCUR" ] && [ "$NEWCUR" -gt "$(cat "$BK/telegram-last-update-id.txt")" ]; then
  python3 -c 'import json,os,sys;p=os.path.expanduser("~/.openclaw/telegram/update-offset-default.json");d=json.load(open(p));d["lastUpdateId"]=int(sys.argv[1]);json.dump(d,open(p,"w"))' "$NEWCUR"
fi
cp -p "$BK/ai.openclaw.gateway.plist" "$HOME/Library/LaunchAgents/ai.openclaw.gateway.plist"
ln -sfn "$(cat "$BK/cli-symlink-target.txt")" /opt/homebrew/bin/openclaw
launchctl bootstrap "gui/$(id -u)" "$HOME/Library/LaunchAgents/ai.openclaw.gateway.plist"
openclaw --version && openclaw health
```

Rollback restores the exact stopped-time state. Conversations and cron runs handled by the new Gateway before rollback stay in `~/.openclaw.failed-*` and are not merged back. The older full archive from the ops sibling, `~/.openclaw-upgrade-backups/2026-10-12-precutover`, remains available but is a live (non-atomic) snapshot; prefer the stopped-time archive.

## Incidents during this task (all disclosed; live service never restarted)

1. **Live workspace file archived by my first bridge test (restored).** The first isolated copy still pointed `agents.defaults.workspace` at the real `~/clawd`. The 2026.9.7 Doctor archived `~/clawd/.openclaw/workspace-state.json` to `.migrated.<hash>`, and the live 2026.2.16 gateway then recreated it with a new `onboardingCompletedAt`. I restored the original bytes atomically (sha256 match; `onboardingCompletedAt` is back to `2026-02-18T14:43:47.425Z`). I moved my archive and the recreated copy to `.local/upgrade-evidence/incident-workspace-state/`. No bootstrap or template files were written. Every later sandbox rewrote workspace and skill paths and used a fake `HOME`.
2. **One read-only RPC attempt reached the live gateway port.** The sandbox config still carried `gateway.port 18789`, so the candidate `skills list` connected to the live 2026.2.16 gateway and got `protocol mismatch`. No call ran. After that, sandboxes used port 18999 and `OPENCLAW_GATEWAY_PORT=18999`.
3. **Root lockfile briefly modified (reverted).** Installing the bridge inside `.local/` without `--ignore-workspace` added an importer to `pnpm-lock.yaml`. I reverted it, reinstalled the bridge standalone, and ran `pnpm install --frozen-lockfile` (Done, exit 0). The lockfile is unchanged on the branch.
4. **Log noise in `/tmp/openclaw/openclaw-2026-10-12.log`** (OpenClaw's shared default log dir, also used by the live gateway). Lines from my sandbox Doctor and canary runs are mixed in. No state change.

Also verified: `core.hooksPath=git-hooks` already existed in the shared `.git/config`; the install's prepare script no-ops when it is set.

## Residual risks and owner follow-ups (after cutover, none blocking)

- **Semantic memory recall degraded** until the managed llama.cpp server is set up. The config uses local embeddings, and 2026.10.1 removed the in-process `node-llama-cpp` runtime (canary warning). Fix (interactive, needs download consent): `openclaw models --agent main auth login --provider llama-cpp --method local`, then `openclaw memory status --deep`.
- **Skills:** `coding-agent` is now opt-in (`skills.entries.coding-agent.enabled`); `session-logs` and `video-frames` were removed upstream; `brand-kit-prompt` (`~/.agents/skills`) needs a frontmatter `description:`; several workspace skills under `~/clawd/skills` (`discord-role`, `github-monitor`, `omc-release`, `pr-reviewer`, `release`, and the gajae-skills copies) are skipped for the same missing `description`.
- **Discord:** with `1317d54888c`, failures clear the ack instead of showing upstream's error emoji, which is the fork's original choice. To prefer upstream signaling: `git revert 1317d54888c` and rebuild.
- **Slack:** channel thread roots (`thread_ts == ts`) are no longer forced into a thread. This is the deliberate upstream divergence documented in the matrix; DMs are unchanged.
- **Sessions:** 2 malformed legacy transcripts were deferred, with originals retained.
- **Doctor advisories (non-blocking):** plaintext secrets in `openclaw.json` (consider SecretRefs); one disabled tool-bearing cron job keeps legacy sender-policy resolution; a duplicate `llama-cpp` plugin id (the bundled plugin wins); the gateway is loopback-only (expected).
- **Build host hazard:** the stray `~/node_modules/{undici-types@6.21.0,@types/node@22.19.13}` (dated March 2026) breaks the plugin-SDK declaration self-check for _any_ OpenClaw build under `/Users/junhoyeo` (see "Build"). It is not used by the runtime. Removing or moving it is the owner's call; I did not touch it.
- **Not run:** live channel connections, provider calls, and Telegram/Discord/Slack sends (no coordination yet); full repo typecheck (a scoped check covered the changed files); full test suite (the targeted 23+6 files ran).

## Cleanup after verified cutover

- Keep `$BK` until the new runtime has been stable for a while. Then remove the validated sandbox (it contains copies of secrets; the dirs are 0700): `rm -rf /tmp/openclaw-mig-verify2`.
- `.local/` in the worktree (bridge install, evidence) is git-ignored; delete it after acceptance.
