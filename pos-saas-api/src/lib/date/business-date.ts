const businessTimezone =
  process.env.NEXT_PUBLIC_BUSINESS_TIMEZONE ?? "America/Lima";

function timeZoneOffsetMinutes(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: businessTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const localAsUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );
  return (localAsUtc - date.getTime()) / 60000;
}

export function businessDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: businessTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function isValidBusinessDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

export function businessDateOffset(offsetDays: number) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: businessTimezone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return businessDate(new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day) + offsetDays, 12)));
}

export function businessDayRange(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const startGuess = new Date(Date.UTC(year, month - 1, day));
  const endGuess = new Date(Date.UTC(year, month - 1, day + 1));
  const start = new Date(startGuess.getTime() - timeZoneOffsetMinutes(startGuess) * 60000);
  const end = new Date(endGuess.getTime() - timeZoneOffsetMinutes(endGuess) * 60000);
  return { start, end };
}
