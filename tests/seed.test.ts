import { describe, expect, it } from "vitest";
import { hashString, mulberry32 } from "../src/city/seed.js";

describe("seeded random helpers", () => {
  it("hashes and generates repeatable values", () => {
    expect(hashString("octocat:365")).toBe(hashString("octocat:365"));
    const first = mulberry32(hashString("stable"))();
    const second = mulberry32(hashString("stable"))();
    expect(first).toBe(second);
  });
});
