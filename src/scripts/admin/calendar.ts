import type { CalendarEvent } from '../../types/calendar';

export const MONTH_NAMES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

export const MONTH_NAMES_TITLE = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

export const WEEKDAY_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export const WEEKDAY_LONG = [
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
  'domingo',
];

export function parseDate(value: string | Date): Date {
  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day);
}

export function isoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDays(date: Date, amount: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + amount);
  return next;
}

export function addMonths(date: Date, amount: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth() + amount, 1);
  return next;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

/** La semana inicia en lunes. */
export function startOfWeek(date: Date): Date {
  const day = date.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  return addDays(date, offset);
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

export function monthGrid(date: Date): Date[] {
  const first = startOfWeek(startOfMonth(date));
  return Array.from({ length: 42 }, (_, index) => addDays(first, index));
}

export function weekDays(date: Date): Date[] {
  const first = startOfWeek(date);
  return Array.from({ length: 7 }, (_, index) => addDays(first, index));
}

export function formatMonthYear(date: Date): string {
  return `${MONTH_NAMES_TITLE[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatMonthYearLower(date: Date): string {
  return `${MONTH_NAMES[date.getMonth()]} de ${date.getFullYear()}`;
}

export function formatLongDate(date: Date): string {
  return `${WEEKDAY_LONG[(date.getDay() + 6) % 7]} ${date.getDate()} de ${MONTH_NAMES[date.getMonth()]}`;
}

export function formatDayShort(date: Date): string {
  return `${date.getDate()} ${MONTH_NAMES[date.getMonth()].slice(0, 3)}`;
}

export function formatTimeRange(start: string, end: string): string {
  return `${start} – ${end}`;
}

export function minutesFromTime(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0);
}

export function eventsForDay(events: CalendarEvent[], date: Date): CalendarEvent[] {
  const iso = isoDate(date);
  return events
    .filter((event) => event.date === iso)
    .sort((a, b) => minutesFromTime(a.startTime) - minutesFromTime(b.startTime));
}

export interface PositionedEvent {
  event: CalendarEvent;
  top: number;
  height: number;
  left: number;
  width: number;
}

/**
 * Distribuye los eventos de un día en columnas para que los solapamientos
 * sean visibles. Devuelve porcentajes relativos al rango horario visible.
 */
export function layoutDayEvents(
  events: CalendarEvent[],
  dayStartMinute = 7 * 60,
  dayEndMinute = 21 * 60,
): PositionedEvent[] {
  const total = Math.max(1, dayEndMinute - dayStartMinute);
  const sorted = events
    .map((event) => ({
      event,
      start: minutesFromTime(event.startTime),
      end: minutesFromTime(event.endTime),
    }))
    .filter((item) => item.end > dayStartMinute && item.start < dayEndMinute)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const clusters: typeof sorted[] = [];
  let current: typeof sorted = [];
  let clusterEnd = -1;

  sorted.forEach((item) => {
    if (current.length === 0) {
      current = [item];
      clusterEnd = item.end;
      return;
    }
    if (item.start < clusterEnd) {
      current.push(item);
      clusterEnd = Math.max(clusterEnd, item.end);
    } else {
      clusters.push(current);
      current = [item];
      clusterEnd = item.end;
    }
  });
  if (current.length > 0) clusters.push(current);

  const positioned: PositionedEvent[] = [];
  clusters.forEach((cluster) => {
    const columns: number[] = [];
    const assigned = cluster.map((item) => {
      let column = columns.findIndex((end) => end <= item.start);
      if (column === -1) {
        column = columns.length;
        columns.push(item.end);
      } else {
        columns[column] = item.end;
      }
      return { ...item, column };
    });
    const columnCount = Math.max(1, columns.length);
    assigned.forEach((item) => {
      const start = Math.max(item.start, dayStartMinute);
      const end = Math.min(item.end, dayEndMinute);
      positioned.push({
        event: item.event,
        top: ((start - dayStartMinute) / total) * 100,
        height: Math.max(3, ((end - start) / total) * 100),
        left: (item.column / columnCount) * 100,
        width: (1 / columnCount) * 100,
      });
    });
  });

  return positioned;
}

export function hourSlots(startHour = 7, endHour = 21): number[] {
  return Array.from({ length: endHour - startHour }, (_, index) => startHour + index);
}

export function formatDateTime(value: string | Date): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return `${formatShortDate(date)} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

export function formatShortDate(value: string | Date): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear().toString();
  return `${day}/${month}/${year}`;
}
