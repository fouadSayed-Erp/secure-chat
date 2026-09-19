import { describe, expect, it } from "vitest";
import { fingerprint } from "../lib/crypto-utils";

describe("local crypto helpers", () => {
  it("creates a readable fingerprint from a public key", () => {
    expect(fingerprint("a4d18f2291c75b0e77aa99cc")).toBe("a4d1 8f22 91c7 5b0e 77aa 99cc");
  });

  it("keeps short fingerprints intact", () => {
    expect(fingerprint("abcd")).toBe("abcd");
  });
});
