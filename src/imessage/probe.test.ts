import { beforeEach, describe, expect, it, vi } from "vitest";

const detectBinaryMock = vi.hoisted(() => vi.fn());
const runCommandWithTimeoutMock = vi.hoisted(() => vi.fn());
const createIMessageRpcClientMock = vi.hoisted(() => vi.fn());
const loadConfigMock = vi.hoisted(() => vi.fn());

vi.mock("../commands/onboard-helpers.js", () => ({
  detectBinary: (...args: unknown[]) => detectBinaryMock(...args),
}));

vi.mock("../config/config.js", () => ({
  loadConfig: (...args: unknown[]) => loadConfigMock(...args),
}));

vi.mock("../process/exec.js", () => ({
  runCommandWithTimeout: (...args: unknown[]) => runCommandWithTimeoutMock(...args),
}));

vi.mock("./client.js", () => ({
  createIMessageRpcClient: (...args: unknown[]) => createIMessageRpcClientMock(...args),
}));

beforeEach(() => {
  vi.resetModules();
  detectBinaryMock.mockReset().mockResolvedValue(true);
  runCommandWithTimeoutMock.mockReset().mockResolvedValue({
    stdout: "",
    stderr: 'unknown command "rpc" for "imsg"',
    code: 1,
    signal: null,
    killed: false,
  });
  createIMessageRpcClientMock.mockReset();
  loadConfigMock.mockReset().mockReturnValue({});
});

describe("probeIMessage", () => {
  it("marks unknown rpc subcommand as fatal", async () => {
    const { probeIMessage } = await import("./probe.js");
    const result = await probeIMessage(1000, { cliPath: "imsg" });
    expect(result.ok).toBe(false);
    expect(result.fatal).toBe(true);
    expect(result.error).toMatch(/rpc/i);
    expect(createIMessageRpcClientMock).not.toHaveBeenCalled();
  });

  it("uses config probeTimeoutMs when not explicitly provided", async () => {
    const requestMock = vi.fn().mockResolvedValue({});
    createIMessageRpcClientMock.mockResolvedValue({
      request: requestMock,
      stop: vi.fn().mockResolvedValue(undefined),
    });
    runCommandWithTimeoutMock.mockResolvedValue({
      stdout: "",
      stderr: "",
      code: 0,
      signal: null,
      killed: false,
    });
    loadConfigMock.mockReturnValue({
      channels: {
        imessage: {
          probeTimeoutMs: 15_000,
        },
      },
    });
    const { probeIMessage } = await import("./probe.js");
    const result = await probeIMessage();
    expect(result.ok).toBe(true);
    expect(runCommandWithTimeoutMock).toHaveBeenCalledWith(["imsg", "rpc", "--help"], {
      timeoutMs: 15_000,
    });
    expect(requestMock).toHaveBeenCalledWith("chats.list", { limit: 1 }, { timeoutMs: 15_000 });
  });
});
