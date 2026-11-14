import type {
  AdminState,
  DashboardMetrics,
  ProjectStatus,
  RequestStatus,
} from '../types/admin';
import { PROJECT_STATUS_LABEL, PROJECT_STATUS_ORDER } from './status';
import { isProjectActive } from './project';

export interface ChartPoint {
  label: string;
  value: number;
  color?: string;
}

export interface StatusPoint extends ChartPoint {
  status: ProjectStatus;
}

export const PROJECT_STATUS_HEX: Record<ProjectStatus, string> = {
  'por-planificar': '#98A2B3',
  planificacion: '#175CD3',
  'visita-tecnica': '#6366F1',
  diseno: '#9333EA',
  materiales: '#B54708',
  'instalacion-programada': '#F5B82E',
  'en-instalacion': '#123B2A',
  inspeccion: '#0F766E',
  finalizado: '#067647',
  cancelado: '#B42318',
};

export function dashboardMetrics(state: AdminState): DashboardMetrics {
  const totalSolicitudes = state.solicitudes.length;
  const pendingStatuses: RequestStatus[] = ['nueva', 'en-revision', 'pendiente-info'];
  const quoteSentStatuses: RequestStatus[] = [
    'cotizacion-enviada',
    'aceptada',
    'rechazada',
    'convertida',
  ];
  const acceptedStatuses: RequestStatus[] = ['aceptada', 'convertida'];

  const pendingSolicitudes = state.solicitudes.filter((item) =>
    pendingStatuses.includes(item.status),
  ).length;
  const quotesSent = state.solicitudes.filter((item) =>
    quoteSentStatuses.includes(item.status),
  ).length;
  const quotesAccepted = state.solicitudes.filter((item) =>
    acceptedStatuses.includes(item.status),
  ).length;
  const activeProjects = state.projects.filter((item) => isProjectActive(item.status)).length;
  const completedProjects = state.projects.filter((item) => item.status === 'finalizado').length;
  const totalProjectValue = state.projects
    .filter((item) => item.status !== 'cancelado')
    .reduce((sum, item) => sum + item.amount, 0);
  const converted = state.solicitudes.filter((item) => item.projectId).length;
  const conversionRate = totalSolicitudes > 0 ? (converted / totalSolicitudes) * 100 : 0;

  return {
    totalSolicitudes,
    pendingSolicitudes,
    quotesSent,
    quotesAccepted,
    activeProjects,
    completedProjects,
    totalProjectValue,
    conversionRate,
  };
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function lastMonths(count: number): Date[] {
  const now = new Date();
  const months: Date[] = [];
  for (let index = count - 1; index >= 0; index -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    months.push(date);
  }
  return months;
}

export function requestsByMonth(state: AdminState, count = 6): ChartPoint[] {
  const months = lastMonths(count);
  const buckets = new Map<string, number>();
  months.forEach((date) => buckets.set(monthKey(date), 0));
  state.solicitudes.forEach((item) => {
    const key = monthKey(new Date(item.createdAt));
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  });
  return months.map((date) => ({
    label: new Intl.DateTimeFormat('es-MX', { month: 'short' }).format(date).replace('.', ''),
    value: buckets.get(monthKey(date)) ?? 0,
  }));
}

export function revenueByMonth(state: AdminState, count = 6): ChartPoint[] {
  const months = lastMonths(count);
  const buckets = new Map<string, number>();
  months.forEach((date) => buckets.set(monthKey(date), 0));
  state.projects
    .filter((item) => item.status !== 'cancelado')
    .forEach((item) => {
      const key = monthKey(new Date(item.startDate));
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + item.amount);
    });
  return months.map((date) => ({
    label: new Intl.DateTimeFormat('es-MX', { month: 'short' }).format(date).replace('.', ''),
    value: buckets.get(monthKey(date)) ?? 0,
  }));
}

export function projectsByStatus(state: AdminState): StatusPoint[] {
  return PROJECT_STATUS_ORDER.map((status) => ({
    status,
    label: PROJECT_STATUS_LABEL[status],
    value: state.projects.filter((item) => item.status === status).length,
    color: PROJECT_STATUS_HEX[status],
  })).filter((item) => item.value > 0);
}

export function quoteOutcomes(state: AdminState): ChartPoint[] {
  const accepted = state.solicitudes.filter((item) =>
    ['aceptada', 'convertida'].includes(item.status),
  ).length;
  const rejected = state.solicitudes.filter((item) => item.status === 'rechazada').length;
  const sent = state.solicitudes.filter((item) => item.status === 'cotizacion-enviada').length;
  const inProgress = state.solicitudes.filter((item) =>
    ['nueva', 'en-revision', 'pendiente-info', 'cotizacion-calculada'].includes(item.status),
  ).length;

  return [
    { label: 'Aceptadas', value: accepted, color: '#067647' },
    { label: 'Rechazadas', value: rejected, color: '#B42318' },
    { label: 'Enviadas sin respuesta', value: sent, color: '#175CD3' },
    { label: 'En proceso', value: inProgress, color: '#98A2B3' },
  ].filter((item) => item.value > 0);
}

export function allProjectTasks(state: AdminState) {
  return state.projects.flatMap((project) =>
    project.tasks.map((task) => ({ ...task, project })),
  );
}

export function unassignedSolicitudes(state: AdminState) {
  return state.solicitudes.filter(
    (item) => !item.responsibleUserId && item.status !== 'convertida' && item.status !== 'rechazada',
  );
}

export function overdueTasks(state: AdminState) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return allProjectTasks(state).filter((task) => {
    if (task.status === 'completada') return false;
    const due = new Date(task.dueDate);
    due.setHours(0, 0, 0, 0);
    return due.getTime() < today.getTime();
  });
}
