import { describe, expect, it } from "vitest";

import { formatDuration, formatFieldLabel, formatJsonValue, formatStatus } from "./format";

describe("format utilities", () => {
  it("formats enum-style status values", () => {
    expect(formatStatus("WAITING_FOR_APPROVAL")).toBe("Waiting For Approval");
  });

  it("formats field keys and simple JSON values", () => {
    expect(formatFieldLabel("required_date")).toBe("Required Date");
    expect(formatJsonValue(true)).toBe("Yes");
    expect(formatJsonValue(null)).toBe("-");
  });

  it("formats durations across common ranges", () => {
    expect(formatDuration(42)).toBe("42s");
    expect(formatDuration(90)).toBe("1.5m");
    expect(formatDuration(7200)).toBe("2.0h");
  });
});
