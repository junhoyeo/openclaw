import type { WebClient as SlackWebClient } from "@slack/web-api";
import { describe, expect, it, vi } from "vitest";
import type { SlackMessageEvent } from "../types.js";
import { createSlackThreadTsResolver } from "./thread-resolution.js";

function createClient(historyMock: ReturnType<typeof vi.fn>): SlackWebClient {
  return {
    conversations: {
      history: historyMock,
    },
  } as unknown as SlackWebClient;
}

describe("createSlackThreadTsResolver", () => {
  it("caches resolved thread_ts lookups", async () => {
    const historyMock = vi.fn().mockResolvedValue({
      messages: [{ ts: "1", thread_ts: "9" }],
    });
    const resolver = createSlackThreadTsResolver({
      client: createClient(historyMock),
      cacheTtlMs: 60_000,
      maxSize: 5,
    });

    const message = {
      channel: "C1",
      parent_user_id: "U2",
      ts: "1",
    } as SlackMessageEvent;

    const first = await resolver.resolve({ message, source: "message" });
    const second = await resolver.resolve({ message, source: "message" });

    expect(first.thread_ts).toBe("9");
    expect(second.thread_ts).toBe("9");
    expect(historyMock).toHaveBeenCalledTimes(1);
  });

  it("resolves missing thread_ts for app_mention replies without parent_user_id", async () => {
    const historyMock = vi.fn().mockResolvedValue({
      messages: [{ ts: "2", thread_ts: "2.100" }],
    });
    const resolver = createSlackThreadTsResolver({
      client: createClient(historyMock),
      cacheTtlMs: 60_000,
      maxSize: 5,
    });

    const message = {
      channel: "C2",
      ts: "2",
      text: "<@Ubot> hi",
    } as SlackMessageEvent;

    const resolved = await resolver.resolve({ message, source: "app_mention" });

    expect(resolved.thread_ts).toBe("2.100");
    expect(historyMock).toHaveBeenCalledTimes(1);
  });

  it("does not resolve top-level message without parent_user_id", async () => {
    const historyMock = vi.fn().mockResolvedValue({ messages: [] });
    const resolver = createSlackThreadTsResolver({
      client: createClient(historyMock),
      cacheTtlMs: 60_000,
      maxSize: 5,
    });

    const message = {
      channel: "C3",
      ts: "3",
      text: "hello",
    } as SlackMessageEvent;

    const resolved = await resolver.resolve({ message, source: "message" });

    expect(resolved.thread_ts).toBeUndefined();
    expect(historyMock).not.toHaveBeenCalled();
  });
});
