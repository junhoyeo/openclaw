import type { SlackMonitorContext } from "./context.js";
import { readChannelAllowFromStore } from "../../pairing/pairing-store.js";
import { allowListMatches, normalizeAllowList, normalizeAllowListLower } from "./allow-list.js";

const ALLOW_FROM_CACHE_TTL_MS = 15_000;

type SlackAllowFromCacheEntry = {
  allowFrom: string[];
  expiresAt: number;
  inflight?: Promise<string[]>;
};

let slackAllowFromCache: SlackAllowFromCacheEntry | null = null;

async function readSlackStoreAllowFromCached() {
  const now = Date.now();
  const cached = slackAllowFromCache;
  if (cached && cached.expiresAt > now) {
    return cached.allowFrom;
  }
  if (cached?.inflight) {
    return cached.inflight;
  }
  const inflight = readChannelAllowFromStore("slack").catch(() => [] as string[]);
  slackAllowFromCache = {
    allowFrom: cached?.allowFrom ?? [],
    expiresAt: now,
    inflight,
  };
  const allowFrom = await inflight;
  slackAllowFromCache = {
    allowFrom,
    expiresAt: Date.now() + ALLOW_FROM_CACHE_TTL_MS,
  };
  return allowFrom;
}

export async function resolveSlackEffectiveAllowFrom(ctx: SlackMonitorContext) {
  const storeAllowFrom = await readSlackStoreAllowFromCached();
  const allowFrom = normalizeAllowList([...ctx.allowFrom, ...storeAllowFrom]);
  const allowFromLower = normalizeAllowListLower(allowFrom);
  return { allowFrom, allowFromLower };
}

export function isSlackSenderAllowListed(params: {
  allowListLower: string[];
  senderId: string;
  senderName?: string;
}) {
  const { allowListLower, senderId, senderName } = params;
  return (
    allowListLower.length === 0 ||
    allowListMatches({
      allowList: allowListLower,
      id: senderId,
      name: senderName,
    })
  );
}
