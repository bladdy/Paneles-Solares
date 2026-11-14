import {
  addCalendarEvent,
  deleteCalendarEvent,
  getSession,
  hasPermission,
  loadState,
  setCalendarEventStatus,
  updateCalendarEvent,
  userName,
} from '../../services/store';
import type { CalendarEvent, CalendarEventInput, EventCategory, EventStatus } from '../../types/calendar';
import { EVENT_CATEGORY_VALUES, EVENT_STATUS_VALUES } from '../../types/calendar';
import { escapeHtml, safeJson } from '../../utils/format';
import {
  AGENDA_CATEGORY_CHIP,
  AGENDA_CATEGORY_DOT,
  AGENDA_CATEGORY_LABEL,
  EVENT_STATUS_CLASS,
  EVENT_STATUS_LABEL,
} from '../../utils/status';
import {
  addDays,
  addMonths,
  eventsForDay,
  formatLongDate,
  formatMonthYear,
  formatTimeRange,
  hourSlots,
  isToday,
  isoDate,
  layoutDayEvents,
  MONTH_NAMES,
  monthGrid,
  parseDate,
  weekDays,
  WEEKDAY_SHORT,
} from './calendar';
import { icon } from './icons';
import {
  assigneeDetailsHtml,
  assigneeSelectorHtml,
  bindAssigneeSelector,
  type AssigneeSelectorHandle,
} from './assignees';
import { avatarLetter, confirmDialog, openDrawer, openModal, toast, toastError } from './ui';

type AgendaView = 'dia' | 'semana' | 'mes';

interface AgendaFilters {
  assignees: string[];
  category: '' | EventCategory;
  status: '' | EventStatus;
}

const FILTERS_KEY = 'enersol.agenda.filters.v1';
const VIEW_KEY = 'enersol.agenda.view.v1';
const DAY_START_HOUR = 7;
const DAY_END_HOUR = 21;
const DAY_START_MINUTE = DAY_START_HOUR * 60;
const DAY_END_MINUTE = DAY_END_HOUR * 60;
const HOUR_PX = 56;

const state = {
  view: 'semana' as AgendaView,
  anchor: isoDate(new Date()),
  filters: { assignees: [], category: '', status: '' } as AgendaFilters,
  selector: null as AssigneeSelectorHandle | null,
};

/* ------------------------------------------------------------------ */
/* Permisos y datos                                                    */
/* ------------------------------------------------------------------ */

function can(action: 'crear' | 'editar' | 'eliminar' | 'asignar' | 'ver_todas'): boolean {
  const session = getSession();
  return session ? hasPermission(session.roleId, 'agenda', action) : false;
}

function activeUsers() {
  return loadState().users.filter((user) => user.status === 'activo');
}

/** Eventos que el rol actual tiene permitido ver y que pasan los filtros. */
function visibleEvents(): CalendarEvent[] {
  const me = getSession()?.userId ?? '';
  const onlyMine = !can('ver_todas');
  const { assignees, category, status } = state.filters;
  return loadState().calendarEvents.filter((event) => {
    if (onlyMine && !event.assigneeIds.includes(me)) return false;
    if (assignees.length > 0 && !event.assigneeIds.some((id) => assignees.includes(id))) return false;
    if (category && event.category !== category) return false;
    if (status && event.status !== status) return false;
    return true;
  });
}

function rangeDates(): Date[] {
  const anchor = parseDate(state.anchor);
  if (state.view === 'dia') return [anchor];
  if (state.view === 'semana') return weekDays(anchor);
  return monthGrid(anchor).filter((day) => day.getMonth() === anchor.getMonth());
}

function visibleInRange(): CalendarEvent[] {
  const days = new Set(rangeDates().map(isoDate));
  return visibleEvents().filter((event) => days.has(event.date));
}

/* ------------------------------------------------------------------ */
/* Barra de herramientas                                               */
/* ------------------------------------------------------------------ */

function periodLabel(): string {
  const anchor = parseDate(state.anchor);
  if (state.view === 'mes') return formatMonthYear(anchor);
  if (state.view === 'dia') return formatLongDate(anchor);
  const days = weekDays(anchor);
  const first = days[0];
  const last = days[days.length - 1];
  if (first.getMonth() === last.getMonth()) {
    return `${first.getDate()} – ${last.getDate()} de ${MONTH_NAMES[last.getMonth()]} de ${last.getFullYear()}`;
  }
  const short = (date: Date) => `${date.getDate()} ${MONTH_NAMES[date.getMonth()].slice(0, 3)}`;
  return `${short(first)} – ${short(last)} de ${last.getFullYear()}`;
}

function shiftAnchor(direction: 1 | -1): void {
  const anchor = parseDate(state.anchor);
  if (state.view === 'dia') state.anchor = isoDate(addDays(anchor, direction));
  else if (state.view === 'semana') state.anchor = isoDate(addDays(anchor, direction * 7));
  else state.anchor = isoDate(addMonths(anchor, direction));
}

function renderToolbar(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((button) => {
    button.classList.toggle('admin-segmented-active', button.dataset.view === state.view);
  });
  const period = document.getElementById('agenda-period');
  if (period) period.textContent = periodLabel();

  const categorySelect = document.getElementById('agenda-category-filter') as HTMLSelectElement | null;
  if (categorySelect && categorySelect.value !== state.filters.category) {
    categorySelect.value = state.filters.category;
  }
  const statusSelect = document.getElementById('agenda-status-filter') as HTMLSelectElement | null;
  if (statusSelect && statusSelect.value !== state.filters.status) {
    statusSelect.value = state.filters.status;
  }
}

function renderAssigneeFilter(): void {
  const container = document.getElementById('agenda-assignee-filter');
  if (!container) return;
  if (!can('ver_todas')) {
    container.innerHTML = '';
    container.classList.add('hidden');
    return;
  }
  container.classList.remove('hidden');

  const users = activeUsers();
  const events = visibleEvents();
  const chips: string[] = [
    `<button type="button" class="admin-chip ${state.filters.assignees.length === 0 ? 'admin-chip-active' : ''}" data-assignee-filter="">
      ${icon('users', 'h-3.5 w-3.5')} Todos
    </button>`,
  ];
  users.forEach((user) => {
    const name = `${user.firstName} ${user.lastName}`.trim();
    const selected = state.filters.assignees.includes(user.id);
    const count = events.filter((event) => event.assigneeIds.includes(user.id)).length;
    chips.push(`
      <button type="button" class="admin-chip ${selected ? 'admin-chip-active' : ''}" data-assignee-filter="${escapeHtml(user.id)}">
        <span class="admin-avatar h-5 w-5 text-[9px]" style="background-color:${escapeHtml(user.avatarColor)}">${escapeHtml(avatarLetter(name))}</span>
        <span class="max-w-[10rem] truncate">${escapeHtml(name)}</span>
        <span class="rounded-full bg-charcoal/5 px-1.5 text-[11px] font-semibold">${count}</span>
      </button>
    `);
  });

  container.innerHTML = chips.join('');
  container.querySelectorAll<HTMLButtonElement>('[data-assignee-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.dataset.assigneeFilter ?? '';
      if (id === '') {
        state.filters.assignees = [];
      } else if (state.filters.assignees.includes(id)) {
        state.filters.assignees = state.filters.assignees.filter((item) => item !== id);
      } else {
        state.filters.assignees = [...state.filters.assignees, id];
      }
      renderAssigneeFilter();
      renderCalendar();
    });
  });
}

function renderLegend(): void {
  const legend = document.getElementById('agenda-legend');
  if (!legend) return;
  legend.innerHTML = EVENT_CATEGORY_VALUES.map(
    (category) => `
      <span class="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted">
        <span class="h-2 w-2 rounded-full ${AGENDA_CATEGORY_DOT[category]}"></span>${AGENDA_CATEGORY_LABEL[category]}
      </span>
    `,
  ).join('');
}

/* ------------------------------------------------------------------ */
/* Vistas del calendario                                               */
/* ------------------------------------------------------------------ */

function hoursCount(): number {
  return DAY_END_HOUR - DAY_START_HOUR;
}

function timeGutterHtml(): string {
  return hourSlots(DAY_START_HOUR, DAY_END_HOUR)
    .map(
      (hour) =>
        `<div class="agenda-hour-label" style="height:${HOUR_PX}px"><span>${String(hour).padStart(2, '0')}:00</span></div>`,
    )
    .join('');
}

function hourLinesHtml(): string {
  return hourSlots(DAY_START_HOUR, DAY_END_HOUR)
    .map((hour) => `<div class="agenda-hour-line" style="top:${(hour - DAY_START_HOUR) * HOUR_PX}px"></div>`)
    .join('');
}

function nowLinePercent(): number {
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const total = DAY_END_MINUTE - DAY_START_MINUTE;
  return Math.min(100, Math.max(0, ((minutes - DAY_START_MINUTE) / total) * 100));
}

function nowLineHtml(): string {
  return `<div class="agenda-now-line" style="top:${nowLinePercent()}%"><span class="agenda-now-dot"></span></div>`;
}

function eventCardHtml(
  event: CalendarEvent,
  top: number,
  height: number,
  left: number,
  width: number,
  compact: boolean,
): string {
  const cancelled = event.status === 'cancelada';
  const label = `${formatTimeRange(event.startTime, event.endTime)} · ${event.title}`;
  const subtitle = event.location || AGENDA_CATEGORY_LABEL[event.category];
  const body = compact
    ? `<span class="block truncate text-[11px] font-semibold text-charcoal">${escapeHtml(label)}</span>`
    : `
      <span class="block truncate text-xs font-semibold text-charcoal">${escapeHtml(label)}</span>
      <span class="mt-0.5 block truncate text-[11px] text-muted">${escapeHtml(subtitle)}</span>
    `;
  return `
    <button
      type="button"
      class="agenda-event ${compact ? 'agenda-event-compact' : ''} ${cancelled ? 'agenda-event-cancelada' : ''}"
      style="top:${top}%;height:${height}%;left:${left}%;width:calc(${width}% - 2px);"
      data-event-id="${escapeHtml(event.id)}"
      aria-label="${escapeHtml(`${label}${event.location ? ` · ${event.location}` : ''}`)}"
    >
      <span class="agenda-event-bar ${AGENDA_CATEGORY_DOT[event.category]}" aria-hidden="true"></span>
      <span class="min-w-0 flex-1">${body}</span>
    </button>
  `;
}

function renderDayView(container: HTMLElement, events: CalendarEvent[]): void {
  const date = parseDate(state.anchor);
  const positioned = layoutDayEvents(eventsForDay(events, date), DAY_START_MINUTE, DAY_END_MINUTE);
  container.innerHTML = `
    <div class="agenda-day">
      <div class="agenda-time-gutter">${timeGutterHtml()}</div>
      <div class="agenda-day-body" style="height:${hoursCount() * HOUR_PX}px">
        ${hourLinesHtml()}
        ${isToday(date) ? nowLineHtml() : ''}
        ${positioned
          .map((item) => eventCardHtml(item.event, item.top, item.height, item.left, item.width, false))
          .join('')}
        ${
          positioned.length === 0
            ? '<p class="pointer-events-none absolute inset-0 flex items-center justify-center text-sm font-medium text-muted">Sin actividades programadas para este día.</p>'
            : ''
        }
      </div>
    </div>
  `;
  bindCalendarEvents(container);
}

function renderWeekView(container: HTMLElement, events: CalendarEvent[]): void {
  const days = weekDays(parseDate(state.anchor));
  container.innerHTML = `
    <div class="agenda-week">
      <div class="agenda-week-header">
        <div class="agenda-week-gutter" aria-hidden="true"></div>
        ${days
          .map((day) => {
            const index = (day.getDay() + 6) % 7;
            return `
              <button type="button" class="agenda-week-day ${isToday(day) ? 'agenda-week-day-today' : ''}" data-day="${isoDate(day)}" aria-label="Ver el ${formatLongDate(day)}">
                <span class="text-[11px] font-bold uppercase tracking-wider text-muted">${WEEKDAY_SHORT[index]}</span>
                <span class="agenda-week-day-number">${day.getDate()}</span>
              </button>
            `;
          })
          .join('')}
      </div>
      <div class="agenda-week-body-wrap admin-scroll">
        <div class="agenda-week-grid" style="height:${hoursCount() * HOUR_PX}px">
          <div class="agenda-time-gutter">${timeGutterHtml()}</div>
          ${days
            .map((day) => {
              const dayEvents = eventsForDay(events, day);
              const positioned = layoutDayEvents(dayEvents, DAY_START_MINUTE, DAY_END_MINUTE);
              return `
                <div class="agenda-week-column" style="height:${hoursCount() * HOUR_PX}px">
                  ${hourLinesHtml()}
                  ${isToday(day) ? nowLineHtml() : ''}
                  ${positioned
                    .map((item) => eventCardHtml(item.event, item.top, item.height, item.left, item.width, true))
                    .join('')}
                </div>
              `;
            })
            .join('')}
        </div>
      </div>
    </div>
  `;
  bindCalendarEvents(container);
}

function renderMonthView(container: HTMLElement, events: CalendarEvent[]): void {
  const anchor = parseDate(state.anchor);
  const todayIso = isoDate(new Date());
  container.innerHTML = `
    <div class="agenda-month">
      <div class="agenda-month-header">
        ${WEEKDAY_SHORT.map((day) => `<div class="agenda-month-weekday">${day}</div>`).join('')}
      </div>
      <div class="agenda-month-grid">
        ${monthGrid(anchor)
          .map((day) => {
            const iso = isoDate(day);
            const inMonth = day.getMonth() === anchor.getMonth();
            const dayEvents = eventsForDay(events, day);
            const shown = dayEvents.slice(0, 3);
            const rest = dayEvents.length - shown.length;
            return `
              <div class="agenda-month-cell ${inMonth ? '' : 'agenda-month-cell-out'}">
                <button type="button" class="agenda-month-date ${iso === todayIso ? 'agenda-month-date-today' : ''}" data-day="${iso}" aria-label="Ver el ${formatLongDate(day)}">
                  ${day.getDate()}
                </button>
                ${shown
                  .map(
                    (event) => `
                      <button type="button" class="agenda-month-chip" data-event-id="${escapeHtml(event.id)}" aria-label="${escapeHtml(event.title)}">
                        <span class="h-1.5 w-1.5 shrink-0 rounded-full ${AGENDA_CATEGORY_DOT[event.category]}" aria-hidden="true"></span>
                        <span class="truncate">${escapeHtml(event.title)}</span>
                      </button>
                    `,
                  )
                  .join('')}
                ${rest > 0 ? `<span class="agenda-month-more">+${rest} más</span>` : ''}
              </div>
            `;
          })
          .join('')}
      </div>
    </div>
  `;
  bindCalendarEvents(container);
}

function bindCalendarEvents(container: HTMLElement): void {
  container.querySelectorAll<HTMLElement>('[data-event-id]').forEach((element) => {
    element.addEventListener('click', (event) => {
      event.stopPropagation();
      openEventDrawer(element.dataset.eventId ?? '');
    });
  });
  container.querySelectorAll<HTMLElement>('[data-day]').forEach((element) => {
    element.addEventListener('click', () => {
      const day = element.dataset.day;
      if (!day) return;
      state.anchor = day;
      state.view = 'dia';
      renderAll();
    });
  });
}

function renderCalendar(): void {
  const container = document.getElementById('agenda-calendar');
  if (!container) return;
  const events = visibleInRange();
  if (state.view === 'dia') renderDayView(container, events);
  else if (state.view === 'semana') renderWeekView(container, events);
  else renderMonthView(container, events);

  const count = document.getElementById('agenda-count');
  if (count) {
    const total = visibleEvents().length;
    count.textContent = `${events.length} actividad${events.length === 1 ? '' : 'es'} en la vista · ${total} en total`;
  }
}

/* ------------------------------------------------------------------ */
/* Detalle de actividad                                                */
/* ------------------------------------------------------------------ */

function metaItem(iconSvg: string, label: string, value: string): string {
  return `
    <div class="flex items-start gap-3 rounded-xl border border-line bg-natural/60 p-3">
      <span class="mt-0.5 text-muted">${iconSvg}</span>
      <div class="min-w-0">
        <p class="text-[11px] font-bold uppercase tracking-wider text-muted">${label}</p>
        <p class="mt-0.5 text-sm font-medium text-charcoal">${value}</p>
      </div>
    </div>
  `;
}

function openEventDrawer(eventId: string): void {
  const data = loadState();
  const event = data.calendarEvents.find((item) => item.id === eventId);
  if (!event) return;
  const project = event.projectId ? data.projects.find((item) => item.id === event.projectId) : undefined;
  const canEdit = can('editar');
  const canDelete = can('eliminar');

  const drawer = openDrawer({
    title: event.title,
    subtitle: `${event.folio} · ${AGENDA_CATEGORY_LABEL[event.category]}`,
    size: 'lg',
    content: `
      <div class="space-y-5">
        <div class="flex flex-wrap items-center gap-2">
          <span class="admin-badge ${AGENDA_CATEGORY_CHIP[event.category]}">${AGENDA_CATEGORY_LABEL[event.category]}</span>
          <span class="admin-badge ${EVENT_STATUS_CLASS[event.status]}">${EVENT_STATUS_LABEL[event.status]}</span>
        </div>
        <div>
          <h3 class="font-display text-xl font-bold leading-snug text-forest">${escapeHtml(event.title)}</h3>
          ${
            event.description
              ? `<p class="mt-2 whitespace-pre-line text-sm leading-relaxed text-charcoal/80">${escapeHtml(event.description)}</p>`
              : ''
          }
        </div>
        <dl class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          ${metaItem(icon('calendar'), 'Fecha', escapeHtml(formatLongDate(parseDate(event.date))))}
          ${metaItem(icon('clock'), 'Horario', escapeHtml(formatTimeRange(event.startTime, event.endTime)))}
          ${metaItem(icon('mapPin'), 'Ubicación', escapeHtml(event.location || '—'))}
          ${
            project
              ? metaItem(icon('folder'), 'Proyecto', escapeHtml(`${project.folio} · ${project.name}`))
              : metaItem(icon('user'), 'Creado por', escapeHtml(userName(data, event.createdById)))
          }
        </dl>
        <div>
          <p class="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">Responsables</p>
          ${assigneeDetailsHtml(event.assigneeIds)}
        </div>
        ${
          event.notes
            ? `
              <div class="rounded-xl border border-line bg-natural/60 p-3">
                <p class="text-[11px] font-bold uppercase tracking-wider text-muted">Notas internas</p>
                <p class="mt-1 whitespace-pre-line text-sm text-charcoal/80">${escapeHtml(event.notes)}</p>
              </div>
            `
            : ''
        }
        <div>
          <p class="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">Cambiar estatus</p>
          <div class="flex flex-wrap gap-1.5">
            ${EVENT_STATUS_VALUES.map(
              (status) => `
                <button type="button" class="admin-chip ${status === event.status ? 'admin-chip-active' : ''}" data-set-status="${status}">
                  ${EVENT_STATUS_LABEL[status]}
                </button>
              `,
            ).join('')}
          </div>
        </div>
      </div>
    `,
    footer: `
      <div class="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          ${canDelete ? `<button type="button" class="admin-btn admin-btn-danger-soft" data-delete-event>${icon('trash', 'h-4 w-4')} Eliminar</button>` : ''}
        </div>
        <div class="flex gap-2">
          <button type="button" class="admin-btn admin-btn-secondary" data-overlay-close>Cerrar</button>
          ${canEdit ? `<button type="button" class="admin-btn admin-btn-primary" data-edit-event>${icon('pencil', 'h-4 w-4')} Editar</button>` : ''}
        </div>
      </div>
    `,
  });

  drawer.panel.querySelectorAll<HTMLButtonElement>('[data-set-status]').forEach((button) => {
    button.addEventListener('click', () => {
      const status = button.dataset.setStatus as EventStatus;
      try {
        setCalendarEventStatus(event.id, status);
        toast(`Estatus actualizado a “${EVENT_STATUS_LABEL[status]}”.`, 'success');
        drawer.close();
        renderAll();
      } catch (error) {
        toastError(error);
      }
    });
  });

  drawer.panel.querySelector<HTMLButtonElement>('[data-edit-event]')?.addEventListener('click', () => {
    drawer.close();
    openEventModal(event);
  });

  drawer.panel.querySelector<HTMLButtonElement>('[data-delete-event]')?.addEventListener('click', async () => {
    const confirmed = await confirmDialog({
      title: 'Eliminar actividad',
      message: `¿Eliminar “${event.title}”? Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      tone: 'danger',
    });
    if (!confirmed) return;
    try {
      deleteCalendarEvent(event.id);
      drawer.close();
      toast('Actividad eliminada.', 'success');
      renderAll();
    } catch (error) {
      toastError(error);
    }
  });
}

/* ------------------------------------------------------------------ */
/* Crear / editar actividad                                            */
/* ------------------------------------------------------------------ */

function defaultStartTime(): string {
  const hour = Math.min(20, Math.max(8, new Date().getHours() + 1));
  return `${String(hour).padStart(2, '0')}:00`;
}

function defaultEndTime(startTime: string): string {
  const hour = Number(startTime.split(':')[0]);
  if (!Number.isFinite(hour)) return '10:00';
  return `${String(Math.min(21, hour + 1)).padStart(2, '0')}:00`;
}

function categoryOptions(selected: EventCategory | ''): string {
  return EVENT_CATEGORY_VALUES.map(
    (value) => `<option value="${value}" ${value === selected ? 'selected' : ''}>${AGENDA_CATEGORY_LABEL[value]}</option>`,
  ).join('');
}

function statusOptions(selected: EventStatus | ''): string {
  return EVENT_STATUS_VALUES.map(
    (value) => `<option value="${value}" ${value === selected ? 'selected' : ''}>${EVENT_STATUS_LABEL[value]}</option>`,
  ).join('');
}

function projectOptions(selected: string | null): string {
  const projects = loadState().projects;
  return (
    `<option value="">Sin proyecto</option>` +
    projects
      .map(
        (project) =>
          `<option value="${escapeHtml(project.id)}" ${project.id === selected ? 'selected' : ''}>${escapeHtml(`${project.folio} · ${project.name}`)}</option>`,
      )
      .join('')
  );
}

function openEventModal(target?: CalendarEvent, presetDate?: string): void {
  const isEdit = Boolean(target);
  const me = getSession()?.userId ?? '';
  const initial: CalendarEventInput = target
    ? {
        title: target.title,
        description: target.description,
        category: target.category,
        projectId: target.projectId,
        assigneeIds: [...target.assigneeIds],
        date: target.date,
        startTime: target.startTime,
        endTime: target.endTime,
        location: target.location,
        status: target.status,
        notes: target.notes,
      }
    : {
        title: '',
        description: '',
        category: 'visita-tecnica',
        projectId: null,
        assigneeIds: me ? [me] : [],
        date: presetDate ?? state.anchor,
        startTime: defaultStartTime(),
        endTime: '',
        location: '',
        status: 'programada',
        notes: '',
      };
  if (!initial.endTime) initial.endTime = defaultEndTime(initial.startTime);

  const modal = openModal({
    title: isEdit ? 'Editar actividad' : 'Nueva actividad',
    subtitle: isEdit
      ? `Actualiza la información de ${target?.folio ?? ''}.`
      : 'Define la actividad, el horario y los responsables.',
    size: 'lg',
    content: `
      <form id="agenda-event-form" class="space-y-4">
        <div>
          <label class="admin-label" for="ev-title">Título *</label>
          <input id="ev-title" class="admin-input" required maxlength="120" value="${escapeHtml(initial.title)}" placeholder="Ej. Visita técnica a Clínica Sonrisa" />
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label class="admin-label" for="ev-category">Categoría *</label>
            <select id="ev-category" class="admin-select">${categoryOptions(initial.category)}</select>
          </div>
          <div>
            <label class="admin-label" for="ev-status">Estatus *</label>
            <select id="ev-status" class="admin-select">${statusOptions(initial.status)}</select>
          </div>
          <div>
            <label class="admin-label" for="ev-date">Fecha *</label>
            <input id="ev-date" type="date" class="admin-input" required value="${escapeHtml(initial.date)}" />
          </div>
          <div>
            <label class="admin-label" for="ev-project">Proyecto</label>
            <select id="ev-project" class="admin-select">${projectOptions(initial.projectId ?? null)}</select>
          </div>
          <div>
            <label class="admin-label" for="ev-start">Inicio *</label>
            <input id="ev-start" type="time" class="admin-input" required value="${escapeHtml(initial.startTime)}" />
          </div>
          <div>
            <label class="admin-label" for="ev-end">Fin *</label>
            <input id="ev-end" type="time" class="admin-input" required value="${escapeHtml(initial.endTime)}" />
          </div>
        </div>
        <div>
          <label class="admin-label" for="ev-location">Ubicación</label>
          <input id="ev-location" class="admin-input" value="${escapeHtml(initial.location)}" placeholder="Dirección, sucursal o enlace de videollamada" />
        </div>
        <div>
          <label class="admin-label" for="ev-description">Descripción</label>
          <textarea id="ev-description" class="admin-textarea" rows="3" placeholder="Objetivo de la actividad, acuerdos previos, material necesario…">${escapeHtml(initial.description)}</textarea>
        </div>
        <div>
          <label class="admin-label" for="ev-notes">Notas internas</label>
          <textarea id="ev-notes" class="admin-textarea" rows="2" placeholder="Comentarios visibles solo para el equipo">${escapeHtml(initial.notes ?? '')}</textarea>
        </div>
        <div>
          <span class="admin-label">Responsables *</span>
          <div data-assignee-root></div>
        </div>
      </form>
    `,
    footer: `
      <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" class="admin-btn admin-btn-secondary" data-overlay-close>Cancelar</button>
        <button type="submit" form="agenda-event-form" class="admin-btn admin-btn-primary">${isEdit ? 'Guardar cambios' : 'Crear actividad'}</button>
      </div>
    `,
  });

  const root = modal.panel.querySelector<HTMLElement>('[data-assignee-root]');
  if (root) {
    if (can('asignar')) {
      root.innerHTML = assigneeSelectorHtml(initial.assigneeIds);
      state.selector = bindAssigneeSelector(root.firstElementChild as HTMLElement, initial.assigneeIds);
    } else {
      state.selector = null;
      root.innerHTML =
        '<p class="rounded-lg border border-line bg-natural/70 p-3 text-xs text-muted">No tienes permiso para asignar responsables. La actividad se te asignará automáticamente a ti.</p>';
    }
  }

  const form = modal.panel.querySelector<HTMLFormElement>('#agenda-event-form');
  form?.addEventListener('submit', (submitEvent) => {
    submitEvent.preventDefault();
    const get = (id: string) =>
      (modal.panel.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`#${id}`)?.value ?? '').trim();
    const input: CalendarEventInput = {
      title: get('ev-title'),
      description: get('ev-description'),
      category: get('ev-category') as EventCategory,
      projectId: get('ev-project') || null,
      assigneeIds: state.selector ? state.selector.getSelected() : target ? [...target.assigneeIds] : me ? [me] : [],
      date: get('ev-date'),
      startTime: get('ev-start'),
      endTime: get('ev-end'),
      location: get('ev-location'),
      status: get('ev-status') as EventStatus,
      notes: get('ev-notes') || undefined,
    };
    if (input.assigneeIds.length === 0) {
      toast('Asigna al menos un responsable.', 'warning');
      return;
    }
    try {
      if (target) {
        updateCalendarEvent(target.id, input);
        toast('Actividad actualizada.', 'success');
      } else {
        const created = addCalendarEvent(input);
        toast(`Actividad ${created.folio} creada.`, 'success');
      }
      modal.close();
      state.anchor = input.date;
      renderAll();
    } catch (error) {
      toastError(error);
    }
  });
}

/* ------------------------------------------------------------------ */
/* Render general e inicialización                                     */
/* ------------------------------------------------------------------ */

function renderAll(): void {
  renderToolbar();
  renderAssigneeFilter();
  renderLegend();
  renderCalendar();
}

export function initAgenda(): void {
  const savedFilters = safeJson<Partial<AgendaFilters> | null>(window.sessionStorage.getItem(FILTERS_KEY), null);
  if (savedFilters) {
    if (Array.isArray(savedFilters.assignees)) {
      state.filters.assignees = savedFilters.assignees.filter((id): id is string => typeof id === 'string');
    }
    if (typeof savedFilters.category === 'string') {
      state.filters.category = (savedFilters.category || '') as AgendaFilters['category'];
    }
    if (typeof savedFilters.status === 'string') {
      state.filters.status = (savedFilters.status || '') as AgendaFilters['status'];
    }
  }
  const savedView = window.sessionStorage.getItem(VIEW_KEY);
  if (savedView === 'dia' || savedView === 'semana' || savedView === 'mes') state.view = savedView;

  document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((button) => {
    button.addEventListener('click', () => {
      const view = button.dataset.view as AgendaView | undefined;
      if (!view) return;
      state.view = view;
      renderAll();
    });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-nav]').forEach((button) => {
    button.addEventListener('click', () => {
      const nav = button.dataset.nav;
      if (nav === 'today') {
        state.anchor = isoDate(new Date());
      } else if (nav === 'next') {
        shiftAnchor(1);
      } else if (nav === 'prev') {
        shiftAnchor(-1);
      }
      renderAll();
    });
  });

  const categorySelect = document.getElementById('agenda-category-filter') as HTMLSelectElement | null;
  categorySelect?.addEventListener('change', () => {
    state.filters.category = (categorySelect.value || '') as AgendaFilters['category'];
    renderAssigneeFilter();
    renderCalendar();
  });

  const statusSelect = document.getElementById('agenda-status-filter') as HTMLSelectElement | null;
  statusSelect?.addEventListener('change', () => {
    state.filters.status = (statusSelect.value || '') as AgendaFilters['status'];
    renderAssigneeFilter();
    renderCalendar();
  });

  document.querySelectorAll<HTMLButtonElement>('[data-new-event]').forEach((button) => {
    if (can('crear')) button.removeAttribute('hidden');
    button.addEventListener('click', () => openEventModal());
  });

  renderAll();

  window.setInterval(() => {
    const line = document.querySelector<HTMLElement>('.agenda-now-line');
    if (line) line.style.top = `${nowLinePercent()}%`;
  }, 60_000);

  window.addEventListener('beforeunload', () => {
    window.sessionStorage.setItem(FILTERS_KEY, JSON.stringify(state.filters));
    window.sessionStorage.setItem(VIEW_KEY, state.view);
  });
}
