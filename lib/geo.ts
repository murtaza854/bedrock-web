export const KARACHI: [number, number] = [67.01, 24.86]; // lon, lat
export const ANCHOR_KINDS = ["main_road", "market", "school", "hospital", "mosque", "park", "transit", "landmark", "nuisance", "other"];
export const ANCHOR_LETTER: Record<string, string> = { main_road: "R", market: "M", school: "S", hospital: "H", mosque: "Q", park: "P", transit: "T", landmark: "L", nuisance: "!", other: "?" };
export const STATUS_HEX: Record<string, string> = { new: "#9ca3af", shortlisted: "#38bdf8", negotiating: "#fbbf24", rejected: "#ef4444", bought: "#4ade80" };
export const GREY = "#9ca3af";
export const scoreHex = (s?: number | null) => (s == null ? GREY : s >= 60 ? "#4ade80" : s >= 30 ? "#fbbf24" : "#ef4444");
// "24.8000, 67.0500" or "24.8000 67.0500" as copied from a map app
export function parseCoords(text: string): { lat: number; lon: number } | null {
  const m = text.trim().match(/^(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = Number(m[1]), lon = Number(m[2]);
  return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180 ? { lat, lon } : null;
}
// Coordinates from whatever the user pastes: "24.8, 67.05", or a full Google Maps / OpenStreetMap link.
// Short links (maps.app.goo.gl) can't be read from the browser, so those need the long link or a search.
export function parseMapInput(text: string): { lat: number; lon: number } | null {
  const t = text.trim();
  const plain = parseCoords(t);
  if (plain) return plain;
  const pats = [/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/, /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/, /[?&](?:q|ll|query|mlat)=(-?\d+(?:\.\d+)?)(?:,|&mlon=)(-?\d+(?:\.\d+)?)/, /#map=\d+\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)/];
  for (const re of pats) {
    const m = t.match(re);
    if (m) { const lat = Number(m[1]), lon = Number(m[2]); if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) return { lat, lon }; }
  }
  return null;
}
export const mapsLink = (lat: number, lon: number) => `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=18/${lat}/${lon}`;
export const metres = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);
