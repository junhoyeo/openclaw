import type { ReplyToMode } from "../config/types.js";
import type { SlackAppMentionEvent, SlackMessageEvent } from "./types.js";

export type SlackThreadContext = {
  incomingThreadTs?: string;
  messageTs?: string;
  isThreadReply: boolean;
  replyToId?: string;
  messageThreadId?: string;
};

export function resolveSlackThreadContext(params: {
  message: SlackMessageEvent | SlackAppMentionEvent;
  replyToMode: ReplyToMode;
}): SlackThreadContext {
  const incomingThreadTs = params.message.thread_ts;
  const eventTs = params.message.event_ts;
  const messageTs = params.message.ts ?? eventTs;
  const hasThreadTs = typeof incomingThreadTs === "string" && incomingThreadTs.length > 0;
  // Simplify: if we have thread_ts, we're in a thread - always preserve context.
  // The old logic failed when thread_ts === ts AND no parent_user_id (edge case in DM threads).
  const isThreadReply = hasThreadTs;
  const replyToId = incomingThreadTs ?? messageTs;
  // Always preserve thread context when thread_ts exists.
  // This ensures replies stay in the same thread even when replyToMode is "off" (DM default).
  const messageThreadId = hasThreadTs
    ? incomingThreadTs
    : params.replyToMode === "all"
      ? messageTs
      : undefined;
  return {
    incomingThreadTs,
    messageTs,
    isThreadReply,
    replyToId,
    messageThreadId,
  };
}

export function resolveSlackThreadTargets(params: {
  message: SlackMessageEvent | SlackAppMentionEvent;
  replyToMode: ReplyToMode;
}) {
  const { incomingThreadTs, messageTs } = resolveSlackThreadContext(params);
  const replyThreadTs = incomingThreadTs ?? (params.replyToMode === "all" ? messageTs : undefined);
  const statusThreadTs = replyThreadTs ?? messageTs;
  return { replyThreadTs, statusThreadTs };
}
