const businessTimezone =
  process.env.NEXT_PUBLIC_BUSINESS_TIMEZONE ?? "America/Lima";

export function businessDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: businessTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
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
