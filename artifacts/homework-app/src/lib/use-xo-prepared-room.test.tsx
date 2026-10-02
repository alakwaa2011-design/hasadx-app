import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useXoPreparedRoom } from "./use-xo-prepared-room";

const socket = vi.hoisted(() => ({ emit: vi.fn(), timeout: vi.fn() }));
vi.mock("./xo-socket", () => ({ getXoSocket: () => socket }));
const save = vi.fn();
const fetchRoom = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  save.mockResolvedValue({ token: "saved-token", savedActivityId: 42 });
  fetchRoom.mockResolvedValue({
    ok: true, json: async () => ({ pin: "123456", playRoute: "/game/xo/play/123456", controlToken: "test-only-control" }),
  });
  vi.stubGlobal("fetch", fetchRoom);
  socket.timeout.mockReturnValue(socket);
  socket.emit.mockImplementation((_event, _data, cb) => cb(null, { success: true }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("X O room preparation", () => {
  it("creates once, shares in-flight preparation and reuses the room when entering", async () => {
    const { result } = renderHook(() => useXoPreparedRoom(7, "draft", save));
    let pin = "";
    await act(async () => {
      const first = result.current.prepare();
      const second = result.current.prepare();
      expect(first).toBe(second);
      pin = (await first).pin;
    });
    await act(async () => expect((await result.current.prepare()).pin).toBe(pin));
    expect(save).toHaveBeenCalledTimes(1);
    expect(fetchRoom).toHaveBeenCalledTimes(1);
    expect(result.current.room?.pin).toBe("123456");
    expect(sessionStorage.getItem("xo-control-123456")).toBe("test-only-control");
    expect(socket.emit).toHaveBeenCalledWith("xo:reclaim-host", { pin, controlToken: "test-only-control" }, expect.any(Function));
  });

  it("restores the prepared room after a setup reload, without making another room", async () => {
    const first = renderHook(() => useXoPreparedRoom(7, "draft", save));
    await act(async () => { await first.result.current.prepare(); });
    first.unmount();
    const restored = renderHook(() => useXoPreparedRoom(7, "draft", save));
    expect(restored.result.current.room?.savedActivityId).toBe(42);
    await act(async () => { await restored.result.current.prepare(); });
    expect(fetchRoom).toHaveBeenCalledTimes(1);
  });

  it("never restores another teacher's room", async () => {
    const first = renderHook(() => useXoPreparedRoom(7, "draft", save));
    await act(async () => { await first.result.current.prepare(); });
    first.unmount();
    const other = renderHook(() => useXoPreparedRoom(8, "draft", save));
    expect(other.result.current.room).toBeNull();
  });

  it("reports a closed room before allowing a new link, rather than replacing it silently", async () => {
    const { result } = renderHook(() => useXoPreparedRoom(7, "draft", save));
    await act(async () => { await result.current.prepare(); });
    socket.emit.mockImplementationOnce((_event, _data, cb) => cb(null, { error: "Room not found" }));
    await act(async () => { await expect(result.current.prepare()).rejects.toThrow("xo-room-expired"); });
    expect(result.current.room).toBeNull();
    expect(fetchRoom).toHaveBeenCalledTimes(1);
    await act(async () => { await result.current.prepare(); });
    expect(fetchRoom).toHaveBeenCalledTimes(2);
  });

  it("keeps the distributed link on a temporary connection failure", async () => {
    const { result } = renderHook(() => useXoPreparedRoom(7, "draft", save));
    await act(async () => { await result.current.prepare(); });
    socket.emit.mockImplementationOnce((_event, _data, cb) => cb(new Error("timeout")));
    await act(async () => { await expect(result.current.prepare()).rejects.toThrow("xo-room-connection"); });
    expect(result.current.room?.pin).toBe("123456");
    expect(fetchRoom).toHaveBeenCalledTimes(1);
  });

  it("does not keep a failed response and allows an explicit retry", async () => {
    fetchRoom.mockResolvedValueOnce({ ok: false, json: async () => ({ message: "Unavailable" }) });
    const { result } = renderHook(() => useXoPreparedRoom(7, "draft", save));
    await act(async () => { await expect(result.current.prepare()).rejects.toThrow("Unavailable"); });
    expect(result.current.room).toBeNull();
    await act(async () => { await result.current.prepare(); });
    expect(result.current.room?.pin).toBe("123456");
  });

  it("rejects preparation without a teacher identity", async () => {
    const { result } = renderHook(() => useXoPreparedRoom(undefined, "draft", save));
    await expect(result.current.prepare()).rejects.toThrow("xo-room-login");
    expect(fetchRoom).not.toHaveBeenCalled();
  });
});