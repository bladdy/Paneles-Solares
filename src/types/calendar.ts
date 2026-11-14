export const EVENT_CATEGORY_VALUES = [
  'visita-tecnica',
  'levantamiento',
  'instalacion',
  'mantenimiento',
  'reunion-cliente',
  'reunion-interna',
  'entrega-materiales',
  'inspeccion',
  'seguimiento-comercial',
  'otro',
] as const;
export type EventCategory = (typeof EVENT_CATEGORY_VALUES)[number];

export const EVENT_STATUS_VALUES = [
  'programada',
  'confirmada',
  'en-curso',
  'completada',
  'cancelada',
] as const;
export type EventStatus = (typeof EVENT_STATUS_VALUES)[number];

export interface CalendarEvent {
  id: string;
  folio: string;
  title: string;
  description: string;
  category: EventCategory;
  projectId: string | null;
  assigneeIds: string[];
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  status: EventStatus;
  notes?: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarEventInput {
  title: string;
  description: string;
  category: EventCategory;
  projectId?: string | null;
  assigneeIds: string[];
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  status: EventStatus;
  notes?: string;
}
