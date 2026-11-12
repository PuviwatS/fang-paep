import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-next";

describe("safeNextPath", () => {
  it("keeps paths on this site", () => {
    expect(safeNextPath("/account")).toBe("/account");
    expect(safeNextPath("/checkout?plan=plus_monthly")).toBe("/checkout?plan=plus_monthly");
  });

  it("rejects outside URLs and empty values", () => {
    expect(safeNextPath("https://evil.example")).toBe("/");
    expect(safeNextPath("//evil.example")).toBe("/");
    expect(safeNextPath("/\\evil.example")).toBe("/");
    expect(safeNextPath(null)).toBe("/");
  });
});
