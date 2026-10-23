import { expect, test } from "@playwright/test";
import { totp } from "./totp";

// the RFC 6238 test vector: the ASCII secret "12345678901234567890" at 59 seconds is 94287082 (8 digits), so 287082 in 6
test("the code generator matches the RFC 6238 test vector", () => {
  const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
  expect(totp(secret, 0, 59_000, 8)).toBe("94287082");
  expect(totp(secret, 0, 59_000)).toBe("287082");
  expect(totp(secret, 0, 1_111_111_109_000, 8)).toBe("07081804");
  expect(totp(secret, 1, 59_000)).toBe(totp(secret, 0, 89_000)); // one step on is the same as 30 seconds later
});
