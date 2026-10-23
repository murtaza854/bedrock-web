import { createHmac } from "node:crypto";

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const base32 = (s: string) => {
  let bits = "";
  for (const c of s.replace(/[\s=]/g, "").toUpperCase()) bits += B32.indexOf(c).toString(2).padStart(5, "0");
  const out: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(out);
};

// RFC 6238: a 6-digit code from a base32 secret, for the 30-second step `offsetSteps` away from now
// (the server accepts one step either side, which lets a test use a code it has not used before).
export function totp(secret: string, offsetSteps = 0, at = Date.now(), digits = 6): string {
  const counter = Math.floor(at / 30_000) + offsetSteps;
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac("sha1", base32(secret)).update(msg).digest();
  const o = h[h.length - 1] & 0xf;
  const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 10 ** digits).padStart(digits, "0");
}
