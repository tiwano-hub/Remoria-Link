export const yen = (n: number | null | undefined) =>
  n == null ? '-' : `¥${Number(n).toLocaleString('ja-JP')}`;

export const date = (d: string | Date | null | undefined) => {
  if (!d) return '-';
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(dt.getTime())) return '-';
  return dt.toLocaleDateString('ja-JP');
};

export const datetime = (d: string | Date | null | undefined) => {
  if (!d) return '-';
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(dt.getTime())) return '-';
  return dt.toLocaleString('ja-JP');
};

/** datetime-local 用に ISO を yyyy-MM-ddTHH:mm へ */
export const toLocalInput = (d: string | Date | null | undefined): string => {
  if (!d) return '';
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(dt.getTime())) return '';
  const off = dt.getTimezoneOffset();
  return new Date(dt.getTime() - off * 60000).toISOString().slice(0, 16);
};

export const pct = (n: number | null | undefined) => (n == null ? '-' : `${n}%`);
