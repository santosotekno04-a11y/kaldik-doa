import { format, parseISO, isValid, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from "date-fns";
import { id } from "date-fns/locale";

export function formatDate(date: Date | string, pattern: string = "yyyy-MM-dd"): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return isValid(d) ? format(d, pattern) : "";
}

export function formatDateDisplay(date: Date | string): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return isValid(d) ? format(d, "d MMM yyyy", { locale: id }) : "";
}

export function getDaysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

export function getMonthName(month: number): string {
  const date = new Date(2024, month - 1, 1);
  return format(date, "MMMM", { locale: id });
}

export function getDayName(date: Date): string {
  return format(date, "EEEE", { locale: id });
}

export function isDateInRange(date: Date, start: Date, end: Date): boolean {
  return date >= start && date <= end;
}

export function getMonthDays(month: number, year: number): Date[] {
  const start = startOfMonth(new Date(year, month - 1));
  const end = endOfMonth(new Date(year, month - 1));
  return eachDayOfInterval({ start, end });
}

export function getFirstDayOfMonth(month: number, year: number): number {
  return getDay(new Date(year, month - 1, 1));
}

export function getSemesterFromMonth(month: number): 1 | 2 {
  return month >= 7 ? 1 : 2;
}

export function getCurrentTahunAjaran(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  if (month >= 7) {
    return `${year}-${year + 1}`;
  }
  return `${year - 1}-${year}`;
}

// ============================================================
// Parse tanggal Indonesia → Date object
// Mendukung format: "12 Juli 2026 HUT SKL", "7 Juli 2026", "Juli 2026", "12/07/2026"
// ============================================================

const BULAN_MAP: Record<string, number> = {
  'januari': 1, 'jan': 1,
  'februari': 2, 'feb': 2,
  'maret': 3, 'mar': 3,
  'april': 4, 'apr': 4,
  'mei': 5,
  'juni': 6, 'jun': 6,
  'juli': 7, 'jul': 7,
  'agustus': 8, 'agu': 8, 'ags': 8,
  'september': 9, 'sep': 9,
  'oktober': 10, 'okt': 10,
  'november': 11, 'nov': 11,
  'desember': 12, 'des': 12,
};

/**
 * Parse tanggal dari teks Indonesia menjadi Date object
 * Contoh input: "12 Juli 2026 HUT SKL", "7 Juli 2026", "12/07/2026"
 * Returns: Date object atau null jika gagal parse
 */
export function parseTanggalIndonesia(text: string): Date | null {
  if (!text || typeof text !== 'string') return null;

  const cleaned = text.trim();

  // Format DD/MM/YYYY atau DD-MM-YYYY
  const slashMatch = cleaned.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (slashMatch) {
    const day = parseInt(slashMatch[1]);
    const month = parseInt(slashMatch[2]);
    const year = parseInt(slashMatch[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return new Date(year, month - 1, day);
    }
  }

  // Format "DD NamaBulan YYYY" (dengan atau tanpa teks tambahan)
  // Regex: angka 1-2 digit, spasi, nama bulan, spasi, 4 digit tahun
  const indoMatch = cleaned.match(/(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})/i);
  if (indoMatch) {
    const day = parseInt(indoMatch[1]);
    const monthName = indoMatch[2].toLowerCase();
    const year = parseInt(indoMatch[3]);
    const month = BULAN_MAP[monthName];
    if (month && day >= 1 && day <= 31) {
      return new Date(year, month - 1, day);
    }
  }

  // Format "NamaBulan YYYY" (bulan saja, default tanggal 1)
  const monthOnlyMatch = cleaned.match(/^([a-zA-Z]+)\s+(\d{4})$/i);
  if (monthOnlyMatch) {
    const monthName = monthOnlyMatch[1].toLowerCase();
    const year = parseInt(monthOnlyMatch[2]);
    const month = BULAN_MAP[monthName];
    if (month) {
      return new Date(year, month - 1, 1);
    }
  }

  // Format "YYYY-MM-DD" (ISO)
  const isoMatch = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
  }

  return null;
}

/**
 * Parse tanggal dan return sebagai string YYYY-MM-DD untuk database
 */
export function parseTanggalToISO(text: string): string | null {
  const date = parseTanggalIndonesia(text);
  if (!date || !isValid(date)) return null;
  return format(date, 'yyyy-MM-dd');
}

/**
 * Format Date ke tampilan Indonesia yang konsisten: "12 Juli 2026"
 */
export function formatDateIndonesia(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return isValid(d) ? format(d, 'd MMMM yyyy', { locale: id }) : '';
}

/**
 * Ambil nama bulan dari teks tanggal Indonesia
 * Contoh: "12 Juli 2026 HUT SKL" → "JULI"
 */
export function extractBulanFromTanggal(text: string): string {
  if (!text) return '';
  const match = text.match(/(\d{1,2})\s+([a-zA-Z]+)/i);
  if (match) {
    const monthName = match[2].toLowerCase();
    const month = BULAN_MAP[monthName];
    if (month) {
      return getMonthName(month).toUpperCase();
    }
  }
  // Coba match bulan saja
  for (const [name, num] of Object.entries(BULAN_MAP)) {
    if (text.toLowerCase().includes(name)) {
      return getMonthName(num).toUpperCase();
    }
  }
  return '';
}
