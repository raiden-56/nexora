export function relTime(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "never";
  const diff = Math.round((now - Date.parse(iso)) / 1000);
  const abs = Math.abs(diff);
  const fut = diff < 0;
  const f = (n: number, u: string) => (fut ? `in ${n}${u}` : `${n}${u} ago`);
  if (abs < 45) return fut ? "in a moment" : "just now";
  if (abs < 3600) return f(Math.round(abs / 60), "m");
  if (abs < 86400) return f(Math.round(abs / 3600), "h");
  if (abs < 86400 * 7) return f(Math.round(abs / 86400), "d");
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function timeIn(iso: string, tz: string, opts: Intl.DateTimeFormatOptions = {}) {
  return new Date(iso).toLocaleString("en-IN", { timeZone: tz, hour: "numeric", minute: "2-digit", ...opts });
}

export function money(n: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: n < 100 ? 2 : 0 }).format(n);
}

export function kwh(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(2)} MWh` : `${n.toFixed(n < 10 ? 2 : 1)} kWh`;
}

export function watts(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(2)} kW` : `${Math.round(n)} W`;
}

export const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function daysLabel(days: number[]) {
  const s = [...days].sort();
  if (s.length === 7) return "Every day";
  if (s.join() === "1,2,3,4,5") return "Weekdays";
  if (s.join() === "0,6") return "Weekends";
  return s.map((d) => DAYS_SHORT[d]).join(", ");
}

export function to12h(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ap}`;
}

export function greeting(tz: string) {
  const h = Number(new Date().toLocaleString("en-US", { timeZone: tz, hour: "numeric", hourCycle: "h23" }));
  return h < 5 ? "Good evening" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(" ");
