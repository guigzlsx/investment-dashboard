function excelSerialToDate(serial: number) {
  const utc = new Date(Date.UTC(1899, 11, 30) + serial * 86_400_000);
  return Number.isNaN(utc.getTime()) ? null : utc;
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10) + "T00:00:00.000Z";
}

export function parseImportDate(value: unknown): { value: string | null; ambiguous: boolean } {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? { value: null, ambiguous: false } : { value: isoDate(value), ambiguous: false };
  if (typeof value === "number") {
    const date = excelSerialToDate(value);
    return date ? { value: isoDate(date), ambiguous: false } : { value: null, ambiguous: false };
  }
  if (value === null || value === undefined) return { value: null, ambiguous: false };
  const text = String(value).trim();
  if (!text) return { value: null, ambiguous: false };
  if (/^\d{4}-\d{2}-\d{2}(?:[T ].*)?$/.test(text)) {
    const date = new Date(text.length === 10 ? `${text}T00:00:00Z` : text);
    return Number.isNaN(date.getTime()) ? { value: null, ambiguous: false } : { value: isoDate(date), ambiguous: false };
  }
  const match = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (!match) return { value: null, ambiguous: false };
  const first = Number(match[1]);
  const second = Number(match[2]);
  let year = Number(match[3]);
  if (year < 100) year += 2000;
  if (first <= 12 && second <= 12) return { value: null, ambiguous: true };
  const day = first > 12 ? first : second;
  const month = first > 12 ? second : first;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return { value: null, ambiguous: false };
  return { value: isoDate(date), ambiguous: false };
}
