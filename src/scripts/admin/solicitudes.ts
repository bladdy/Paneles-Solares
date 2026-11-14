import {
  addSolicitud,
  assignSolicitud,
  convertSolicitudToProject,
  getSession,
  hasPermission,
  loadState,
  recalculateSolicitud,
  rejectSolicitud,
  roleById,
  userName,
} from '../../services/store';
import type { ProjectType, SystemType } from '../../types/solar';
import type { RequestStatus, Solicitud, User } from '../../types/admin';
import {
  daysUntil,
  escapeHtml,
  formatCurrency,
  formatDate,
  formatKwh,
  formatNumber,
  safeJson,
  toDateInput,
} from '../../utils/format';
import {
  PROJECT_TYPE_LABEL,
  REQUEST_STATUS_CLASS,
  REQUEST_STATUS_LABEL,
  REQUEST_STATUS_ORDER,
  SYSTEM_TYPE_LABEL,
} from '../../utils/status';
import { PROJECT_TYPE_OPTIONS } from '../../data/cotizador-defaults';
import { icon } from './icons';
import {
  confirmDialog,
  downloadText,
  emptyStateHtml,
  openModal,
  setButtonLoading,
  toast,
  toastError,
  avatarLetter,
} from './ui';

type StatusFilter = 'todas' | 'pendientes' | 'cotizadas' | 'aceptadas' | 'convertidas' | 'rechazadas';

interface Filters {
  search: string;
  status: StatusFilter | RequestStatus;
  type: ProjectType | 'todos';
  responsible: string;
  source: 'todas' | 'sitio-publico' | 'manual';
  sort: 'createdAt' | 'client' | 'total' | 'status';
  dir: 'asc' | 'desc';
  page: number;
}

const PAGE_SIZE = 8;

const state = {
  filters: {
    search: '',
    status: 'todas',
    type: 'todos',
    responsible: 'todos',
    source: 'todas',
    sort: 'createdAt',
    dir: 'desc',
    page: 1,
  } as Filters,
  list: [] as Solicitud[],
};

function statusMatches(request: Solicitud, filter: string): boolean {
  if (filter === 'todas') return true;
  if (filter === 'pendientes') return ['nueva', 'en-revision', 'pendiente-info'].includes(request.status);
  if (filter === 'cotizadas') return ['cotizacion-calculada', 'cotizacion-enviada'].includes(request.status);
  if (filter === 'aceptadas') return request.status === 'aceptada';
  if (filter === 'convertidas') return request.status === 'convertida';
  if (filter === 'rechazadas') return request.status === 'rechazada';
  return request.status === filter;
}

function filtered(): Solicitud[] {
  const data = loadState();
  const f = state.filters;
  const term = f.search.trim().toLowerCase();
  const result = data.solicitudes.filter((request) => {
    if (!statusMatches(request, f.status)) return false;
    if (f.type !== 'todos' && request.energy.projectType !== f.type) return false;
    if (f.responsible !== 'todos') {
      if (f.responsible === 'sin-asignar' && request.responsibleUserId) return false;
      if (f.responsible !== 'sin-asignar' && request.responsibleUserId !== f.responsible) return false;
    }
    if (f.source !== 'todas' && request.source !== f.source) return false;
    if (!term) return true;
    return [
      request.folio,
      request.client.name,
      request.client.company ?? '',
      request.client.email,
      request.client.phone,
      request.client.location,
      request.energy.projectType,
    ]
      .join(' ')
      .toLowerCase()
      .includes(term);
  });

  result.sort((a, b) => {
    let comparison = 0;
    switch (f.sort) {
      case 'client':
        comparison = a.client.name.localeCompare(b.client.name);
        break;
      case 'total':
        comparison = a.calculation.total - b.calculation.total;
        break;
      case 'status':
        comparison = REQUEST_STATUS_ORDER.indexOf(a.status) - REQUEST_STATUS_ORDER.indexOf(b.status);
        break;
      default:
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
    return f.dir === 'asc' ? comparison : -comparison;
  });

  return result;
}

function statusChipClass(active: boolean): string {
  return active ? 'admin-chip admin-chip-active' : 'admin-chip';
}

function renderFilters(): void {
  const container = document.getElementById('request-status-chips');
  if (!container) return;
  const all = loadState().solicitudes;
  const chips: Array<{ key: StatusFilter; label: string; count: number }> = [
    { key: 'todas', label: 'Todas', count: all.length },
    {
      key: 'pendientes',
      label: 'Pendientes',
      count: all.filter((item) => statusMatches(item, 'pendientes')).length,
    },
    {
      key: 'cotizadas',
      label: 'Cotizadas',
      count: all.filter((item) => statusMatches(item, 'cotizadas')).length,
    },
    {
      key: 'aceptadas',
      label: 'Aceptadas',
      count: all.filter((item) => statusMatches(item, 'aceptadas')).length,
    },
    {
      key: 'convertidas',
      label: 'Convertidas',
      count: all.filter((item) => statusMatches(item, 'convertidas')).length,
    },
    {
      key: 'rechazadas',
      label: 'Rechazadas',
      count: all.filter((item) => statusMatches(item, 'rechazadas')).length,
    },
  ];
  container.innerHTML = chips
    .map(
      (chip) =>
        `<button type="button" class="${statusChipClass(state.filters.status === chip.key)}" data-status-chip="${chip.key}">
          ${chip.label}
          <span class="rounded-full bg-charcoal/5 px-1.5 text-[11px] font-semibold">${chip.count}</span>
        </button>`,
    )
    .join('');
  container.querySelectorAll<HTMLButtonElement>('[data-status-chip]').forEach((button) => {
    button.addEventListener('click', () => {
      state.filters.status = button.dataset.statusChip as StatusFilter;
      state.filters.page = 1;
      render();
    });
  });
}

function responsibleOptions(selected: string): string {
  const data = loadState();
  return data.users
    .filter((user) => ['rol-comercial', 'rol-gerente'].includes(user.roleId) && user.status === 'activo')
    .map(
      (user) =>
        `<option value="${user.id}" ${user.id === selected ? 'selected' : ''}>${escapeHtml(
          `${user.firstName} ${user.lastName}`,
        )}</option>`,
    )
    .join('');
}

function sortIndicator(field: Filters['sort']): string {
  if (state.filters.sort !== field) {
    return `<span class="text-muted/40">${icon('sort', 'h-3 w-3')}</span>`;
  }
  return `<span class="text-forest">${icon(state.filters.dir === 'asc' ? 'chevronUp' : 'chevronDown', 'h-3 w-3')}</span>`;
}

function rowActions(request: Solicitud): string {
  const actions: string[] = [
    `<a href="/admin/solicitudes/${request.id}" class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-charcoal hover:bg-natural" role="menuitem">
      ${icon('eye', 'h-4 w-4 text-muted')} Ver detalle
    </a>`,
  ];
  if (['nueva', 'en-revision', 'pendiente-info', 'cotizacion-calculada'].includes(request.status)) {
    actions.push(`<button type="button" data-action="assign" data-id="${request.id}" class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-charcoal hover:bg-natural" role="menuitem">
      ${icon('userPlus', 'h-4 w-4 text-muted')} Asignar responsable
    </button>`);
  }
  actions.push(`<button type="button" data-action="recalculate" data-id="${request.id}" class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-charcoal hover:bg-natural" role="menuitem">
    ${icon('refresh', 'h-4 w-4 text-muted')} Recalcular cotización
  </button>`);
  if (request.status === 'aceptada') {
    actions.push(`<button type="button" data-action="convert" data-id="${request.id}" class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-forest hover:bg-natural" role="menuitem">
      ${icon('arrowRight', 'h-4 w-4')} Convertir en proyecto
    </button>`);
  }
  if (!['convertida', 'rechazada'].includes(request.status)) {
    actions.push(`<button type="button" data-action="reject" data-id="${request.id}" class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-danger hover:bg-danger-soft" role="menuitem">
      ${icon('xCircle', 'h-4 w-4')} Rechazar
    </button>`);
  }
  return actions.join('');
}

function renderTable(): void {
  const container = document.getElementById('requests-table');
  if (!container) return;
  const data = loadState();
  const rows = state.list;
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  state.filters.page = Math.min(state.filters.page, totalPages);
  const start = (state.filters.page - 1) * PAGE_SIZE;
  const pageRows = rows.slice(start, start + PAGE_SIZE);

  const count = document.getElementById('requests-count');
  if (count) {
    count.textContent = `${formatNumber(rows.length)} solicitud${rows.length === 1 ? '' : 'es'}`;
  }

  if (rows.length === 0) {
    container.innerHTML = emptyStateHtml({
      iconName: 'search',
      title: 'No encontramos solicitudes',
      description: 'Ajusta los filtros o registra una nueva solicitud para comenzar.',
      action: '<button type="button" class="admin-btn admin-btn-primary admin-btn-sm" data-open-new>Solicitar cotización</button>',
    });
    document.getElementById('requests-pagination')?.setAttribute('hidden', '');
    attachRowEvents();
    return;
  }
  document.getElementById('requests-pagination')?.removeAttribute('hidden');

  container.innerHTML = `
    <div class="overflow-x-auto">
      <table class="admin-table min-w-[1040px]">
        <thead>
          <tr>
            <th><button type="button" class="admin-table-sort" data-sort="createdAt">Folio ${sortIndicator('createdAt')}</button></th>
            <th><button type="button" class="admin-table-sort" data-sort="client">Cliente ${sortIndicator('client')}</button></th>
            <th>Tipo de proyecto</th>
            <th>Consumo</th>
            <th><button type="button" class="admin-table-sort" data-sort="total">Inversión ${sortIndicator('total')}</button></th>
            <th><button type="button" class="admin-table-sort" data-sort="status">Estado ${sortIndicator('status')}</button></th>
            <th>Responsable</th>
            <th class="w-12 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${pageRows
            .map((request) => {
              const responsible = data.users.find((user) => user.id === request.responsibleUserId);
              return `
                <tr>
                  <td>
                    <a href="/admin/solicitudes/${request.id}" class="font-mono text-xs font-semibold text-forest hover:underline">${escapeHtml(request.folio)}</a>
                    <span class="mt-0.5 block text-[11px] text-muted">${formatDate(request.createdAt)}</span>
                  </td>
                  <td class="max-w-[220px]">
                    <p class="truncate font-semibold text-charcoal">${escapeHtml(request.client.name)}</p>
                    <p class="truncate text-xs text-muted">${escapeHtml(request.client.company || request.client.location)}</p>
                  </td>
                  <td>
                    <span class="admin-badge border-line bg-natural text-charcoal">${escapeHtml(PROJECT_TYPE_LABEL[request.energy.projectType])}</span>
                    <span class="mt-1 block text-[11px] text-muted">${escapeHtml(SYSTEM_TYPE_LABEL[request.systemType])}</span>
                  </td>
                  <td class="whitespace-nowrap text-sm">
                    ${formatKwh(request.energy.monthlyConsumptionKwh)}
                    <span class="block text-[11px] text-muted">${formatNumber(request.calculation.installedCapacityKwp)} kWp</span>
                  </td>
                  <td class="whitespace-nowrap font-semibold">${formatCurrency(request.calculation.total)}</td>
                  <td><span class="admin-badge ${REQUEST_STATUS_CLASS[request.status]}">${REQUEST_STATUS_LABEL[request.status]}</span></td>
                  <td>
                    ${
                      responsible
                        ? `<span class="flex items-center gap-2"><span class="admin-avatar h-7 w-7 text-[10px]" style="background-color:${responsible.avatarColor}">${escapeHtml(
                            avatarLetter(`${responsible.firstName} ${responsible.lastName}`),
                          )}</span><span class="max-w-[120px] truncate text-xs font-medium">${escapeHtml(
                            `${responsible.firstName} ${responsible.lastName}`,
                          )}</span></span>`
                        : '<span class="text-xs italic text-muted">Sin asignar</span>'
                    }
                  </td>
                  <td class="text-right">
                    <div class="relative inline-block" data-row-menu>
                      <button type="button" class="admin-icon-btn" data-menu-button aria-haspopup="true" aria-expanded="false" aria-label="Acciones de ${escapeHtml(request.folio)}">
                        ${icon('more', 'h-4 w-4')}
                      </button>
                      <div class="absolute right-0 top-full z-30 mt-1 hidden w-56 overflow-hidden rounded-xl border border-line bg-white p-1.5 text-left shadow-xl" data-menu role="menu">
                        ${rowActions(request)}
                      </div>
                    </div>
                  </td>
                </tr>
              `;
            })
            .join('')}
        </tbody>
      </table>
    </div>
  `;

  const info = document.getElementById('requests-range');
  if (info) {
    info.textContent = `Mostrando ${start + 1}–${Math.min(start + PAGE_SIZE, rows.length)} de ${rows.length}`;
  }
  const pageLabel = document.getElementById('requests-page-label');
  if (pageLabel) pageLabel.textContent = `Página ${state.filters.page} de ${totalPages}`;

  container.querySelectorAll<HTMLButtonElement>('[data-sort]').forEach((button) => {
    button.addEventListener('click', () => {
      const field = button.dataset.sort as Filters['sort'];
      if (state.filters.sort === field) {
        state.filters.dir = state.filters.dir === 'asc' ? 'desc' : 'asc';
      } else {
        state.filters.sort = field;
        state.filters.dir = field === 'createdAt' ? 'desc' : 'asc';
      }
      render();
    });
  });

  attachRowEvents();
}

function attachRowEvents(): void {
  document.querySelectorAll<HTMLElement>('[data-row-menu]').forEach((menu) => {
    const button = menu.querySelector<HTMLButtonElement>('[data-menu-button]');
    const panel = menu.querySelector<HTMLElement>('[data-menu]');
    if (!button || !panel) return;
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const isOpen = !panel.classList.contains('hidden');
      document.querySelectorAll<HTMLElement>('[data-menu]').forEach((other) => other.classList.add('hidden'));
      document.querySelectorAll<HTMLButtonElement>('[data-menu-button]').forEach((other) => other.setAttribute('aria-expanded', 'false'));
      panel.classList.toggle('hidden', isOpen);
      button.setAttribute('aria-expanded', String(!isOpen));
    });
    panel.querySelectorAll<HTMLElement>('[data-action]').forEach((action) => {
      action.addEventListener('click', () => {
        panel.classList.add('hidden');
        button.setAttribute('aria-expanded', 'false');
        const id = action.dataset.id ?? '';
        const request = loadState().solicitudes.find((item) => item.id === id);
        if (!request) return;
        switch (action.dataset.action) {
          case 'assign':
            openAssignModal(request);
            break;
          case 'recalculate':
            handleRecalculate(request);
            break;
          case 'convert':
            openConvertModal(request);
            break;
          case 'reject':
            openRejectModal(request);
            break;
        }
      });
    });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-open-new]').forEach((button) => {
    button.addEventListener('click', openNewRequestModal);
  });
  document.querySelectorAll<HTMLButtonElement>('[data-action="view"]').forEach((button) => {
    button.addEventListener('click', () => {
      window.location.href = `/admin/solicitudes/${button.dataset.id}`;
    });
  });
}

function handleRecalculate(request: Solicitud): void {
  try {
    const updated = recalculateSolicitud(request.id);
    toast(`La cotización de ${request.folio} se actualizó a ${formatCurrency(updated.calculation.total)}.`, 'success');
    render();
  } catch (error) {
    toastError(error);
  }
}

/* ------------------------------------------------------------------ */
/* Modales                                                             */
/* ------------------------------------------------------------------ */

function optionsForUsers(predicate: (user: User) => boolean, selected = ''): string {
  return loadState()
    .users.filter(predicate)
    .map(
      (user) =>
        `<option value="${user.id}" ${user.id === selected ? 'selected' : ''}>${escapeHtml(
          `${user.firstName} ${user.lastName} · ${user.jobTitle}`,
        )}</option>`,
    )
    .join('');
}

export function openAssignModal(request: Solicitud, onDone?: () => void): void {
  const modal = openModal({
    title: 'Asignar responsable',
    subtitle: `${request.folio} · ${request.client.name}`,
    content: `
      <form id="assign-form" class="space-y-4">
        <div>
          <label class="admin-label" for="assign-user">Responsable comercial</label>
          <select id="assign-user" class="admin-select" required>
            <option value="">Selecciona un integrante</option>
            ${optionsForUsers(
              (user) => ['rol-comercial', 'rol-gerente'].includes(user.roleId) && user.status === 'activo',
              request.responsibleUserId ?? '',
            )}
          </select>
        </div>
        <div>
          <label class="admin-label" for="assign-note">Nota (opcional)</label>
          <textarea id="assign-note" class="admin-textarea" rows="3" placeholder="Contexto para el responsable…"></textarea>
        </div>
      </form>
    `,
    footer: `
      <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" class="admin-btn admin-btn-secondary" data-overlay-close>Cancelar</button>
        <button type="submit" form="assign-form" class="admin-btn admin-btn-primary">Guardar asignación</button>
      </div>
    `,
    size: 'sm',
  });

  modal.panel.querySelector<HTMLFormElement>('#assign-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const select = modal.panel.querySelector<HTMLSelectElement>('#assign-user');
    const note = modal.panel.querySelector<HTMLTextAreaElement>('#assign-note');
    if (!select?.value) {
      toast('Selecciona un responsable.', 'warning');
      return;
    }
    try {
      assignSolicitud(request.id, select.value, note?.value.trim());
      modal.close();
      toast('Responsable asignado correctamente.', 'success');
      render();
      onDone?.();
    } catch (error) {
      toastError(error);
    }
  });
}

export function openRejectModal(request: Solicitud, onDone?: () => void): void {
  const modal = openModal({
    title: 'Rechazar solicitud',
    subtitle: `${request.folio} · ${request.client.name}`,
    content: `
      <form id="reject-form" class="space-y-4">
        <p class="rounded-lg border border-danger/20 bg-danger-soft/60 p-3 text-xs leading-relaxed text-charcoal/80">
          El rechazo quedará registrado en la bitácora. Puedes consultar el motivo después en el detalle de la solicitud.
        </p>
        <div>
          <label class="admin-label" for="reject-reason">Motivo del rechazo</label>
          <textarea id="reject-reason" class="admin-textarea" rows="4" required placeholder="Ej. El cliente eligió otra propuesta…"></textarea>
          <p class="admin-error-text hidden" id="reject-error">Ingresa el motivo del rechazo.</p>
        </div>
      </form>
    `,
    footer: `
      <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" class="admin-btn admin-btn-secondary" data-overlay-close>Cancelar</button>
        <button type="submit" form="reject-form" class="admin-btn admin-btn-danger">Rechazar solicitud</button>
      </div>
    `,
    size: 'sm',
  });

  modal.panel.querySelector<HTMLFormElement>('#reject-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const reason = modal.panel.querySelector<HTMLTextAreaElement>('#reject-reason');
    if (!reason?.value.trim()) {
      document.getElementById('reject-error')?.classList.remove('hidden');
      return;
    }
    try {
      rejectSolicitud(request.id, reason.value.trim());
      modal.close();
      toast('La solicitud fue rechazada.', 'success');
      render();
      onDone?.();
    } catch (error) {
      toastError(error);
    }
  });
}

export function openConvertModal(request: Solicitud): void {
  const today = new Date();
  const end = new Date(today);
  end.setDate(end.getDate() + 45);
  const modal = openModal({
    title: 'Convertir en proyecto',
    subtitle: `${request.folio} · ${request.client.name}`,
    content: `
      <form id="convert-form" class="space-y-4">
        <div>
          <label class="admin-label" for="convert-name">Nombre del proyecto</label>
          <input id="convert-name" class="admin-input" value="${escapeHtml(
            `${request.client.company || request.client.name} · Sistema solar`,
          )}" required />
        </div>
        <div>
          <label class="admin-label" for="convert-responsible">Responsable del proyecto</label>
          <select id="convert-responsible" class="admin-select" required>
            ${optionsForUsers(
              (user) => ['rol-gerente', 'rol-supervisor'].includes(user.roleId) && user.status === 'activo',
              'usr-gerente',
            )}
          </select>
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label class="admin-label" for="convert-start">Inicio</label>
            <input id="convert-start" type="date" class="admin-input" value="${toDateInput(today)}" required />
          </div>
          <div>
            <label class="admin-label" for="convert-end">Fin estimado</label>
            <input id="convert-end" type="date" class="admin-input" value="${toDateInput(end)}" required />
          </div>
        </div>
        <div>
          <label class="admin-label" for="convert-status">Estado inicial</label>
          <select id="convert-status" class="admin-select">
            <option value="por-planificar">Por planificar</option>
            <option value="planificacion">Planificación</option>
            <option value="visita-tecnica">Visita técnica</option>
          </select>
        </div>
        <div>
          <label class="admin-label" for="convert-tasks">Tareas iniciales</label>
          <textarea id="convert-tasks" class="admin-textarea" rows="4">Kickoff con el cliente
Visita técnica y levantamiento
Revisión de diseño y materiales</textarea>
          <p class="admin-help">Una tarea por línea. Se asignan al responsable con vencimientos semanales.</p>
        </div>
        <div class="rounded-lg border border-line bg-natural/70 p-3 text-xs text-muted">
          Capacidad estimada: <strong class="text-charcoal">${formatNumber(request.calculation.installedCapacityKwp)} kWp</strong>
          · Inversión: <strong class="text-charcoal">${formatCurrency(request.calculation.total)}</strong>
        </div>
      </form>
    `,
    footer: `
      <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" class="admin-btn admin-btn-secondary" data-overlay-close>Cancelar</button>
        <button type="submit" form="convert-form" class="admin-btn admin-btn-primary">Crear proyecto</button>
      </div>
    `,
  });

  modal.panel.querySelector<HTMLFormElement>('#convert-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = modal.panel.querySelector<HTMLInputElement>('#convert-name');
    const responsible = modal.panel.querySelector<HTMLSelectElement>('#convert-responsible');
    const startDate = modal.panel.querySelector<HTMLInputElement>('#convert-start');
    const endDate = modal.panel.querySelector<HTMLInputElement>('#convert-end');
    const status = modal.panel.querySelector<HTMLSelectElement>('#convert-status');
    const tasks = modal.panel.querySelector<HTMLTextAreaElement>('#convert-tasks');
    if (!name?.value.trim() || !responsible?.value || !startDate?.value || !endDate?.value) {
      toast('Completa los datos obligatorios del proyecto.', 'warning');
      return;
    }
    try {
      const project = convertSolicitudToProject(request.id, {
        name: name.value.trim(),
        responsibleUserId: responsible.value,
        startDate: startDate.value,
        estimatedEndDate: endDate.value,
        status: (status?.value as 'por-planificar') ?? 'por-planificar',
        initialTasks: (tasks?.value ?? '')
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean),
      });
      modal.close();
      toast(`Proyecto ${project.folio} creado a partir de ${request.folio}.`, 'success');
      window.location.href = `/admin/proyectos/${project.id}`;
    } catch (error) {
      toastError(error);
    }
  });
}

export function openNewRequestModal(): void {
  const modal = openModal({
    title: 'Nueva solicitud',
    subtitle: 'Captura manual para clientes que contactan por otros canales.',
    size: 'xl',
    content: `
      <form id="new-request-form" class="space-y-6">
        <fieldset>
          <legend class="mb-3 font-display text-sm font-bold text-forest">Datos del cliente</legend>
          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label class="admin-label" for="new-name">Nombre completo *</label>
              <input id="new-name" class="admin-input" required placeholder="Nombre del cliente" />
            </div>
            <div>
              <label class="admin-label" for="new-company">Empresa</label>
              <input id="new-company" class="admin-input" placeholder="Opcional" />
            </div>
            <div>
              <label class="admin-label" for="new-email">Correo *</label>
              <input id="new-email" type="email" class="admin-input" required placeholder="cliente@correo.com" />
            </div>
            <div>
              <label class="admin-label" for="new-phone">Teléfono *</label>
              <input id="new-phone" class="admin-input" required placeholder="+52 55 0000 0000" />
            </div>
            <div>
              <label class="admin-label" for="new-location">Ubicación *</label>
              <input id="new-location" class="admin-input" required placeholder="Ciudad, Estado" />
            </div>
            <div>
              <label class="admin-label" for="new-property">Tipo de propiedad</label>
              <input id="new-property" class="admin-input" placeholder="Casa, local, nave…" value="Casa habitación" />
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend class="mb-3 font-display text-sm font-bold text-forest">Consumo y sistema</legend>
          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label class="admin-label" for="new-type">Tipo de proyecto *</label>
              <select id="new-type" class="admin-select">
                ${PROJECT_TYPE_OPTIONS.map((option) => `<option value="${option.value}">${option.label}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="admin-label" for="new-system">Tipo de sistema *</label>
              <select id="new-system" class="admin-select">
                <option value="interconectado">Conectado a la red</option>
                <option value="baterias">Con baterías</option>
                <option value="hibrido">Híbrido</option>
              </select>
            </div>
            <div>
              <label class="admin-label" for="new-consumption">Consumo mensual (kWh) *</label>
              <input id="new-consumption" type="number" min="1" step="1" class="admin-input" required placeholder="Ej. 650" />
            </div>
            <div>
              <label class="admin-label" for="new-bill">Recibo mensual (MXN)</label>
              <input id="new-bill" type="number" min="0" step="1" class="admin-input" placeholder="Ej. 2400" />
            </div>
            <div>
              <label class="admin-label" for="new-tariff">Tarifa por kWh</label>
              <input id="new-tariff" type="number" min="0" step="0.01" class="admin-input" placeholder="Se estima si se deja vacío" />
            </div>
            <div id="backup-fields" class="hidden">
              <label class="admin-label" for="new-backup-hours">Horas de respaldo</label>
              <input id="new-backup-hours" type="number" min="1" max="24" class="admin-input" value="4" />
            </div>
          </div>
          <p class="admin-help mt-2">La inversión y el dimensionamiento se calculan automáticamente con la configuración vigente del cotizador.</p>
        </fieldset>

        <div>
          <label class="admin-label" for="new-comments">Comentarios</label>
          <textarea id="new-comments" class="admin-textarea" rows="3" placeholder="Necesidades, dudas o contexto del cliente…"></textarea>
        </div>
      </form>
    `,
    footer: `
      <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" class="admin-btn admin-btn-secondary" data-overlay-close>Cancelar</button>
        <button type="submit" form="new-request-form" class="admin-btn admin-btn-primary">
          ${icon('plus', 'h-4 w-4')} Registrar solicitud
        </button>
      </div>
    `,
  });

  const system = modal.panel.querySelector<HTMLSelectElement>('#new-system');
  const backupFields = modal.panel.querySelector<HTMLElement>('#backup-fields');
  system?.addEventListener('change', () => {
    backupFields?.classList.toggle('hidden', system.value === 'interconectado');
  });

  modal.panel.querySelector<HTMLFormElement>('#new-request-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const get = <T extends HTMLElement>(id: string) => modal.panel.querySelector<T>(`#${id}`);
    const name = get<HTMLInputElement>('new-name');
    const email = get<HTMLInputElement>('new-email');
    const phone = get<HTMLInputElement>('new-phone');
    const location = get<HTMLInputElement>('new-location');
    const consumption = get<HTMLInputElement>('new-consumption');
    if (!name?.value.trim() || !email?.value.trim() || !phone?.value.trim() || !location?.value.trim()) {
      toast('Completa los datos de contacto del cliente.', 'warning');
      return;
    }
    if (!consumption?.value || Number(consumption.value) <= 0) {
      toast('Ingresa un consumo mensual mayor a cero.', 'warning');
      return;
    }
    try {
      const request = addSolicitud({
        source: 'manual',
        client: {
          name: name.value.trim(),
          company: get<HTMLInputElement>('new-company')?.value.trim() || undefined,
          email: email.value.trim(),
          phone: phone.value.trim(),
          location: location.value.trim(),
          propertyType: get<HTMLInputElement>('new-property')?.value.trim() || 'Propiedad',
          comments: get<HTMLTextAreaElement>('new-comments')?.value.trim(),
        },
        energy: {
          projectType: (get<HTMLSelectElement>('new-type')?.value ?? 'residencial') as ProjectType,
          monthlyConsumptionKwh: Number(consumption.value),
          billAmount: Number(get<HTMLInputElement>('new-bill')?.value) || undefined,
          tariff: Number(get<HTMLInputElement>('new-tariff')?.value) || undefined,
          propertyType: get<HTMLInputElement>('new-property')?.value.trim() || 'Propiedad',
        },
        systemType: (get<HTMLSelectElement>('new-system')?.value ?? 'interconectado') as SystemType,
        backup:
          get<HTMLSelectElement>('new-system')?.value !== 'interconectado'
            ? {
                hours: Number(get<HTMLInputElement>('new-backup-hours')?.value) || 4,
                equipment: [],
                loadKw: 0,
              }
            : undefined,
      });
      modal.close();
      toast(`Solicitud ${request.folio} registrada.`, 'success');
      window.location.href = `/admin/solicitudes/${request.id}`;
    } catch (error) {
      toastError(error);
    }
  });
}

/* ------------------------------------------------------------------ */
/* Exportación y arranque                                              */
/* ------------------------------------------------------------------ */

function exportCsv(): void {
  const rows = state.list;
  const header = ['Folio', 'Fecha', 'Cliente', 'Empresa', 'Correo', 'Teléfono', 'Ubicación', 'Tipo', 'Consumo kWh', 'Inversión MXN', 'Estado'];
  const lines = rows.map((request) =>
    [
      request.folio,
      formatDate(request.createdAt),
      request.client.name,
      request.client.company ?? '',
      request.client.email,
      request.client.phone,
      request.client.location,
      PROJECT_TYPE_LABEL[request.energy.projectType],
      request.energy.monthlyConsumptionKwh,
      request.calculation.total,
      REQUEST_STATUS_LABEL[request.status],
    ]
      .map((value) => `"${String(value).replaceAll('"', '""')}"`)
      .join(','),
  );
  downloadText(`enersol-solicitudes-${new Date().toISOString().slice(0, 10)}.csv`, [header.join(','), ...lines].join('\n'));
  toast('Se descargó el CSV con las solicitudes filtradas.', 'success');
}

function bindControls(): void {
  const search = document.getElementById('requests-search') as HTMLInputElement | null;
  search?.addEventListener('input', () => {
    state.filters.search = search.value;
    state.filters.page = 1;
    renderTable();
  });

  document.querySelectorAll<HTMLSelectElement>('[data-filter]').forEach((select) => {
    const key = select.dataset.filter as keyof Filters;
    if (key === 'responsible') {
      const data = loadState();
      select.innerHTML = `
        <option value="todos">Todos los responsables</option>
        <option value="sin-asignar">Sin asignar</option>
        ${data.users
          .filter((user) => ['rol-comercial', 'rol-gerente'].includes(user.roleId))
          .map((user) => `<option value="${user.id}">${escapeHtml(`${user.firstName} ${user.lastName}`)}</option>`)
          .join('')}
      `;
    }
    select.addEventListener('change', () => {
      (state.filters as unknown as Record<string, unknown>)[key] = select.value;
      state.filters.page = 1;
      renderTable();
      renderFilters();
    });
  });

  document.getElementById('requests-prev')?.addEventListener('click', () => {
    if (state.filters.page > 1) {
      state.filters.page -= 1;
      renderTable();
    }
  });
  document.getElementById('requests-next')?.addEventListener('click', () => {
    const totalPages = Math.max(1, Math.ceil(state.list.length / PAGE_SIZE));
    if (state.filters.page < totalPages) {
      state.filters.page += 1;
      renderTable();
    }
  });
  document.getElementById('requests-export')?.addEventListener('click', exportCsv);
  document.querySelectorAll<HTMLElement>('[data-open-new]').forEach((button) => {
    button.addEventListener('click', openNewRequestModal);
  });

  document.addEventListener('click', () => {
    document.querySelectorAll<HTMLElement>('[data-menu]').forEach((menu) => menu.classList.add('hidden'));
    document.querySelectorAll<HTMLButtonElement>('[data-menu-button]').forEach((button) => button.setAttribute('aria-expanded', 'false'));
  });
}

function applyPermissions(): void {
  const session = getSession();
  if (!session) return;
  if (!hasPermission(session.roleId, 'solicitudes', 'crear')) {
    document.querySelectorAll<HTMLElement>('[data-open-new]').forEach((button) => button.remove());
  }
  if (!hasPermission(session.roleId, 'solicitudes', 'editar')) {
    document.querySelectorAll<HTMLElement>('[data-action="assign"]').forEach((button) => button.remove());
  }
}

function render(): void {
  state.list = filtered();
  renderFilters();
  renderTable();
}

export function initSolicitudes(): void {
  const params = new URLSearchParams(window.location.search);
  const status = params.get('status');
  if (status) state.filters.status = status as StatusFilter;
  if (params.get('assigned') === 'unassigned') state.filters.responsible = 'sin-asignar';
  const saved = safeJson<Partial<Filters> | null>(window.sessionStorage.getItem('enersol.solicitudes.filters'), null);
  if (saved && !status) Object.assign(state.filters, saved);

  const search = document.getElementById('requests-search') as HTMLInputElement | null;
  if (search) search.value = state.filters.search;

  bindControls();
  applyPermissions();
  render();

  if (params.get('new') === '1') {
    window.setTimeout(openNewRequestModal, 150);
  }

  window.addEventListener('beforeunload', () => {
    window.sessionStorage.setItem('enersol.solicitudes.filters', JSON.stringify(state.filters));
  });
}
