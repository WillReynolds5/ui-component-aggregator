import { afterEach, describe, expect, it, vi } from "vitest";

const send = vi.fn();
vi.mock("@aws-sdk/client-lambda", () => ({
  LambdaClient: class {
    send = send;
  },
  InvokeCommand: class {
    constructor(public input: { Payload: Uint8Array; InvocationType: string }) {}
  },
}));

const { chunk, requestPreviewCapture } = await import("@/lib/catalog/capture-trigger");

afterEach(() => {
  send.mockReset();
  delete process.env.CAPTURE_FUNCTION_NAME;
});

describe("chunk", () => {
  it("splits into fixed-size batches", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});

describe("requestPreviewCapture", () => {
  it("does nothing without a capture function (local dev)", async () => {
    expect(await requestPreviewCapture(["a"])).toBe("disabled");
    expect(send).not.toHaveBeenCalled();
  });

  it("queues one async invoke per batch of ten", async () => {
    process.env.CAPTURE_FUNCTION_NAME = "capture";
    send.mockResolvedValue({ StatusCode: 202 });
    const ids = Array.from({ length: 23 }, (_, index) => `id-${index}`);
    expect(await requestPreviewCapture(ids)).toBe("queued");
    expect(send).toHaveBeenCalledTimes(3);
    const first = send.mock.calls[0][0].input;
    expect(first.InvocationType).toBe("Event");
    expect(JSON.parse(Buffer.from(first.Payload).toString())).toEqual({
      itemIds: ids.slice(0, 10),
      limit: 10,
    });
  });

  it("reports a failed invoke instead of throwing", async () => {
    process.env.CAPTURE_FUNCTION_NAME = "capture";
    send.mockRejectedValue(new Error("AccessDenied"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await requestPreviewCapture(["a"])).toBe("failed");
  });
});
