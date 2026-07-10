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
