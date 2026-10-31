// The site's security headers. The content policy is applied to the production build only, because the dev server needs more.
const api = process.env.NEXT_PUBLIC_API || "http://localhost:8080";
const csp = [
  "default-src 'self'",
  `img-src 'self' data: blob: ${api} https://tile.openstreetmap.org`,
  `connect-src 'self' ${api} https://nominatim.openstreetmap.org https://tile.openstreetmap.org`,
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'", // Next puts its start-up data and the saved theme in inline scripts
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

export default {
  distDir: process.env.NEXT_DIST || ".next",
  async headers() {
    const common = [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
      { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }, // ignored over plain http
    ];
    return [{ source: "/:path*", headers: process.env.NODE_ENV === "production" ? [...common, { key: "Content-Security-Policy", value: csp }] : common }];
  },
};
