import {
  addProject,
  getSession,
  hasPermission,
  loadState,
  setProjectStatus,
} from '../../services/store';
import type { Project, ProjectStatus } from '../../types/admin';
import type { ProjectType, SystemType } from '../../types/solar';
import {
  escapeHtml,
  formatCurrency,
  formatDate,
  formatNumber,
  safeJson,
  toDateInput,
} from '../../utils/format';
import {
  PROJECT_STATUS_CLASS,
  PROJECT_STATUS_DOT,
  PROJECT_STATUS_LABEL,
  PROJECT_STATUS_ORDER,
  PROJECT_TYPE_LABEL,
} from '../../utils/status';
import { PROJECT_TYPE_OPTIONS } from '../../data/cotizador-defaults';
import { icon } from './icons';
import {
  avatarLetter,
  downloadText,
  emptyStateHtml,
  openModal,
  toast,
  toastError,
} from './ui';

type View = 'tabla' | 'kanban';

interface Filters {
  search: string;
  status: string;
  type: ProjectType | 'todos';
  responsible: string;
  sort: 'startDate' | 'name' | 'amount' | 'progress' | 'status';
  dir: 'asc' | 'desc';
  page: number;
}

const PAGE_SIZE = 8;
const VIEW_KEY = 'enersol.proyectos.vista';

const state = {
  view: 'tabla' as View,
  filters: {
    search: '',
    status: 'todos',
    type: 'todos',
    responsible: 'todos',
    sort: 'startDate',
    dir: 'desc',
    page: 1,
  } as Filters,
  list: [] as Project[],
  draggedId: null as string | null,
};

function filtered(): Project[] {
  const data = loadState();
  const f = state.filters;
  const term = f.search.trim().toLowerCase();
  const result = data.projects.filter((project) => {
    if (f.status === 'activos') {
      if (['finalizado', 'cancelado'].includes(project.status)) return false;
    } else if (f.status !== 'todos' && project.status !== f.status) {
      return false;
    }
    if (f.type !== 'todos' && project.projectType !== f.type) return false;
    if (f.responsible !== 'todos' && project.responsibleUserId !== f.responsible) return false;
    if (!term) return true;
    return [project.folio, project.name, project.client.name, project.client.company ?? '', project.location]
      .join(' ')
      .toLowerCase()
      .includes(term);
  });

  result.sort((a, b) => {
    let comparison = 0;
    switch (f.sort) {
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'amount':
        comparison = a.amount - b.amount;
        break;
      case 'progress':
        comparison = a.progress - b.progress;
        break;
      case 'status':
        comparison = PROJECT_STATUS_ORDER.indexOf(a.status) - PROJECT_STATUS_ORDER.indexOf(b.status);
        break;
      default:
        comparison = new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    }
    return f.dir === 'asc' ? comparison : -comparison;
  });
  return result;
}

function sortIndicator(field: Filters['sort']): string {
  if (state.filters.sort !== field) return `<span class="text-muted/40">${icon('sort', 'h-3 w-3')}</span>`;
  return `<span class="text-forest">${icon(state.filters.dir === 'asc' ? 'chevronUp' : 'chevronDown', 'h-3 w-3')}</span>`;
}

function responsibleOptions(selected = ''): string {
  return loadState()
    .users.filter((user) => ['rol-gerente', 'rol-supervisor'].includes(user.roleId) && user.status === 'activo')
    .map(
      (user) =>
        `<option value="${user.id}" ${user.id === selected ? 'selected' : ''}>${escapeHtml(
          `${user.firstName} ${user.lastName}`,
        )}</option>`,
    )
    .join('');
}

function statusOptions(selected: string, includeAll = false): string {
  return `${includeAll ? '<option value="todos">Todos los estados</option>' : ''}${PROJECT_STATUS_ORDER.map(
    (status) =>
      `<option value="${status}" ${status === selected ? 'selected' : ''}>${PROJECT_STATUS_LABEL[status]}</option>`,
  ).join('')}`;
}

/* ------------------------------------------------------------------ */
/* Tabla                                                               */
/* ------------------------------------------------------------------ */

function renderTable(): void {
  const container = document.getElementById('projects-table');
  if (!container) return;
  const data = loadState();
  const rows = state.list;
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  state.filters.page = Math.min(state.filters.page, totalPages);
  const start = (state.filters.page - 1) * PAGE_SIZE;
  const pageRows = rows.slice(start, start + PAGE_SIZE);

  const count = document.getElementById('projects-count');
  if (count) count.textContent = `${formatNumber(rows.length)} proyecto${rows.length === 1 ? '' : 's'}`;

  if (rows.length === 0) {
    container.innerHTML = emptyStateHtml({
      iconName: 'kanban',
      title: 'No encontramos proyectos',
      description: 'Ajusta los filtros o crea un proyecto para comenzar.',
      action: '<button type="button" class="admin-btn admin-btn-primary admin-btn-sm" data-new-project>Nuevo proyecto</button>',
    });
    document.getElementById('projects-pagination')?.setAttribute('hidden', '');
    bindTableEvents();
    return;
  }
  document.getElementById('projects-pagination')?.removeAttribute('hidden');

  container.innerHTML = `
    <div class="overflow-x-auto">
      <table class="admin-table min-w-[1080px]">
        <thead>
          <tr>
            <th><button type="button" class="admin-table-sort" data-sort="name">Proyecto ${sortIndicator('name')}</button></th>
            <th>Cliente</th>
            <th>Tipo / Sistema</th>
            <th>Capacidad</th>
            <th><button type="button" class="admin-table-sort" data-sort="amount">Monto ${sortIndicator('amount')}</button></th>
            <th>Responsable</th>
            <th><button type="button" class="admin-table-sort" data-sort="progress">Avance ${sortIndicator('progress')}</button></th>
            <th><button type="button" class="admin-table-sort" data-sort="status">Estado ${sortIndicator('status')}</button></th>
            <th class="text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${pageRows
            .map((project) => {
              const responsible = data.users.find((user) => user.id === project.responsibleUserId);
              const tasksDone = project.tasks.filter((task) => task.status === 'completada').length;
              return `
                <tr class="cursor-pointer" data-project-row="${project.id}">
                  <td class="max-w-[240px]">
                    <a href="/admin/proyectos/${project.id}" class="block truncate font-semibold text-charcoal hover:text-forest hover:underline">${escapeHtml(project.name)}</a>
                    <span class="mt-0.5 block font-mono text-[11px] text-muted">${escapeHtml(project.folio)} · ${formatDate(project.startDate)}</span>
                  </td>
                  <td class="max-w-[180px]">
                    <p class="truncate text-sm">${escapeHtml(project.client.name)}</p>
                    <p class="truncate text-xs text-muted">${escapeHtml(project.client.company ?? project.location)}</p>
                  </td>
                  <td>
                    <span class="admin-badge border-line bg-natural text-charcoal">${escapeHtml(PROJECT_TYPE_LABEL[project.projectType])}</span>
                    <span class="mt-1 block text-[11px] text-muted">${project.systemType}</span>
                  </td>
                  <td class="whitespace-nowrap text-sm">${formatNumber(project.capacityKwp)} kWp</td>
                  <td class="whitespace-nowrap font-semibold">${formatCurrency(project.amount)}</td>
                  <td>
                    ${
                      responsible
                        ? `<span class="flex items-center gap-2"><span class="admin-avatar h-7 w-7 text-[10px]" style="background-color:${responsible.avatarColor}">${escapeHtml(
                            avatarLetter(`${responsible.firstName} ${responsible.lastName}`),
                          )}</span><span class="max-w-[110px] truncate text-xs">${escapeHtml(
                            `${responsible.firstName} ${responsible.lastName}`,
                          )}</span></span>`
                        : '<span class="text-xs italic text-muted">Sin asignar</span>'
                    }
                  </td>
                  <td class="w-36">
                    <div class="flex items-center gap-2">
                      <div class="admin-progress flex-1"><div class="admin-progress-bar" style="width:${project.progress}%"></div></div>
                      <span class="w-8 text-right text-[11px] font-semibold">${project.progress}%</span>
                    </div>
                    <span class="mt-1 block text-[11px] text-muted">${tasksDone}/${project.tasks.length} tareas</span>
                  </td>
                  <td><span class="admin-badge ${PROJECT_STATUS_CLASS[project.status]}">${PROJECT_STATUS_LABEL[project.status]}</span></td>
                  <td class="text-right">
                    <div class="flex items-center justify-end gap-0.5">
                      <a href="/admin/proyectos/${project.id}" class="admin-icon-btn" title="Ver detalle" aria-label="Ver ${escapeHtml(project.name)}">
                        ${icon('eye', 'h-4 w-4')}
                      </a>
                      <button type="button" class="admin-icon-btn" data-project-status="${project.id}" title="Cambiar estado" aria-label="Cambiar estado">
                        ${icon('refresh', 'h-4 w-4')}
                      </button>
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

  const range = document.getElementById('projects-range');
  if (range) range.textContent = `Mostrando ${start + 1}–${Math.min(start + PAGE_SIZE, rows.length)} de ${rows.length}`;
  const label = document.getElementById('projects-page-label');
  if (label) label.textContent = `Página ${state.filters.page} de ${totalPages}`;

  bindTableEvents();
}

function bindTableEvents(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-sort]').forEach((button) => {
    button.addEventListener('click', () => {
      const field = button.dataset.sort as Filters['sort'];
      if (state.filters.sort === field) {
        state.filters.dir = state.filters.dir === 'asc' ? 'desc' : 'asc';
      } else {
        state.filters.sort = field;
        state.filters.dir = field === 'startDate' ? 'desc' : 'asc';
      }
      render();
    });
  });

  document.querySelectorAll<HTMLElement>('[data-project-row]').forEach((row) => {
    row.addEventListener('click', (event) => {
      if ((event.target as HTMLElement).closest('a, button')) return;
      window.location.href = `/admin/proyectos/${row.dataset.projectRow}`;
    });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-project-status]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const id = button.dataset.projectStatus ?? '';
      const project = loadState().projects.find((item) => item.id === id);
      if (project) openStatusModal(project);
    });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-new-project]').forEach((button) => {
    button.addEventListener('click', openNewProjectModal);
  });
}

/* ------------------------------------------------------------------ */
/* Kanban                                                              */
/* ------------------------------------------------------------------ */

function kanbanCard(project: Project): string {
  const data = loadState();
  const responsible = data.users.find((user) => user.id === project.responsibleUserId);
  const tasksDone = project.tasks.filter((task) => task.status === 'completada').length;
  return `
    <article
      class="kanban-card"
      draggable="true"
      data-kanban-card="${project.id}"
      aria-label="${escapeHtml(project.name)}"
    >
      <div class="flex items-start justify-between gap-2">
        <a href="/admin/proyectos/${project.id}" class="min-w-0 flex-1">
          <p class="line-clamp-2 text-sm font-semibold leading-snug text-charcoal hover:text-forest">${escapeHtml(project.name)}</p>
          <p class="mt-0.5 font-mono text-[11px] text-muted">${escapeHtml(project.folio)}</p>
        </a>
        <span class="text-muted/50 hover:text-forest">${icon('grip', 'h-4 w-4 cursor-grab')}</span>
      </div>

      <p class="mt-2 truncate text-xs text-muted">${escapeHtml(project.client.name)}${project.client.company ? ` · ${escapeHtml(project.client.company)}` : ''}</p>

      <div class="mt-2.5 flex flex-wrap items-center gap-1.5">
        <span class="admin-badge border-line bg-natural text-charcoal">${escapeHtml(PROJECT_TYPE_LABEL[project.projectType])}</span>
        <span class="rounded-full bg-light-green/70 px-2 py-0.5 text-[11px] font-semibold text-forest">${formatNumber(project.capacityKwp)} kWp</span>
      </div>

      <div class="mt-3 flex items-center gap-2">
        <div class="admin-progress flex-1"><div class="admin-progress-bar" style="width:${project.progress}%"></div></div>
        <span class="text-[11px] font-semibold text-charcoal">${project.progress}%</span>
      </div>

      <div class="mt-2.5 flex items-center justify-between gap-2 border-t border-line/70 pt-2.5">
        <span class="text-xs font-semibold text-charcoal">${formatCurrency(project.amount)}</span>
        <span class="flex items-center gap-1 text-[11px] text-muted">${icon('clipboard', 'h-3.5 w-3.5')} ${tasksDone}/${project.tasks.length}</span>
      </div>

      <div class="mt-2.5 flex items-center justify-between gap-2">
        ${
          responsible
            ? `<span class="flex min-w-0 items-center gap-1.5">
                <span class="admin-avatar h-6 w-6 text-[9px]" style="background-color:${responsible.avatarColor}">${escapeHtml(
                  avatarLetter(`${responsible.firstName} ${responsible.lastName}`),
                )}</span>
                <span class="truncate text-[11px] text-muted">${escapeHtml(responsible.firstName)}</span>
              </span>`
            : '<span class="text-[11px] italic text-muted">Sin asignar</span>'
        }
        <span class="flex items-center gap-1 text-[11px] text-muted">${icon('calendar', 'h-3.5 w-3.5')} ${formatDate(project.estimatedEndDate)}</span>
      </div>

      <label class="mt-2 block">
        <span class="sr-only">Mover ${escapeHtml(project.name)} a otra etapa</span>
        <select class="admin-select px-2 py-1 text-[11px]" data-card-status="${project.id}">
          ${statusOptions(project.status)}
        </select>
      </label>
    </article>
  `;
}

function renderKanban(): void {
  const container = document.getElementById('projects-kanban');
  if (!container) return;
  container.classList.remove('admin-skeleton', 'h-64');
  const rows = state.list;

  if (rows.length === 0) {
    container.innerHTML = emptyStateHtml({
      iconName: 'kanban',
      title: 'No hay proyectos para mostrar',
      description: 'Ajusta los filtros o crea un proyecto para verlo en el tablero.',
      action: '<button type="button" class="admin-btn admin-btn-primary admin-btn-sm" data-new-project>Nuevo proyecto</button>',
    });
    bindKanbanEvents();
    return;
  }

  container.innerHTML = `
    <div class="kanban-board">
      ${PROJECT_STATUS_ORDER.map((status) => {
        const items = rows.filter((project) => project.status === status);
        return `
          <section class="kanban-column" data-drop-status="${status}" aria-label="${PROJECT_STATUS_LABEL[status]}">
            <header class="mb-3 flex items-center justify-between gap-2 px-0.5">
              <div class="flex items-center gap-2">
                <span class="h-2 w-2 rounded-full ${PROJECT_STATUS_DOT[status]}"></span>
                <h3 class="text-xs font-bold uppercase tracking-wider text-charcoal/80">${PROJECT_STATUS_LABEL[status]}</h3>
              </div>
              <span class="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-muted">${items.length}</span>
            </header>
            <div class="space-y-2.5">
              ${items.length ? items.map(kanbanCard).join('') : `<p class="rounded-xl border border-dashed border-line bg-white/50 px-3 py-6 text-center text-[11px] text-muted">Sin proyectos</p>`}
            </div>
          </section>
        `;
      }).join('')}
    </div>
  `;

  bindKanbanEvents();
}

function bindKanbanEvents(): void {
  document.querySelectorAll<HTMLElement>('[data-kanban-card]').forEach((card) => {
    card.addEventListener('dragstart', (event) => {
      state.draggedId = card.dataset.kanbanCard ?? null;
      card.classList.add('dragging');
      event.dataTransfer?.setData('text/plain', state.draggedId ?? '');
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      state.draggedId = null;
      document.querySelectorAll('.kanban-column').forEach((column) => column.classList.remove('drag-over'));
    });
  });

  document.querySelectorAll<HTMLElement>('[data-drop-status]').forEach((column) => {
    column.addEventListener('dragover', (event) => {
      event.preventDefault();
      column.classList.add('drag-over');
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    });
    column.addEventListener('dragleave', (event) => {
      if (!column.contains(event.relatedTarget as Node)) column.classList.remove('drag-over');
    });
    column.addEventListener('drop', (event) => {
      event.preventDefault();
      column.classList.remove('drag-over');
      const id = state.draggedId ?? event.dataTransfer?.getData('text/plain') ?? '';
      const status = column.dataset.dropStatus as ProjectStatus;
      const project = loadState().projects.find((item) => item.id === id);
      if (!project || !status || project.status === status) return;
      try {
        setProjectStatus(id, status);
        toast(`${project.folio} se movió a "${PROJECT_STATUS_LABEL[status]}".`, 'success');
        render();
      } catch (error) {
        toastError(error);
      }
    });
  });

  document.querySelectorAll<HTMLSelectElement>('[data-card-status]').forEach((select) => {
    select.addEventListener('change', () => {
      const id = select.dataset.cardStatus ?? '';
      const project = loadState().projects.find((item) => item.id === id);
      if (!project) return;
      try {
        setProjectStatus(id, select.value as ProjectStatus);
        toast(`${project.folio} se movió a "${PROJECT_STATUS_LABEL[select.value as ProjectStatus]}".`, 'success');
        render();
      } catch (error) {
        toastError(error);
      }
    });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-new-project]').forEach((button) => {
    button.addEventListener('click', openNewProjectModal);
  });
}

/* ------------------------------------------------------------------ */
/* Modales                                                             */
/* ------------------------------------------------------------------ */

function openStatusModal(project: Project): void {
  const modal = openModal({
    title: 'Cambiar estado del proyecto',
    subtitle: `${project.folio} · ${project.name}`,
    size: 'sm',
    content: `
      <form id="project-status-form" class="space-y-4">
        <div>
          <label class="admin-label" for="project-status-select">Nuevo estado</label>
          <select id="project-status-select" class="admin-select">${statusOptions(project.status)}</select>
        </div>
        <p class="rounded-lg border border-line bg-natural/70 p-3 text-xs leading-relaxed text-muted">
          El cambio queda registrado en la bitácora del proyecto. Si se marca como finalizado, el avance se ajusta a 100%.
        </p>
      </form>
    `,
    footer: `
      <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" class="admin-btn admin-btn-secondary" data-overlay-close>Cancelar</button>
        <button type="submit" form="project-status-form" class="admin-btn admin-btn-primary">Actualizar estado</button>
      </div>
    `,
  });

  modal.panel.querySelector<HTMLFormElement>('#project-status-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const select = modal.panel.querySelector<HTMLSelectElement>('#project-status-select');
    if (!select) return;
    try {
      setProjectStatus(project.id, select.value as ProjectStatus);
      modal.close();
      toast('Estado del proyecto actualizado.', 'success');
      render();
    } catch (error) {
      toastError(error);
    }
  });
}

function openNewProjectModal(): void {
  const today = new Date();
  const end = new Date(today);
  end.setDate(end.getDate() + 45);
  const modal = openModal({
    title: 'Nuevo proyecto',
    subtitle: 'Alta directa de un proyecto sin solicitud previa.',
    size: 'xl',
    content: `
      <form id="new-project-form" class="space-y-6">
        <fieldset>
          <legend class="mb-3 font-display text-sm font-bold text-forest">Proyecto</legend>
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="sm:col-span-2">
              <label class="admin-label" for="np-name">Nombre del proyecto *</label>
              <input id="np-name" class="admin-input" required placeholder="Ej. Residencial Los Encinos · Casa 12" />
            </div>
            <div>
              <label class="admin-label" for="np-type">Tipo *</label>
              <select id="np-type" class="admin-select">
                ${PROJECT_TYPE_OPTIONS.map((option) => `<option value="${option.value}">${option.label}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="admin-label" for="np-system">Sistema *</label>
              <select id="np-system" class="admin-select">
                <option value="interconectado">Conectado a la red</option>
                <option value="baterias">Con baterías</option>
                <option value="hibrido">Híbrido</option>
              </select>
            </div>
            <div>
              <label class="admin-label" for="np-capacity">Capacidad (kWp) *</label>
              <input id="np-capacity" type="number" min="0.5" step="0.1" class="admin-input" required placeholder="Ej. 5.5" />
            </div>
            <div>
              <label class="admin-label" for="np-amount">Monto del proyecto (MXN) *</label>
              <input id="np-amount" type="number" min="0" step="100" class="admin-input" required placeholder="Ej. 165000" />
            </div>
            <div>
              <label class="admin-label" for="np-responsible">Responsable *</label>
              <select id="np-responsible" class="admin-select" required>${responsibleOptions()}</select>
            </div>
            <div>
              <label class="admin-label" for="np-status">Estado inicial *</label>
              <select id="np-status" class="admin-select">${statusOptions('por-planificar')}</select>
            </div>
            <div>
              <label class="admin-label" for="np-start">Inicio *</label>
              <input id="np-start" type="date" class="admin-input" value="${toDateInput(today)}" required />
            </div>
            <div>
              <label class="admin-label" for="np-end">Fin estimado *</label>
              <input id="np-end" type="date" class="admin-input" value="${toDateInput(end)}" required />
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend class="mb-3 font-display text-sm font-bold text-forest">Cliente</legend>
          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label class="admin-label" for="np-client">Nombre del cliente *</label>
              <input id="np-client" class="admin-input" required />
            </div>
            <div>
              <label class="admin-label" for="np-company">Empresa</label>
              <input id="np-company" class="admin-input" placeholder="Opcional" />
            </div>
            <div>
              <label class="admin-label" for="np-email">Correo *</label>
              <input id="np-email" type="email" class="admin-input" required />
            </div>
            <div>
              <label class="admin-label" for="np-phone">Teléfono *</label>
              <input id="np-phone" class="admin-input" required />
            </div>
            <div class="sm:col-span-2">
              <label class="admin-label" for="np-location">Ubicación *</label>
              <input id="np-location" class="admin-input" required placeholder="Ciudad, Estado" />
            </div>
          </div>
        </fieldset>

        <div>
          <label class="admin-label" for="np-description">Descripción</label>
          <textarea id="np-description" class="admin-textarea" rows="3" placeholder="Alcance general del proyecto…"></textarea>
        </div>
      </form>
    `,
    footer: `
      <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" class="admin-btn admin-btn-secondary" data-overlay-close>Cancelar</button>
        <button type="submit" form="new-project-form" class="admin-btn admin-btn-primary">
          ${icon('plus', 'h-4 w-4')} Crear proyecto
        </button>
      </div>
    `,
  });

  modal.panel.querySelector<HTMLFormElement>('#new-project-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const value = (id: string) => modal.panel.querySelector<HTMLInputElement>(`#${id}`)?.value.trim() ?? '';
    const select = (id: string) => modal.panel.querySelector<HTMLSelectElement>(`#${id}`)?.value ?? '';
    const required = ['np-name', 'np-client', 'np-email', 'np-phone', 'np-location', 'np-capacity', 'np-amount'];
    if (required.some((id) => !value(id))) {
      toast('Completa los campos obligatorios del proyecto.', 'warning');
      return;
    }
    try {
      const project = addProject({
        name: value('np-name'),
        clientName: value('np-client'),
        company: value('np-company') || undefined,
        email: value('np-email'),
        phone: value('np-phone'),
        location: value('np-location'),
        projectType: select('np-type') as ProjectType,
        systemType: select('np-system') as SystemType,
        capacityKwp: Number(value('np-capacity')),
        amount: Number(value('np-amount')),
        responsibleUserId: select('np-responsible'),
        startDate: value('np-start'),
        estimatedEndDate: value('np-end'),
        status: select('np-status') as ProjectStatus,
        description: modal.panel.querySelector<HTMLTextAreaElement>('#np-description')?.value.trim(),
      });
      modal.close();
      toast(`Proyecto ${project.folio} creado.`, 'success');
      window.location.href = `/admin/proyectos/${project.id}`;
    } catch (error) {
      toastError(error);
    }
  });
}

/* ------------------------------------------------------------------ */
/* Exportación y arranque                                              */
/* ------------------------------------------------------------------ */

function exportCsv(): void {
  const header = ['Folio', 'Proyecto', 'Cliente', 'Tipo', 'Capacidad kWp', 'Monto MXN', 'Estado', 'Avance %', 'Inicio', 'Fin estimado'];
  const lines = state.list.map((project) =>
    [
      project.folio,
      project.name,
      project.client.name,
      PROJECT_TYPE_LABEL[project.projectType],
      project.capacityKwp,
      project.amount,
      PROJECT_STATUS_LABEL[project.status],
      project.progress,
      formatDate(project.startDate),
      formatDate(project.estimatedEndDate),
    ]
      .map((value) => `"${String(value).replaceAll('"', '""')}"`)
      .join(','),
  );
  downloadText(`enersol-proyectos-${new Date().toISOString().slice(0, 10)}.csv`, [header.join(','), ...lines].join('\n'));
  toast('Se descargó el CSV de proyectos filtrados.', 'success');
}

function setView(view: View): void {
  state.view = view;
  window.localStorage.setItem(VIEW_KEY, view);
  document.querySelectorAll<HTMLElement>('[data-view]').forEach((button) => {
    const active = button.dataset.view === view;
    button.classList.toggle('admin-chip-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  document.getElementById('projects-table-wrap')?.classList.toggle('hidden', view !== 'tabla');
  document.getElementById('projects-kanban-wrap')?.classList.toggle('hidden', view !== 'kanban');
  const url = new URL(window.location.href);
  if (view === 'kanban') url.searchParams.set('vista', 'kanban');
  else url.searchParams.delete('vista');
  window.history.replaceState({}, '', url);
}

function bindControls(): void {
  const search = document.getElementById('projects-search') as HTMLInputElement | null;
  search?.addEventListener('input', () => {
    state.filters.search = search.value;
    state.filters.page = 1;
    render();
  });

  document.querySelectorAll<HTMLSelectElement>('[data-filter]').forEach((select) => {
    const key = select.dataset.filter as keyof Filters;
    if (key === 'responsible') {
      select.innerHTML = `
        <option value="todos">Todos los responsables</option>
        ${loadState()
          .users.filter((user) => ['rol-gerente', 'rol-supervisor', 'rol-tecnico'].includes(user.roleId))
          .map((user) => `<option value="${user.id}">${escapeHtml(`${user.firstName} ${user.lastName}`)}</option>`)
          .join('')}
      `;
    }
    if (key === 'status') select.value = state.filters.status;
    select.addEventListener('change', () => {
      (state.filters as unknown as Record<string, unknown>)[key] = select.value;
      state.filters.page = 1;
      render();
    });
  });

  document.getElementById('projects-prev')?.addEventListener('click', () => {
    if (state.filters.page > 1) {
      state.filters.page -= 1;
      renderTable();
    }
  });
  document.getElementById('projects-next')?.addEventListener('click', () => {
    const totalPages = Math.max(1, Math.ceil(state.list.length / PAGE_SIZE));
    if (state.filters.page < totalPages) {
      state.filters.page += 1;
      renderTable();
    }
  });
  document.getElementById('projects-export')?.addEventListener('click', exportCsv);
  document.querySelectorAll<HTMLElement>('[data-view]').forEach((button) => {
    button.addEventListener('click', () => {
      setView((button.dataset.view as View) ?? 'tabla');
    });
  });
  document.querySelectorAll<HTMLElement>('[data-new-project]').forEach((button) => {
    button.addEventListener('click', openNewProjectModal);
  });
}

function applyPermissions(): void {
  const session = getSession();
  if (!session) return;
  if (!hasPermission(session.roleId, 'proyectos', 'crear')) {
    document.querySelectorAll<HTMLElement>('[data-new-project]').forEach((button) => button.remove());
  }
}

function render(): void {
  state.list = filtered();
  renderTable();
  renderKanban();
}

export function initProjects(): void {
  const params = new URLSearchParams(window.location.search);
  const status = params.get('status');
  if (status) state.filters.status = status;
  const saved = safeJson<Partial<Filters> | null>(window.sessionStorage.getItem('enersol.proyectos.filters'), null);
  if (saved && !status) Object.assign(state.filters, saved);

  const search = document.getElementById('projects-search') as HTMLInputElement | null;
  if (search) search.value = state.filters.search;
  const statusSelect = document.querySelector<HTMLSelectElement>('[data-filter="status"]');
  if (statusSelect) statusSelect.value = state.filters.status;

  bindControls();
  applyPermissions();
  render();
  const initialView = params.get('vista') === 'kanban' ? 'kanban' : (window.localStorage.getItem(VIEW_KEY) as View) ?? 'tabla';
  setView(initialView === 'kanban' ? 'kanban' : 'tabla');

  window.addEventListener('beforeunload', () => {
    window.sessionStorage.setItem('enersol.proyectos.filters', JSON.stringify(state.filters));
  });
}
