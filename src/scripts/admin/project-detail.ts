import {
  addProjectComment,
  addProjectFile,
  addProjectMember,
  addTask,
  deleteTask,
  getSession,
  hasPermission,
  loadState,
  removeProjectMember,
  roleById,
  setProjectStatus,
  updateTask,
  userName,
} from '../../services/store';
import type {
  Priority,
  Project,
  ProjectFileKind,
  ProjectStatus,
  ProjectTask,
  TaskStatus,
} from '../../types/admin';
import {
  buildProjectTimeline,
  projectProgress,
} from '../../utils/project';
import {
  daysUntil,
  escapeHtml,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  relativeTime,
  toDateInput,
} from '../../utils/format';
import {
  PRIORITY_CLASS,
  PRIORITY_LABEL,
  PROJECT_STATUS_CLASS,
  PROJECT_STATUS_LABEL,
  PROJECT_STATUS_ORDER,
  PROJECT_TYPE_LABEL,
  SYSTEM_TYPE_LABEL,
  TASK_STATUS_CLASS,
  TASK_STATUS_LABEL,
} from '../../utils/status';
import { icon } from './icons';
import {
  avatarLetter,
  confirmDialog,
  emptyStateHtml,
  openModal,
  toast,
  toastError,
} from './ui';

const TASK_STATUS_ORDER: TaskStatus[] = ['pendiente', 'en-progreso', 'en-revision', 'completada'];

const FILE_KIND_LABEL: Record<ProjectFileKind, string> = {
  cotizacion: 'Cotización',
  plano: 'Plano',
  fotografia: 'Fotografía',
  ficha: 'Ficha técnica',
  instalacion: 'Instalación',
};

const FILE_KIND_ICON: Record<ProjectFileKind, 'file' | 'map' | 'camera' | 'clipboard' | 'wrench'> = {
  cotizacion: 'file',
  plano: 'map',
  fotografia: 'camera',
  ficha: 'clipboard',
  instalacion: 'wrench',
};

let taskView: 'lista' | 'kanban' = 'lista';

function projectId(): string {
  const parts = window.location.pathname.split('/').filter(Boolean);
  return decodeURIComponent(parts[parts.length - 1] ?? '');
}

function canEdit(): boolean {
  const session = getSession();
  return session ? hasPermission(session.roleId, 'proyectos', 'editar') : false;
}

function canManageTasks(): boolean {
  const session = getSession();
  return session ? hasPermission(session.roleId, 'tareas', 'crear') || canEdit() : false;
}

function progressOf(project: Project): number {
  return projectProgress(project);
}

function memberName(stateUser: { firstName: string; lastName: string }): string {
  return `${stateUser.firstName} ${stateUser.lastName}`.trim();
}

/* ------------------------------------------------------------------ */
/* Cabecera                                                            */
/* ------------------------------------------------------------------ */

function renderHeader(project: Project): void {
  const set = (id: string, value: string) => {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  };
  set('project-folio', project.folio);
  set('project-title', project.name);
  set('project-client', project.client.name);
  const status = document.getElementById('project-status-badge');
  if (status) {
    status.className = `admin-badge ${PROJECT_STATUS_CLASS[project.status]}`;
    status.textContent = PROJECT_STATUS_LABEL[project.status];
  }
  const progress = document.getElementById('project-progress');
  if (progress) progress.style.width = `${progressOf(project)}%`;
  set('project-progress-label', `${progressOf(project)}%`);
  const title = document.querySelector('title');
  if (title) title.textContent = `${project.folio} · Proyectos · EnerSol Admin`;
}

/* ------------------------------------------------------------------ */
/* Tarjetas                                                            */
/* ------------------------------------------------------------------ */

function overviewCard(project: Project): string {
  const data = loadState();
  const responsible = data.users.find((user) => user.id === project.responsibleUserId);
  const doneTasks = project.tasks.filter((task) => task.status === 'completada').length;
  const remaining = project.tasks.length - doneTasks;
  const days = daysUntil(project.estimatedEndDate);
  const dueLabel =
    days === null
      ? 'Sin fecha'
      : days < 0
        ? `Vencido hace ${Math.abs(days)} días`
        : days === 0
          ? 'Vence hoy'
          : `Faltan ${days} días`;

  return `
    <section class="admin-card" aria-labelledby="overview-title">
      <div class="admin-card-header">
        <div>
          <h2 id="overview-title" class="admin-section-title">Resumen del proyecto</h2>
          <p class="admin-section-subtitle">${escapeHtml(project.description || 'Sin descripción registrada.')}</p>
        </div>
        <span class="admin-badge border-line bg-natural text-charcoal">${escapeHtml(PROJECT_TYPE_LABEL[project.projectType])}</span>
      </div>
      <div class="admin-card-body">
        <dl class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div class="rounded-xl border border-line bg-natural/50 p-3">
            <dt class="text-[11px] font-semibold uppercase tracking-wider text-muted">Capacidad</dt>
            <dd class="mt-1 font-display text-lg font-bold text-forest">${formatNumber(project.capacityKwp)} kWp</dd>
          </div>
          <div class="rounded-xl border border-line bg-natural/50 p-3">
            <dt class="text-[11px] font-semibold uppercase tracking-wider text-muted">Monto del proyecto</dt>
            <dd class="mt-1 font-display text-lg font-bold text-forest">${formatCurrency(project.amount)}</dd>
          </div>
          <div class="rounded-xl border border-line bg-natural/50 p-3">
            <dt class="text-[11px] font-semibold uppercase tracking-wider text-muted">Tareas</dt>
            <dd class="mt-1 font-display text-lg font-bold text-forest">${doneTasks}/${project.tasks.length}</dd>
            <dd class="text-[11px] text-muted">${remaining} pendiente${remaining === 1 ? '' : 's'}</dd>
          </div>
          <div class="rounded-xl border border-line bg-natural/50 p-3">
            <dt class="text-[11px] font-semibold uppercase tracking-wider text-muted">Entrega estimada</dt>
            <dd class="mt-1 text-sm font-bold text-charcoal">${formatDate(project.estimatedEndDate)}</dd>
            <dd class="text-[11px] ${days !== null && days < 0 ? 'font-semibold text-danger' : 'text-muted'}">${escapeHtml(dueLabel)}</dd>
          </div>
        </dl>

        <div class="mt-5 overflow-x-auto rounded-xl border border-line">
          <table class="admin-table min-w-[560px]">
            <tbody>
              <tr><td class="text-muted">Tipo de sistema</td><td class="font-medium">${escapeHtml(SYSTEM_TYPE_LABEL[project.systemType])}</td></tr>
              <tr><td class="text-muted">Ubicación</td><td class="font-medium">${escapeHtml(project.location)}</td></tr>
              <tr><td class="text-muted">Responsable</td><td class="font-medium">${escapeHtml(responsible ? memberName(responsible) : 'Sin asignar')}</td></tr>
              <tr><td class="text-muted">Inicio</td><td class="font-medium">${formatDate(project.startDate)}</td></tr>
              <tr><td class="text-muted">Última actualización</td><td class="font-medium">${formatDateTime(project.updatedAt)}</td></tr>
              ${project.requestId ? `<tr><td class="text-muted">Solicitud origen</td><td class="font-medium"><a class="admin-link font-mono text-xs" href="/admin/solicitudes/${project.requestId}">${escapeHtml(project.requestId)}</a></td></tr>` : ''}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  `;
}

function timelineCard(project: Project): string {
  const stages = buildProjectTimeline(project);
  const stateClass: Record<string, string> = {
    completado: 'bg-success text-white border-success',
    'en-curso': 'bg-solar text-forest border-solar',
    pendiente: 'bg-white text-muted border-line',
    cancelado: 'bg-danger text-white border-danger',
  };
  return `
    <section class="admin-card" aria-labelledby="timeline-title">
      <div class="admin-card-header">
        <div>
          <h2 id="timeline-title" class="admin-section-title">Línea de tiempo</h2>
          <p class="admin-section-subtitle">Etapas del proyecto de instalación.</p>
        </div>
      </div>
      <div class="admin-card-body">
        <ol class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          ${stages
            .map(
              (stage, index) => `
            <li class="flex gap-3 rounded-xl border border-line p-3 ${
              stage.state === 'en-curso' ? 'border-solar/50 bg-solar-soft/40' : ''
            }">
              <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold ${stateClass[stage.state]}">
                ${stage.state === 'completado' ? icon('check', 'h-3.5 w-3.5') : stage.state === 'cancelado' ? icon('x', 'h-3.5 w-3.5') : index + 1}
              </span>
              <div class="min-w-0">
                <p class="text-sm font-semibold text-charcoal">${escapeHtml(stage.title)}</p>
                <p class="mt-0.5 text-xs leading-relaxed text-muted">${escapeHtml(stage.description)}</p>
                <p class="mt-1 text-[11px] font-medium ${
                  stage.state === 'en-curso' ? 'text-forest' : 'text-muted'
                }">${formatDate(stage.date)}</p>
              </div>
            </li>
          `,
            )
            .join('')}
        </ol>
      </div>
    </section>
  `;
}

function taskRow(project: Project, task: ProjectTask): string {
  const data = loadState();
  const assignee = data.users.find((user) => user.id === task.assigneeId);
  const days = daysUntil(task.dueDate);
  const done = task.status === 'completada';
  return `
    <tr data-task-row="${task.id}" class="${done ? 'opacity-70' : ''}">
      <td class="w-8">
        <input
          type="checkbox"
          class="admin-checkbox"
          data-task-toggle="${task.id}"
          ${done ? 'checked' : ''}
          ${canManageTasks() ? '' : 'disabled'}
          aria-label="Marcar ${escapeHtml(task.title)} como completada"
        />
      </td>
      <td class="max-w-[320px]">
        <p class="truncate text-sm font-semibold ${done ? 'text-muted line-through' : 'text-charcoal'}">${escapeHtml(task.title)}</p>
        ${task.description ? `<p class="mt-0.5 line-clamp-1 text-xs text-muted">${escapeHtml(task.description)}</p>` : ''}
        <div class="mt-1 flex flex-wrap items-center gap-1.5">
          <span class="admin-badge ${PRIORITY_CLASS[task.priority]}">${PRIORITY_LABEL[task.priority]}</span>
          <span class="admin-badge ${TASK_STATUS_CLASS[task.status]}">${TASK_STATUS_LABEL[task.status]}</span>
        </div>
      </td>
      <td class="whitespace-nowrap">
        ${
          assignee
            ? `<span class="flex items-center gap-2"><span class="admin-avatar h-7 w-7 text-[10px]" style="background-color:${assignee.avatarColor}">${escapeHtml(
                avatarLetter(memberName(assignee)),
              )}</span><span class="max-w-[120px] truncate text-xs">${escapeHtml(memberName(assignee))}</span></span>`
            : '<span class="text-xs italic text-muted">Sin asignar</span>'
        }
      </td>
      <td class="whitespace-nowrap text-xs">
        <span class="block font-medium text-charcoal">${formatDate(task.dueDate)}</span>
        ${
          days !== null && !done
            ? `<span class="${days < 0 ? 'font-semibold text-danger' : 'text-muted'}">${
                days < 0 ? `Vencida hace ${Math.abs(days)} d` : days === 0 ? 'Vence hoy' : `En ${days} d`
              }</span>`
            : ''
        }
      </td>
      <td class="text-right">
        ${
          canManageTasks()
            ? `<div class="flex items-center justify-end gap-0.5">
                <button type="button" class="admin-icon-btn" data-task-edit="${task.id}" aria-label="Editar tarea">
                  ${icon('pencil', 'h-4 w-4')}
                </button>
                <button type="button" class="admin-icon-btn text-danger hover:bg-danger-soft" data-task-delete="${task.id}" aria-label="Eliminar tarea">
                  ${icon('trash', 'h-4 w-4')}
                </button>
              </div>`
            : ''
        }
      </td>
    </tr>
  `;
}

function tasksCard(project: Project): string {
  const counts = TASK_STATUS_ORDER.map((status) => ({
    status,
    count: project.tasks.filter((task) => task.status === status).length,
  }));

  return `
    <section class="admin-card" aria-labelledby="tasks-title">
      <div class="admin-card-header flex-wrap gap-3">
        <div>
          <h2 id="tasks-title" class="admin-section-title">Tareas del proyecto</h2>
          <p class="admin-section-subtitle">${project.tasks.length} tarea${project.tasks.length === 1 ? '' : 's'} · ${counts
            .map((item) => `${item.count} ${TASK_STATUS_LABEL[item.status].toLowerCase()}`)
            .join(' · ')}</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <div class="flex items-center rounded-lg border border-line bg-white p-0.5" role="group" aria-label="Vista de tareas">
            <button type="button" data-task-view="lista" class="admin-chip ${taskView === 'lista' ? 'admin-chip-active' : ''}" aria-pressed="${taskView === 'lista'}">
              ${icon('list', 'h-3.5 w-3.5')} Lista
            </button>
            <button type="button" data-task-view="kanban" class="admin-chip ${taskView === 'kanban' ? 'admin-chip-active' : ''}" aria-pressed="${taskView === 'kanban'}">
              ${icon('columns', 'h-3.5 w-3.5')} Kanban
            </button>
          </div>
          ${
            canManageTasks()
              ? `<button type="button" class="admin-btn admin-btn-primary admin-btn-sm" data-task-new>
                  ${icon('plus', 'h-3.5 w-3.5')} Nueva tarea
                </button>`
              : ''
          }
        </div>
      </div>
      <div class="admin-card-body" id="tasks-container">
        ${renderTasksBody(project)}
      </div>
    </section>
  `;
}

function renderTasksBody(project: Project): string {
  if (project.tasks.length === 0) {
    return emptyStateHtml({
      iconName: 'clipboard',
      title: 'Sin tareas todavía',
      description: 'Agrega tareas para organizar la ejecución y dar seguimiento al avance.',
      action: canManageTasks()
        ? '<button type="button" class="admin-btn admin-btn-primary admin-btn-sm" data-task-new>Crear primera tarea</button>'
        : undefined,
    });
  }

  if (taskView === 'kanban') {
    return `
      <div class="kanban-board">
        ${TASK_STATUS_ORDER.map((status) => {
          const items = project.tasks.filter((task) => task.status === status);
          return `
            <section class="kanban-column" data-task-drop="${status}" aria-label="${TASK_STATUS_LABEL[status]}">
              <header class="mb-3 flex items-center justify-between gap-2 px-0.5">
                <h3 class="text-xs font-bold uppercase tracking-wider text-charcoal/80">${TASK_STATUS_LABEL[status]}</h3>
                <span class="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-muted">${items.length}</span>
              </header>
              <div class="space-y-2.5">
                ${items
                  .map((task) => {
                    const data = loadState();
                    const assignee = data.users.find((user) => user.id === task.assigneeId);
                    return `
                      <article class="kanban-card" draggable="${canManageTasks()}" data-task-card="${task.id}">
                        <div class="flex items-start justify-between gap-2">
                          <p class="min-w-0 flex-1 text-sm font-semibold leading-snug text-charcoal">${escapeHtml(task.title)}</p>
                          ${canManageTasks() ? `<span class="text-muted/50">${icon('grip', 'h-4 w-4 cursor-grab')}</span>` : ''}
                        </div>
                        ${task.description ? `<p class="mt-1 line-clamp-2 text-[11px] text-muted">${escapeHtml(task.description)}</p>` : ''}
                        <div class="mt-2 flex flex-wrap items-center gap-1.5">
                          <span class="admin-badge ${PRIORITY_CLASS[task.priority]}">${PRIORITY_LABEL[task.priority]}</span>
                        </div>
                        <div class="mt-2.5 flex items-center justify-between gap-2 border-t border-line/70 pt-2.5">
                          ${
                            assignee
                              ? `<span class="flex min-w-0 items-center gap-1.5"><span class="admin-avatar h-6 w-6 text-[9px]" style="background-color:${assignee.avatarColor}">${escapeHtml(
                                  avatarLetter(memberName(assignee)),
                                )}</span><span class="truncate text-[11px] text-muted">${escapeHtml(assignee.firstName)}</span></span>`
                              : '<span class="text-[11px] italic text-muted">Sin asignar</span>'
                          }
                          <span class="flex items-center gap-1 text-[11px] ${daysUntil(task.dueDate) !== null && (daysUntil(task.dueDate) ?? 0) < 0 && task.status !== 'completada' ? 'text-danger' : 'text-muted'}">
                            ${icon('calendar', 'h-3 w-3')} ${formatDate(task.dueDate)}
                          </span>
                        </div>
                        ${
                          canManageTasks()
                            ? `<div class="mt-2 flex items-center gap-1">
                                <select class="admin-select px-2 py-1 text-[11px]" data-task-status="${task.id}" aria-label="Cambiar estado de ${escapeHtml(task.title)}">
                                  ${TASK_STATUS_ORDER.map(
                                    (option) =>
                                      `<option value="${option}" ${option === task.status ? 'selected' : ''}>${TASK_STATUS_LABEL[option]}</option>`,
                                  ).join('')}
                                </select>
                                <button type="button" class="admin-icon-btn h-7 w-7" data-task-edit="${task.id}" aria-label="Editar tarea">
                                  ${icon('pencil', 'h-3.5 w-3.5')}
                                </button>
                              </div>`
                            : ''
                        }
                      </article>
                    `;
                  })
                  .join('') || '<p class="rounded-xl border border-dashed border-line bg-white/50 px-3 py-6 text-center text-[11px] text-muted">Sin tareas</p>'}
              </div>
            </section>
          `;
        }).join('')}
      </div>
    `;
  }

  return `
    <div class="overflow-x-auto">
      <table class="admin-table min-w-[760px]">
        <thead>
          <tr>
            <th class="w-8"><span class="sr-only">Completada</span></th>
            <th>Tarea</th>
            <th>Responsable</th>
            <th>Vencimiento</th>
            <th class="text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${project.tasks
            .slice()
            .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
            .map((task) => taskRow(project, task))
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function filesCard(project: Project): string {
  const data = loadState();
  if (project.files.length === 0) {
    return `
      <section class="admin-card" aria-labelledby="files-title">
        <div class="admin-card-header">
          <div>
            <h2 id="files-title" class="admin-section-title">Archivos del proyecto</h2>
            <p class="admin-section-subtitle">Documentos y evidencias simuladas.</p>
          </div>
          ${
            canEdit()
              ? `<button type="button" class="admin-btn admin-btn-secondary admin-btn-sm" data-file-new>${icon('upload', 'h-3.5 w-3.5')} Agregar</button>`
              : ''
          }
        </div>
        <div class="admin-card-body">
          ${emptyStateHtml({
            iconName: 'folder',
            title: 'Sin archivos',
            description: 'Registra cotizaciones, planos o fotografías del proyecto (solo metadatos simulados).',
            action: canEdit()
              ? '<button type="button" class="admin-btn admin-btn-primary admin-btn-sm" data-file-new>Registrar archivo</button>'
              : undefined,
          })}
        </div>
      </section>
    `;
  }

  return `
    <section class="admin-card" aria-labelledby="files-title">
      <div class="admin-card-header">
        <div>
          <h2 id="files-title" class="admin-section-title">Archivos del proyecto</h2>
          <p class="admin-section-subtitle">${project.files.length} archivo${project.files.length === 1 ? '' : 's'} · Solo metadatos simulados.</p>
        </div>
        ${
          canEdit()
            ? `<button type="button" class="admin-btn admin-btn-secondary admin-btn-sm" data-file-new>${icon('upload', 'h-3.5 w-3.5')} Agregar</button>`
            : ''
        }
      </div>
      <div class="admin-card-body">
        <ul class="divide-y divide-line/70">
          ${project.files
            .map((file) => {
              const uploader = data.users.find((user) => user.id === file.uploadedById);
              return `
                <li class="flex items-center gap-3 py-2.5">
                  <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-light-green text-forest">
                    ${icon(FILE_KIND_ICON[file.kind], 'h-4 w-4')}
                  </span>
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-medium text-charcoal">${escapeHtml(file.name)}</p>
                    <p class="text-[11px] text-muted">${FILE_KIND_LABEL[file.kind]} · ${formatNumber(file.sizeKb)} KB · ${escapeHtml(
                      uploader ? memberName(uploader) : 'Sistema',
                    )} · ${relativeTime(file.uploadedAt)}</p>
                  </div>
                </li>
              `;
            })
            .join('')}
        </ul>
      </div>
    </section>
  `;
}

function activityCard(project: Project): string {
  const data = loadState();
  const items = project.activities
    .slice()
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return `
    <section class="admin-card" aria-labelledby="activity-title">
      <div class="admin-card-header">
        <div>
          <h2 id="activity-title" class="admin-section-title">Comentarios y bitácora</h2>
          <p class="admin-section-subtitle">Movimientos y notas del equipo.</p>
        </div>
      </div>
      <div class="admin-card-body">
        ${
          canEdit()
            ? `<form id="project-comment-form" class="mb-5">
                <label for="project-comment" class="sr-only">Nuevo comentario</label>
                <textarea id="project-comment" class="admin-textarea" rows="3" placeholder="Escribe un comentario para el equipo…" required></textarea>
                <div class="mt-2 flex justify-end">
                  <button type="submit" class="admin-btn admin-btn-primary admin-btn-sm">
                    ${icon('send', 'h-3.5 w-3.5')} Comentar
                  </button>
                </div>
              </form>`
            : ''
        }
        ${
          items.length
            ? `<ol class="relative space-y-5 border-l border-line pl-5">
                ${items
                  .map(
                    (item) => `
                  <li class="relative">
                    <span class="absolute -left-[27px] top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-white bg-forest"></span>
                    <div class="flex flex-wrap items-center justify-between gap-2">
                      <p class="text-sm font-semibold text-charcoal">${escapeHtml(item.title)}</p>
                      <p class="text-[11px] text-muted" title="${formatDateTime(item.timestamp)}">${relativeTime(item.timestamp)}</p>
                    </div>
                    ${item.description ? `<p class="mt-0.5 whitespace-pre-line text-xs leading-relaxed text-muted">${escapeHtml(item.description)}</p>` : ''}
                    <p class="mt-1 text-[11px] font-medium text-muted">${escapeHtml(userName(data, item.actorId))}</p>
                  </li>
                `,
                  )
                  .join('')}
              </ol>`
            : emptyStateHtml({
                iconName: 'activity',
                title: 'Sin actividad registrada',
                description: 'Los cambios del proyecto aparecerán en esta bitácora.',
              })
        }
      </div>
    </section>
  `;
}

/* ------------------------------------------------------------------ */
/* Barra lateral                                                       */
/* ------------------------------------------------------------------ */

function statusCard(project: Project): string {
  return `
    <section class="admin-card" aria-labelledby="status-card-title">
      <div class="admin-card-header">
        <h2 id="status-card-title" class="admin-section-title">Estado y avance</h2>
        <span class="admin-badge ${PROJECT_STATUS_CLASS[project.status]}">${PROJECT_STATUS_LABEL[project.status]}</span>
      </div>
      <div class="admin-card-body space-y-4">
        <div>
          <div class="flex items-center justify-between gap-2 text-xs">
            <span class="font-medium text-muted">Avance del proyecto</span>
            <span class="font-semibold text-charcoal">${progressOf(project)}%</span>
          </div>
          <div class="admin-progress mt-2"><div class="admin-progress-bar" style="width:${progressOf(project)}%"></div></div>
        </div>
        ${
          canEdit()
            ? `<form id="project-status-form" class="space-y-3">
                <div>
                  <label for="project-status-select" class="admin-label">Cambiar estado</label>
                  <select id="project-status-select" class="admin-select">
                    ${PROJECT_STATUS_ORDER.map(
                      (status) =>
                        `<option value="${status}" ${status === project.status ? 'selected' : ''}>${PROJECT_STATUS_LABEL[status]}</option>`,
                    ).join('')}
                  </select>
                </div>
                <button type="submit" class="admin-btn admin-btn-primary admin-btn-sm w-full">Actualizar estado</button>
              </form>`
            : ''
        }
        <dl class="space-y-2.5 border-t border-line pt-4 text-xs">
          <div class="flex justify-between gap-3"><dt class="text-muted">Folio</dt><dd class="font-mono font-semibold text-charcoal">${escapeHtml(project.folio)}</dd></div>
          <div class="flex justify-between gap-3"><dt class="text-muted">Creado</dt><dd class="font-medium text-charcoal">${formatDate(project.createdAt)}</dd></div>
          <div class="flex justify-between gap-3"><dt class="text-muted">Inicio</dt><dd class="font-medium text-charcoal">${formatDate(project.startDate)}</dd></div>
          <div class="flex justify-between gap-3"><dt class="text-muted">Fin estimado</dt><dd class="font-medium text-charcoal">${formatDate(project.estimatedEndDate)}</dd></div>
        </dl>
      </div>
    </section>
  `;
}

function teamCard(project: Project): string {
  const data = loadState();
  const members = project.teamIds
    .map((id) => data.users.find((user) => user.id === id))
    .filter((user): user is NonNullable<typeof user> => Boolean(user));

  return `
    <section class="admin-card" aria-labelledby="team-title">
      <div class="admin-card-header">
        <h2 id="team-title" class="admin-section-title">Equipo</h2>
        ${
          canEdit()
            ? `<button type="button" class="text-xs font-semibold text-forest hover:underline" data-team-add>Agregar</button>`
            : ''
        }
      </div>
      <div class="admin-card-body">
        ${
          members.length
            ? `<ul class="space-y-3">
                ${members
                  .map((user) => {
                    const role = roleById(data, user.roleId);
                    const isLead = user.id === project.responsibleUserId;
                    return `
                      <li class="flex items-center gap-3">
                        <span class="admin-avatar h-9 w-9 text-[11px]" style="background-color:${user.avatarColor}">${escapeHtml(
                          avatarLetter(memberName(user)),
                        )}</span>
                        <div class="min-w-0 flex-1">
                          <p class="truncate text-sm font-medium text-charcoal">${escapeHtml(memberName(user))}</p>
                          <p class="truncate text-[11px] text-muted">${escapeHtml(role?.name ?? 'Sin rol')}${isLead ? ' · Líder' : ''}</p>
                        </div>
                        ${
                          canEdit() && !isLead
                            ? `<button type="button" class="admin-icon-btn h-7 w-7 text-danger hover:bg-danger-soft" data-team-remove="${user.id}" aria-label="Quitar a ${escapeHtml(memberName(user))}">
                                ${icon('x', 'h-3.5 w-3.5')}
                              </button>`
                            : ''
                        }
                      </li>
                    `;
                  })
                  .join('')}
              </ul>`
            : '<p class="text-xs italic text-muted">Sin integrantes asignados.</p>'
        }
      </div>
    </section>
  `;
}

function clientCard(project: Project): string {
  return `
    <section class="admin-card" aria-labelledby="client-title">
      <div class="admin-card-header">
        <h2 id="client-title" class="admin-section-title">Cliente</h2>
      </div>
      <div class="admin-card-body space-y-3 text-sm">
        <div>
          <p class="font-semibold text-charcoal">${escapeHtml(project.client.name)}</p>
          ${project.client.company ? `<p class="text-xs text-muted">${escapeHtml(project.client.company)}</p>` : ''}
        </div>
        <a class="flex items-center gap-2 text-xs text-charcoal/80 hover:text-forest" href="mailto:${escapeHtml(project.client.email)}">
          ${icon('mail', 'h-4 w-4 shrink-0 text-muted')} <span class="truncate">${escapeHtml(project.client.email)}</span>
        </a>
        <a class="flex items-center gap-2 text-xs text-charcoal/80 hover:text-forest" href="tel:${escapeHtml(project.client.phone.replace(/\s+/g, ''))}">
          ${icon('phone', 'h-4 w-4 shrink-0 text-muted')} ${escapeHtml(project.client.phone)}
        </a>
        <p class="flex items-start gap-2 text-xs text-charcoal/80">
          ${icon('mapPin', 'mt-0.5 h-4 w-4 shrink-0 text-muted')} ${escapeHtml(project.location)}
        </p>
      </div>
    </section>
  `;
}

/* ------------------------------------------------------------------ */
/* Modales                                                             */
/* ------------------------------------------------------------------ */

function memberOptions(project: Project, selected = ''): string {
  return loadState()
    .users.filter((user) => user.status === 'activo')
    .map(
      (user) =>
        `<option value="${user.id}" ${user.id === selected ? 'selected' : ''}>${escapeHtml(memberName(user))} · ${escapeHtml(
          user.jobTitle,
        )}</option>`,
    )
    .join('');
}

function openTaskModal(project: Project, task?: ProjectTask): void {
  const today = new Date();
  const defaultDue = new Date(today);
  defaultDue.setDate(defaultDue.getDate() + 7);
  const modal = openModal({
    title: task ? 'Editar tarea' : 'Nueva tarea',
    subtitle: `${project.folio} · ${project.name}`,
    content: `
      <form id="task-form" class="space-y-4">
        <div>
          <label class="admin-label" for="task-title">Título *</label>
          <input id="task-title" class="admin-input" required value="${escapeHtml(task?.title ?? '')}" placeholder="Ej. Visita técnica y levantamiento" />
        </div>
        <div>
          <label class="admin-label" for="task-description">Descripción</label>
          <textarea id="task-description" class="admin-textarea" rows="3" placeholder="Detalle de la tarea…">${escapeHtml(
            task?.description ?? '',
          )}</textarea>
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label class="admin-label" for="task-assignee">Responsable *</label>
            <select id="task-assignee" class="admin-select" required>
              <option value="">Selecciona un integrante</option>
              ${memberOptions(project, task?.assigneeId ?? project.responsibleUserId)}
            </select>
          </div>
          <div>
            <label class="admin-label" for="task-priority">Prioridad *</label>
            <select id="task-priority" class="admin-select">
              ${(['baja', 'media', 'alta', 'urgente'] as Priority[])
                .map(
                  (priority) =>
                    `<option value="${priority}" ${(task?.priority ?? 'media') === priority ? 'selected' : ''}>${
                      PRIORITY_LABEL[priority]
                    }</option>`,
                )
                .join('')}
            </select>
          </div>
          <div>
            <label class="admin-label" for="task-start">Inicio *</label>
            <input id="task-start" type="date" class="admin-input" required value="${toDateInput(task?.startDate ?? today)}" />
          </div>
          <div>
            <label class="admin-label" for="task-due">Vencimiento *</label>
            <input id="task-due" type="date" class="admin-input" required value="${toDateInput(task?.dueDate ?? defaultDue)}" />
          </div>
          <div class="sm:col-span-2">
            <label class="admin-label" for="task-status">Estado *</label>
            <select id="task-status" class="admin-select">
              ${TASK_STATUS_ORDER.map(
                (status) =>
                  `<option value="${status}" ${(task?.status ?? 'pendiente') === status ? 'selected' : ''}>${TASK_STATUS_LABEL[status]}</option>`,
              ).join('')}
            </select>
          </div>
        </div>
      </form>
    `,
    footer: `
      <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" class="admin-btn admin-btn-secondary" data-overlay-close>Cancelar</button>
        <button type="submit" form="task-form" class="admin-btn admin-btn-primary">${task ? 'Guardar cambios' : 'Crear tarea'}</button>
      </div>
    `,
  });

  modal.panel.querySelector<HTMLFormElement>('#task-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const value = (id: string) => modal.panel.querySelector<HTMLInputElement>(`#${id}`)?.value.trim() ?? '';
    const select = (id: string) => modal.panel.querySelector<HTMLSelectElement>(`#${id}`)?.value ?? '';
    if (!value('task-title') || !select('task-assignee') || !value('task-start') || !value('task-due')) {
      toast('Completa los campos obligatorios de la tarea.', 'warning');
      return;
    }
    try {
      if (task) {
        updateTask(project.id, task.id, {
          title: value('task-title'),
          description: value('task-description'),
          assigneeId: select('task-assignee'),
          priority: select('task-priority') as Priority,
          startDate: value('task-start'),
          dueDate: value('task-due'),
          status: select('task-status') as TaskStatus,
        });
      } else {
        addTask(project.id, {
          title: value('task-title'),
          description: value('task-description'),
          assigneeId: select('task-assignee'),
          priority: select('task-priority') as Priority,
          startDate: value('task-start'),
          dueDate: value('task-due'),
          status: select('task-status') as TaskStatus,
        });
      }
      modal.close();
      toast(task ? 'Tarea actualizada.' : 'Tarea creada.', 'success');
      renderDetail();
    } catch (error) {
      toastError(error);
    }
  });
}

function openFileModal(project: Project): void {
  const modal = openModal({
    title: 'Registrar archivo',
    subtitle: 'Los archivos son simulados: solo se guardan sus metadatos en este navegador.',
    size: 'sm',
    content: `
      <form id="file-form" class="space-y-4">
        <div>
          <label class="admin-label" for="file-name">Nombre del archivo *</label>
          <input id="file-name" class="admin-input" required placeholder="Ej. Cotizacion-final.pdf" />
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label class="admin-label" for="file-kind">Tipo *</label>
            <select id="file-kind" class="admin-select">
              ${(Object.keys(FILE_KIND_LABEL) as ProjectFileKind[])
                .map((kind) => `<option value="${kind}">${FILE_KIND_LABEL[kind]}</option>`)
                .join('')}
            </select>
          </div>
          <div>
            <label class="admin-label" for="file-size">Tamaño (KB) *</label>
            <input id="file-size" type="number" min="1" step="1" class="admin-input" required value="480" />
          </div>
        </div>
        <p class="rounded-lg border border-info/20 bg-info-soft/60 p-3 text-xs leading-relaxed text-charcoal/80">
          Prototipo sin almacenamiento real: no se sube ningún archivo, solo se registra la referencia para el equipo.
        </p>
      </form>
    `,
    footer: `
      <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" class="admin-btn admin-btn-secondary" data-overlay-close>Cancelar</button>
        <button type="submit" form="file-form" class="admin-btn admin-btn-primary">${icon('upload', 'h-4 w-4')} Registrar</button>
      </div>
    `,
  });

  modal.panel.querySelector<HTMLFormElement>('#file-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = modal.panel.querySelector<HTMLInputElement>('#file-name')?.value.trim() ?? '';
    const kind = modal.panel.querySelector<HTMLSelectElement>('#file-kind')?.value as ProjectFileKind;
    const size = Number(modal.panel.querySelector<HTMLInputElement>('#file-size')?.value ?? 0);
    if (!name) {
      toast('Ingresa el nombre del archivo.', 'warning');
      return;
    }
    try {
      addProjectFile(project.id, { name, kind, sizeKb: Number.isFinite(size) && size > 0 ? size : 1 });
      modal.close();
      toast('Archivo registrado en el proyecto.', 'success');
      renderDetail();
    } catch (error) {
      toastError(error);
    }
  });
}

function openTeamModal(project: Project): void {
  const available = loadState().users.filter(
    (user) => user.status === 'activo' && !project.teamIds.includes(user.id),
  );
  const modal = openModal({
    title: 'Agregar integrante',
    subtitle: 'Suma a un compañero al equipo del proyecto.',
    size: 'sm',
    content: `
      <form id="team-form" class="space-y-4">
        ${
          available.length
            ? `<div>
                <label class="admin-label" for="team-user">Integrante *</label>
                <select id="team-user" class="admin-select" required>
                  <option value="">Selecciona un integrante</option>
                  ${available
                    .map(
                      (user) =>
                        `<option value="${user.id}">${escapeHtml(memberName(user))} · ${escapeHtml(user.jobTitle)}</option>`,
                    )
                    .join('')}
                </select>
              </div>`
            : `<p class="rounded-lg border border-line bg-natural/70 p-3 text-sm text-muted">Todos los usuarios activos ya forman parte del proyecto.</p>`
        }
      </form>
    `,
    footer: `
      <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" class="admin-btn admin-btn-secondary" data-overlay-close>Cancelar</button>
        ${
          available.length
            ? '<button type="submit" form="team-form" class="admin-btn admin-btn-primary">Agregar al equipo</button>'
            : ''
        }
      </div>
    `,
  });

  modal.panel.querySelector<HTMLFormElement>('#team-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const userId = modal.panel.querySelector<HTMLSelectElement>('#team-user')?.value ?? '';
    if (!userId) {
      toast('Selecciona un integrante.', 'warning');
      return;
    }
    try {
      addProjectMember(project.id, userId);
      modal.close();
      toast('Integrante agregado al equipo.', 'success');
      renderDetail();
    } catch (error) {
      toastError(error);
    }
  });
}

/* ------------------------------------------------------------------ */
/* Eventos                                                            */
/* ------------------------------------------------------------------ */

function bindTaskEvents(project: Project): void {
  document.querySelectorAll<HTMLButtonElement>('[data-task-view]').forEach((button) => {
    button.addEventListener('click', () => {
      taskView = button.dataset.taskView === 'kanban' ? 'kanban' : 'lista';
      const container = document.getElementById('tasks-container');
      if (container) container.innerHTML = renderTasksBody(project);
      document.querySelectorAll<HTMLButtonElement>('[data-task-view]').forEach((other) => {
        const active = other.dataset.taskView === taskView;
        other.classList.toggle('admin-chip-active', active);
        other.setAttribute('aria-pressed', String(active));
      });
      bindTaskBodyEvents(project);
    });
  });

  document.querySelectorAll<HTMLElement>('[data-task-new]').forEach((button) => {
    button.addEventListener('click', () => openTaskModal(project));
  });

  bindTaskBodyEvents(project);
}

function bindTaskBodyEvents(project: Project): void {
  document.querySelectorAll<HTMLButtonElement>('[data-task-edit]').forEach((button) => {
    button.addEventListener('click', () => {
      const task = project.tasks.find((item) => item.id === button.dataset.taskEdit);
      if (task) openTaskModal(project, task);
    });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-task-delete]').forEach((button) => {
    button.addEventListener('click', async () => {
      const task = project.tasks.find((item) => item.id === button.dataset.taskDelete);
      if (!task) return;
      const confirmed = await confirmDialog({
        title: 'Eliminar tarea',
        message: `¿Eliminar la tarea "${task.title}"? Esta acción no se puede deshacer.`,
        confirmLabel: 'Eliminar',
        tone: 'danger',
      });
      if (!confirmed) return;
      try {
        deleteTask(project.id, task.id);
        toast('Tarea eliminada.', 'success');
        renderDetail();
      } catch (error) {
        toastError(error);
      }
    });
  });

  document.querySelectorAll<HTMLInputElement>('[data-task-toggle]').forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      const taskId = checkbox.dataset.taskToggle ?? '';
      const task = project.tasks.find((item) => item.id === taskId);
      if (!task) return;
      try {
        updateTask(project.id, taskId, { status: checkbox.checked ? 'completada' : 'pendiente' });
        toast(checkbox.checked ? 'Tarea completada.' : 'Tarea reabierta.', 'success');
        renderDetail();
      } catch (error) {
        toastError(error);
      }
    });
  });

  document.querySelectorAll<HTMLSelectElement>('[data-task-status]').forEach((select) => {
    select.addEventListener('change', () => {
      try {
        updateTask(project.id, select.dataset.taskStatus ?? '', { status: select.value as TaskStatus });
        toast('Estado de la tarea actualizado.', 'success');
        renderDetail();
      } catch (error) {
        toastError(error);
      }
    });
  });

  document.querySelectorAll<HTMLElement>('[data-task-card]').forEach((card) => {
    card.addEventListener('dragstart', (event) => {
      card.classList.add('dragging');
      event.dataTransfer?.setData('text/plain', card.dataset.taskCard ?? '');
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
  });

  document.querySelectorAll<HTMLElement>('[data-task-drop]').forEach((column) => {
    column.addEventListener('dragover', (event) => {
      event.preventDefault();
      column.classList.add('drag-over');
    });
    column.addEventListener('dragleave', (event) => {
      if (!column.contains(event.relatedTarget as Node)) column.classList.remove('drag-over');
    });
    column.addEventListener('drop', (event) => {
      event.preventDefault();
      column.classList.remove('drag-over');
      const taskId = event.dataTransfer?.getData('text/plain') ?? '';
      const status = column.dataset.taskDrop as TaskStatus;
      if (!taskId || !status) return;
      try {
        updateTask(project.id, taskId, { status });
        toast('Tarea movida de estado.', 'success');
        renderDetail();
      } catch (error) {
        toastError(error);
      }
    });
  });
}

function bindSidebarEvents(project: Project): void {
  document.getElementById('project-status-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const select = document.getElementById('project-status-select') as HTMLSelectElement | null;
    if (!select || select.value === project.status) {
      toast('Selecciona un estado diferente para actualizar.', 'info');
      return;
    }
    try {
      setProjectStatus(project.id, select.value as ProjectStatus);
      toast('Estado del proyecto actualizado.', 'success');
      renderDetail();
    } catch (error) {
      toastError(error);
    }
  });

  document.querySelectorAll<HTMLElement>('[data-team-add]').forEach((button) => {
    button.addEventListener('click', () => openTeamModal(project));
  });

  document.querySelectorAll<HTMLButtonElement>('[data-team-remove]').forEach((button) => {
    button.addEventListener('click', async () => {
      const userId = button.dataset.teamRemove ?? '';
      const user = loadState().users.find((item) => item.id === userId);
      const confirmed = await confirmDialog({
        title: 'Quitar integrante',
        message: `¿Quitar a ${user ? memberName(user) : 'este integrante'} del equipo del proyecto?`,
        confirmLabel: 'Quitar',
        tone: 'danger',
      });
      if (!confirmed) return;
      try {
        removeProjectMember(project.id, userId);
        toast('Integrante retirado del equipo.', 'success');
        renderDetail();
      } catch (error) {
        toastError(error);
      }
    });
  });
}

function bindFileEvents(project: Project): void {
  document.querySelectorAll<HTMLElement>('[data-file-new]').forEach((button) => {
    button.addEventListener('click', () => openFileModal(project));
  });
}

function bindCommentForm(project: Project): void {
  const form = document.getElementById('project-comment-form') as HTMLFormElement | null;
  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const textarea = document.getElementById('project-comment') as HTMLTextAreaElement | null;
    if (!textarea?.value.trim()) return;
    try {
      addProjectComment(project.id, textarea.value.trim());
      toast('Comentario publicado.', 'success');
      renderDetail();
    } catch (error) {
      toastError(error);
    }
  });
}

function bindMainEvents(project: Project): void {
  bindTaskEvents(project);
  bindFileEvents(project);
  bindCommentForm(project);
}

/* ------------------------------------------------------------------ */
/* Render                                                             */
/* ------------------------------------------------------------------ */

export function renderDetail(): void {
  const state = loadState();
  const project = state.projects.find((item) => item.id === projectId());
  const main = document.getElementById('project-main');
  const sidebar = document.getElementById('project-sidebar');

  if (!project) {
    if (main) {
      main.innerHTML = emptyStateHtml({
        iconName: 'alert',
        title: 'No encontramos el proyecto',
        description: 'El registro no existe en este navegador o fue eliminado.',
        action: '<a href="/admin/proyectos" class="admin-btn admin-btn-primary admin-btn-sm">Volver a proyectos</a>',
      });
    }
    if (sidebar) sidebar.innerHTML = '';
    return;
  }

  renderHeader(project);
  if (main) {
    main.innerHTML = [
      overviewCard(project),
      timelineCard(project),
      tasksCard(project),
      filesCard(project),
      activityCard(project),
    ].join('');
  }
  if (sidebar) {
    sidebar.innerHTML = [statusCard(project), teamCard(project), clientCard(project)].join('');
  }
  bindMainEvents(project);
  bindSidebarEvents(project);
}

export function initProjectDetail(): void {
  renderDetail();
}
