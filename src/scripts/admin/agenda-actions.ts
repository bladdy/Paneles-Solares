import type { CalendarEvent, CalendarEventInput } from '../../types/calendar';
import { loadState } from '../../services/store';

function now(): string {
  return new Date().toISOString();
}

function actorId(): string {
  const state = loadState();
  return state?.session?.userId ?? 'usr-admin';
}

export function addCalendarEvent(input: CalendarEventInput): CalendarEvent {
  const state = loadState();
  state.counters.evento += 1;
  const id = `AGE-2026-${String(state.counters.evento).padStart(3, '0')}`;
  const timestamp = now();
  const event: CalendarEvent = {
    id,
    folio: id,
    title: input.title.trim(),
    description: input.description.trim(),
    category: input.category,
    projectId: input.projectId || null,
    assigneeIds: Array.from(new Set(input.assigneeIds.filter(Boolean))),
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime,
    location: input.location.trim(),
    status: input.status,
    notes: input.notes?.trim() || undefined,
    createdById: actorId(),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  state.calendarEvents.unshift(event);
  return event;
}

export function updateCalendarEvent(id: string, input: CalendarEventInput): CalendarEvent {
  const state = loadState();
  const event = state.calendarEvents.find((item) => item.id === id);
  if (!event) throw new Error('La actividad no existe.');
  event.title = input.title.trim();
  event.description = input.description.trim();
  event.category = input.category;
  event.projectId = input.projectId || null;
  event.assigneeIds = Array.from(new Set(input.assigneeIds.filter(Boolean)));
  event.date = input.date;
  event.startTime = input.startTime;
  event.endTime = input.endTime;
  event.location = input.location.trim();
  event.status = input.status;
  event.notes = input.notes?.trim() || undefined;
  event.updatedAt = now();
  return event;
}

export function setCalendarEventStatus(id: string, status: CalendarEvent['status']): void {
  const state = loadState();
  const event = state.calendarEvents.find((item) => item.id === id);
  if (!event) throw new Error('La actividad no existe.');
  event.status = status;
  event.updatedAt = now();
}

export function deleteCalendarEvent(id: string): void {
  const state = loadState();
  const event = state.calendarEvents.find((item) => item.id === id);
  if (!event) throw new Error('La actividad no existe.');
  state.calendarEvents = state.calendarEvents.filter((item) => item.id !== id);
}