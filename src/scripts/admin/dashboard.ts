import {
  getSession,
  hasPermission,
  loadState,
  userName,
} from '../../services/store';
import {
  dashboardMetrics,
  overdueTasks,
  projectsByStatus,
  quoteOutcomes,
  requestsByMonth,
  revenueByMonth,
  unassignedSolicitudes,
} from '../../utils/metrics';
import {
  formatCurrency,
  formatDate,
  formatKwh,
  formatNumber,
  escapeHtml,
  relativeTime,
} from '../../utils/format';
import {
  PROJECT_STATUS_CLASS,
  PROJECT_STATUS_LABEL,
  PRIORITY_CLASS,
  PRIORITY_LABEL,
  REQUEST_STATUS_CLASS,
  REQUEST_STATUS_LABEL,
  PROJECT_TYPE_LABEL,
} from '../../utils/status';
import { areaChart, barChart, donutChart, funnelRows } from './charts';
import { icon, type IconName } from './icons';
import { emptyStateHtml, toastError } from './ui';

let chartPeriod = 6;

function kpiCard(options: {
  iconName: IconName;
  label: string;
  value: string;
  hint: string;
  tone: 'forest' | 'solar' | 'info' | 'success';
  href: string;
}): string {
  const tones = {
    forest: 'bg-light-green text-forest',
    solar: 'bg-solar-soft text-[#9A6700]',
    info: 'bg-info-soft text-info',
    success: 'bg-success-soft text-success',
  };
  return `
    <a href="${options.href}" class="admin-kpi group block">
      <div class="flex items-start justify-between gap-3">
        <span class="flex h-10 w-10 items-center justify-center rounded-xl ${tones[options.tone]}">
          ${icon(options.iconName, 'h-5 w-5')}
        </span>
        <span class="text-muted/50 transition-transform group-hover:translate-x-0.5 group-hover:text-forest">
          ${icon('arrowRight', 'h-4 w-4')}
        </span>
      </div>
      <p class="mt-4 font-display text-3xl font-extrabold tracking-tight text-forest">${options.value}</p>
      <p class="mt-1 text-sm font-semibold text-charcoal">${escapeHtml(options.label)}</p>
      <p class="mt-0.5 text-xs text-muted">${escapeHtml(options.hint)}</p>
    </a>
  `;
}

function renderKpis(): void {
  const container = document.getElementById('dashboard-kpis');
  if (!container) return;
  const state = loadState();
  const metrics = dashboardMetrics(state);
  container.innerHTML = [
    kpiCard({
      iconName: 'file',
      label: 'Solicitudes pendientes',
      value: formatNumber(metrics.pendingSolicitudes),
      hint: `${formatNumber(metrics.totalSolicitudes)} solicitudes en total`,
      tone: 'solar',
      href: '/admin/solicitudes?status=pendientes',
    }),
    kpiCard({
      iconName: 'send',
      label: 'Cotizaciones enviadas',
      value: formatNumber(metrics.quotesSent),
      hint: `${formatNumber(metrics.quotesAccepted)} aceptadas · ${metrics.conversionRate.toFixed(0)}% conversión`,
      tone: 'info',
      href: '/admin/solicitudes?status=cotizacion-enviada',
    }),
    kpiCard({
      iconName: 'kanban',
      label: 'Proyectos activos',
      value: formatNumber(metrics.activeProjects),
      hint: `${formatNumber(metrics.completedProjects)} finalizados`,
      tone: 'forest',
      href: '/admin/proyectos?status=activos',
    }),
    kpiCard({
      iconName: 'dollar',
      label: 'Valor de proyectos',
      value: formatCurrency(metrics.totalProjectValue),
      hint: 'Cartera sin proyectos cancelados',
      tone: 'success',
      href: '/admin/proyectos',
    }),
  ].join('');
}

function renderCharts(): void {
  const state = loadState();
  const revenue = document.getElementById('chart-revenue');
  const requests = document.getElementById('chart-requests');
  const status = document.getElementById('chart-status');
  const outcomes = document.getElementById('chart-outcomes');

  [revenue, requests, status, outcomes].forEach((node) => node?.classList.remove('admin-skeleton'));

  if (revenue) {
    revenue.innerHTML = areaChart(revenueByMonth(state, chartPeriod), {
      color: '#123B2A',
      valueFormatter: (value) => `$${formatNumber(value)}`,
    });
  }
  if (requests) {
    requests.innerHTML = barChart(requestsByMonth(state, chartPeriod), { color: '#F5B82E' });
  }
  if (status) {
    status.innerHTML = donutChart(projectsByStatus(state), {
      centerLabel: 'Proyectos',
      centerValue: formatNumber(state.projects.length),
      size: 190,
    });
  }
  if (outcomes) {
    outcomes.innerHTML = funnelRows(quoteOutcomes(state), {
      valueFormatter: (value) => formatNumber(value),
    });
  }

  document.querySelectorAll<HTMLButtonElement>('[data-chart-period]').forEach((button) => {
    button.classList.toggle('admin-chip-active', Number(button.dataset.chartPeriod) === chartPeriod);
    if (button.dataset.bound === 'true') return;
    button.dataset.bound = 'true';
    button.addEventListener('click', () => {
      chartPeriod = Number(button.dataset.chartPeriod) || 6;
      renderCharts();
    });
  });
}

function renderAlerts(): void {
  const container = document.getElementById('dashboard-alerts');
  if (!container) return;
  const state = loadState();
  const unassigned = unassignedSolicitudes(state);
  const overdue = overdueTasks(state);
  const alerts: string[] = [];

  if (unassigned.length > 0) {
    alerts.push(`
      <a href="/admin/solicitudes?assigned=unassigned" class="flex items-start gap-3 rounded-xl border border-solar/30 bg-solar-soft/70 p-3.5 transition-colors hover:border-solar">
        <span class="mt-0.5 text-[#9A6700]">${icon('alert', 'h-5 w-5')}</span>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold text-charcoal">${unassigned.length} solicitud(es) sin responsable</p>
          <p class="mt-0.5 truncate text-xs text-charcoal/65">${escapeHtml(
            unassigned
              .slice(0, 2)
              .map((item) => item.client.name)
              .join(' · '),
          )}</p>
        </div>
        ${icon('chevronRight', 'h-4 w-4 shrink-0 text-charcoal/40')}
      </a>
    `);
  }
  if (overdue.length > 0) {
    alerts.push(`
      <a href="/admin/proyectos?vista=kanban" class="flex items-start gap-3 rounded-xl border border-danger/20 bg-danger-soft/60 p-3.5 transition-colors hover:border-danger/40">
        <span class="mt-0.5 text-danger">${icon('clock', 'h-5 w-5')}</span>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold text-charcoal">${overdue.length} tarea(s) vencida(s)</p>
          <p class="mt-0.5 truncate text-xs text-charcoal/65">${escapeHtml(
            overdue
              .slice(0, 2)
              .map((task) => task.title)
              .join(' · '),
          )}</p>
        </div>
        ${icon('chevronRight', 'h-4 w-4 shrink-0 text-charcoal/40')}
      </a>
    `);
  }

  container.innerHTML = alerts.join('');
  container.classList.toggle('hidden', alerts.length === 0);
}

function renderRecentRequests(): void {
  const container = document.getElementById('dashboard-requests');
  if (!container) return;
  const state = loadState();
  const requests = state.solicitudes.slice(0, 6);

  if (requests.length === 0) {
    container.innerHTML = emptyStateHtml({
      iconName: 'file',
      title: 'Sin solicitudes todavía',
      description: 'Las solicitudes del cotizador público aparecerán aquí.',
      action: '<a href="/solicitar-cotizacion" class="admin-btn admin-btn-primary admin-btn-sm">Abrir cotizador</a>',
    });
    return;
  }

  container.innerHTML = `
    <div class="overflow-x-auto">
      <table class="admin-table min-w-[720px]">
        <thead>
          <tr>
            <th>Folio</th>
            <th>Cliente</th>
            <th>Consumo</th>
            <th>Estimado</th>
            <th>Estado</th>
            <th>Registro</th>
          </tr>
        </thead>
        <tbody>
          ${requests
            .map(
              (request) => `
            <tr class="cursor-pointer" data-href="/admin/solicitudes/${request.id}">
              <td>
                <a class="font-mono text-xs font-semibold text-forest hover:underline" href="/admin/solicitudes/${request.id}">
                  ${escapeHtml(request.folio)}
                </a>
              </td>
              <td>
                <p class="font-semibold text-charcoal">${escapeHtml(request.client.name)}</p>
                <p class="text-xs text-muted">${escapeHtml(request.client.location)}</p>
              </td>
              <td class="whitespace-nowrap">${formatKwh(request.energy.monthlyConsumptionKwh)}<span class="block text-xs text-muted">${escapeHtml(PROJECT_TYPE_LABEL[request.energy.projectType])}</span></td>
              <td class="whitespace-nowrap font-semibold">${formatCurrency(request.calculation.total)}</td>
              <td>
                <span class="admin-badge ${REQUEST_STATUS_CLASS[request.status]}">${REQUEST_STATUS_LABEL[request.status]}</span>
              </td>
              <td class="whitespace-nowrap text-xs text-muted">${formatDate(request.createdAt)}</td>
            </tr>
          `,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;

  container.querySelectorAll<HTMLElement>('tr[data-href]').forEach((row) => {
    row.addEventListener('click', (event) => {
      if ((event.target as HTMLElement).closest('a')) return;
      window.location.href = row.dataset.href ?? '';
    });
  });
}

function renderActivity(): void {
  const container = document.getElementById('dashboard-activity');
  if (!container) return;
  const state = loadState();
  const items = state.activities.slice(0, 8);

  if (items.length === 0) {
    container.innerHTML = emptyStateHtml({
      iconName: 'activity',
      title: 'Sin actividad reciente',
      description: 'Cuando el equipo haga cambios, verás el historial aquí.',
    });
    return;
  }

  const typeIcon: Record<string, IconName> = {
    solicitud: 'file',
    estado: 'refresh',
    cotizacion: 'dollar',
    proyecto: 'kanban',
    tarea: 'checkCircle',
    comentario: 'message',
    archivo: 'folder',
    usuario: 'user',
    sistema: 'settings',
  };

  container.innerHTML = `
    <ul class="space-y-1">
      ${items
        .map(
          (item) => `
        <li class="flex gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-natural/70">
          <span class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-light-green text-forest">
            ${icon(typeIcon[item.type] ?? 'activity', 'h-4 w-4')}
          </span>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium leading-snug text-charcoal">${escapeHtml(item.title)}</p>
            ${item.description ? `<p class="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted">${escapeHtml(item.description)}</p>` : ''}
            <p class="mt-1 text-[11px] text-muted">
              ${escapeHtml(userName(state, item.actorId))} · ${escapeHtml(relativeTime(item.timestamp))}
            </p>
          </div>
        </li>
      `,
        )
        .join('')}
    </ul>
  `;
}

function renderTasks(): void {
  const container = document.getElementById('dashboard-tasks');
  if (!container) return;
  const state = loadState();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const limit = new Date(today);
  limit.setDate(limit.getDate() + 7);

  const tasks = state.projects
    .flatMap((project) => project.tasks.map((task) => ({ task, project })))
    .filter(({ task }) => task.status !== 'completada')
    .filter(({ task }) => {
      const due = new Date(task.dueDate);
      due.setHours(0, 0, 0, 0);
      return due.getTime() <= limit.getTime();
    })
    .sort((a, b) => new Date(a.task.dueDate).getTime() - new Date(b.task.dueDate).getTime())
    .slice(0, 6);

  if (tasks.length === 0) {
    container.innerHTML = emptyStateHtml({
      iconName: 'checkCircle',
      title: 'Sin tareas próximas',
      description: 'No hay tareas pendientes con vencimiento en los próximos 7 días.',
    });
    return;
  }

  container.innerHTML = `
    <ul class="divide-y divide-line/70">
      ${tasks
        .map(({ task, project }) => {
          const due = new Date(task.dueDate);
          due.setHours(0, 0, 0, 0);
          const diff = Math.round((due.getTime() - today.getTime()) / 86_400_000);
          const dueLabel =
            diff < 0 ? `Vencida hace ${Math.abs(diff)} d` : diff === 0 ? 'Vence hoy' : `En ${diff} d`;
          return `
          <li class="flex items-start gap-3 px-2 py-3">
            <span class="mt-1 h-2 w-2 shrink-0 rounded-full ${diff < 0 ? 'bg-danger' : diff <= 2 ? 'bg-warning' : 'bg-info'}"></span>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium text-charcoal">${escapeHtml(task.title)}</p>
              <a href="/admin/proyectos/${project.id}" class="mt-0.5 block truncate text-xs text-muted hover:text-forest hover:underline">
                ${escapeHtml(project.folio)} · ${escapeHtml(project.name)}
              </a>
              <div class="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span class="admin-badge ${PRIORITY_CLASS[task.priority]}">${PRIORITY_LABEL[task.priority]}</span>
                <span class="text-[11px] font-medium ${diff < 0 ? 'text-danger' : 'text-muted'}">${dueLabel}</span>
              </div>
            </div>
          </li>
        `;
        })
        .join('')}
    </ul>
  `;
}

function renderProjectSnapshot(): void {
  const container = document.getElementById('dashboard-projects');
  if (!container) return;
  const state = loadState();
  const projects = state.projects
    .filter((project) => !['finalizado', 'cancelado'].includes(project.status))
    .sort((a, b) => b.progress - a.progress)
    .slice(0, 4);

  if (projects.length === 0) {
    container.innerHTML = emptyStateHtml({
      iconName: 'kanban',
      title: 'Sin proyectos activos',
      description: 'Convierte una solicitud aceptada para comenzar un proyecto.',
    });
    return;
  }

  container.innerHTML = `
    <ul class="space-y-4">
      ${projects
        .map(
          (project) => `
        <li>
          <div class="flex items-start justify-between gap-3">
            <a href="/admin/proyectos/${project.id}" class="min-w-0">
              <p class="truncate text-sm font-semibold text-charcoal hover:text-forest hover:underline">${escapeHtml(project.name)}</p>
              <p class="text-xs text-muted">${escapeHtml(project.folio)} · ${escapeHtml(project.client.name)}</p>
            </a>
            <span class="admin-badge shrink-0 ${PROJECT_STATUS_CLASS[project.status]}">${PROJECT_STATUS_LABEL[project.status]}</span>
          </div>
          <div class="mt-2 flex items-center gap-3">
            <div class="admin-progress flex-1">
              <div class="admin-progress-bar" style="width:${project.progress}%"></div>
            </div>
            <span class="w-10 shrink-0 text-right text-xs font-semibold text-charcoal">${project.progress}%</span>
          </div>
          <p class="mt-1.5 text-[11px] text-muted">${formatCurrency(project.amount)} · ${escapeHtml(project.location)}</p>
        </li>
      `,
        )
        .join('')}
    </ul>
  `;
}

function bindQuickActions(): void {
  const button = document.getElementById('dashboard-refresh');
  button?.addEventListener('click', () => {
    try {
      renderAll();
      import('./ui').then(({ toast }) => toast('Métricas actualizadas con los datos actuales.', 'success'));
    } catch (error) {
      toastError(error);
    }
  });
}

function renderAll(): void {
  renderKpis();
  renderCharts();
  renderAlerts();
  renderRecentRequests();
  renderActivity();
  renderTasks();
  renderProjectSnapshot();
}

export function initDashboard(): void {
  const session = getSession();
  if (session && !hasPermission(session.roleId, 'dashboard', 'ver')) {
    window.location.replace('/admin/proyectos');
    return;
  }
  renderAll();
  bindQuickActions();
}
