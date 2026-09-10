import { describe, expect, it } from "vitest";
import {
  VIEWER_SEAT_LIMIT,
  deviceLabel,
  isSeatId,
  seatCheckPasses,
  seatsInUseLabel,
  viewerBusyMessage,
} from "./viewerSeats";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";
const ANDROID_TABLET =
  "Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15";
const IPAD =
  "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

describe("viewer seats", () => {
  it("allows ten players per team", () => {
    expect(VIEWER_SEAT_LIMIT).toBe(10);
  });

  it("busy message carries the limit and names the superadmin", () => {
    const msg = viewerBusyMessage(10, "Ravi Kant");
    expect(msg).toContain("All 10 viewer seats are in use");
    expect(msg).toContain("Ask Ravi Kant (superadmin)");
  });

  it("busy message falls back when the team has no superadmin name", () => {
    expect(viewerBusyMessage(10, null)).toContain("Ask your superadmin (superadmin)");
  });

  it("labels the seat count", () => {
    expect(seatsInUseLabel(0, 10)).toBe("No one is signed in right now");
    expect(seatsInUseLabel(1, 10)).toBe("1 of 10 seats in use");
    expect(seatsInUseLabel(10, 10)).toBe("10 of 10 seats in use");
  });
});

describe("deviceLabel", () => {
  it("maps common phones and desktops to a coarse family", () => {
    expect(deviceLabel(IPHONE)).toBe("iPhone");
    expect(deviceLabel(IPAD)).toBe("iPad");
    expect(deviceLabel(ANDROID)).toBe("Android phone");
    expect(deviceLabel(ANDROID_TABLET)).toBe("Android tablet");
    expect(deviceLabel(WINDOWS)).toBe("Windows PC");
    expect(deviceLabel(MAC)).toBe("Mac");
  });

  it("returns null for a missing or unrecognised User-Agent", () => {
    expect(deviceLabel(null)).toBeNull();
    expect(deviceLabel(undefined)).toBeNull();
    expect(deviceLabel("")).toBeNull();
    expect(deviceLabel("curl/8.4.0")).toBeNull();
  });

  it("never exceeds the column's 40-character check", () => {
    for (const ua of [IPHONE, IPAD, ANDROID, ANDROID_TABLET, WINDOWS, MAC]) {
      expect(deviceLabel(ua)!.length).toBeLessThanOrEqual(40);
    }
  });
});

describe("isSeatId", () => {
  it("accepts a UUID and nothing else", () => {
    expect(isSeatId("3f2504e0-4f89-11d3-9a0c-0305e82c3301")).toBe(true);
    expect(isSeatId("3F2504E0-4F89-11D3-9A0C-0305E82C3301")).toBe(true);
    expect(isSeatId("not-a-uuid")).toBe(false);
    expect(isSeatId("")).toBe(false);
    expect(isSeatId(42)).toBe(false);
    expect(isSeatId(undefined)).toBe(false);
  });
});

describe("seatCheckPasses", () => {
  const sid = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";

  it("a token with a seat is good only while the row exists", () => {
    expect(seatCheckPasses({ isViewer: true, sid, seatAlive: true })).toBe(true);
    expect(seatCheckPasses({ isViewer: true, sid, seatAlive: false })).toBe(false);
  });

  it("a seat-less token is good for an admin but never for the viewer", () => {
    expect(seatCheckPasses({ isViewer: false, sid: undefined, seatAlive: false })).toBe(true);
    expect(seatCheckPasses({ isViewer: true, sid: undefined, seatAlive: false })).toBe(false);
  });
});
