export const API = process.env.NEXT_PUBLIC_API!;
const call = (p: string, init?: RequestInit) =>
  fetch(API + p, { credentials: "include", ...init }).then(async (r) => {
    if (r.status === 401) { location.href = "/login"; throw new Error("unauthorized"); }
    if (!r.ok) throw new Error((await r.text()).trim() || "Request failed");
    return r.status === 204 ? null : r.json();
  });
export const get = (p: string) => call(p);
const send = (method: string) => (p: string, b: unknown) =>
  call(p, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) });
export const post = send("POST");
export const patch = send("PATCH");
export const put = send("PUT");
export const del = (p: string) => call(p, { method: "DELETE" });
export const upload = (p: string, f: FormData) => call(p, { method: "POST", body: f });
export const pkr = (n?: number | null) => (n ? "PKR " + n.toLocaleString() : "no quotes");
