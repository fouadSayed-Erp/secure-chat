import { describe, expect, it } from "vitest";
import { normalizeUsername, validateLocalLogin } from "../lib/auth-utils";

describe("local login validation", () => {
  it("trims and accepts a valid local account", () => {
    expect(normalizeUsername("  ahmed  ")).toBe("ahmed");
    expect(validateLocalLogin("ahmed", "1234")).toEqual({ valid: true });
  });

  it("rejects weak usernames and passwords", () => {
    expect(validateLocalLogin("ab", "1234").valid).toBe(false);
    expect(validateLocalLogin("ahmed", "123").valid).toBe(false);
  });
});
