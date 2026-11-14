import type {
  ModuleKey,
  PermissionAction,
  SpecialPermission,
  Priority,
  ProjectStatus,
  RequestStatus,
  TaskStatus,
  UserStatus,
} from '../types/admin';
import type { ProjectType, SystemType } from '../types/solar';
import type { EventCategory, EventStatus } from '../types/calendar';

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  nueva: 'Nueva',
  'en-revision': 'En revisión',
  'pendiente-info': 'Pendiente de información',
  'cotizacion-calculada': 'Cotización calculada',
  'cotizacion-enviada': 'Cotización enviada',
  aceptada: 'Aceptada',
  rechazada: 'Rechazada',
  convertida: 'Convertida en proyecto',
};

export const REQUEST_STATUS_CLASS: Record<RequestStatus, string> = {
  nueva: 'bg-info-soft text-info border-info/20',
  'en-revision': 'bg-warning-soft text-warning border-warning/20',
  'pendiente-info': 'bg-solar-soft text-forest border-solar/30',
  'cotizacion-calculada': 'bg-light-green text-forest border-forest/15',
  'cotizacion-enviada': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  aceptada: 'bg-success-soft text-success border-success/20',
  rechazada: 'bg-danger-soft text-danger border-danger/20',
  convertida: 'bg-forest text-white border-forest',
};

export const REQUEST_STATUS_ORDER: RequestStatus[] = [
  'nueva',
  'en-revision',
  'pendiente-info',
  'cotizacion-calculada',
  'cotizacion-enviada',
  'aceptada',
  'rechazada',
  'convertida',
];

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  'por-planificar': 'Por planificar',
  planificacion: 'Planificación',
  'visita-tecnica': 'Visita técnica',
  diseno: 'Diseño del sistema',
  materiales: 'Preparación de materiales',
  'instalacion-programada': 'Instalación programada',
  'en-instalacion': 'En instalación',
  inspeccion: 'Inspección y pruebas',
  finalizado: 'Finalizado',
  cancelado: 'Cancelado',
};

export const PROJECT_STATUS_CLASS: Record<ProjectStatus, string> = {
  'por-planificar': 'bg-slate-100 text-slate-700 border-slate-200',
  planificacion: 'bg-info-soft text-info border-info/20',
  'visita-tecnica': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  diseno: 'bg-purple-50 text-purple-700 border-purple-200',
  materiales: 'bg-warning-soft text-warning border-warning/20',
  'instalacion-programada': 'bg-solar-soft text-forest border-solar/30',
  'en-instalacion': 'bg-light-green text-forest border-forest/15',
  inspeccion: 'bg-teal-50 text-teal-700 border-teal-200',
  finalizado: 'bg-success-soft text-success border-success/20',
  cancelado: 'bg-danger-soft text-danger border-danger/20',
};

export const PROJECT_STATUS_DOT: Record<ProjectStatus, string> = {
  'por-planificar': 'bg-slate-400',
  planificacion: 'bg-info',
  'visita-tecnica': 'bg-indigo-500',
  diseno: 'bg-purple-500',
  materiales: 'bg-warning',
  'instalacion-programada': 'bg-solar',
  'en-instalacion': 'bg-forest',
  inspeccion: 'bg-teal-500',
  finalizado: 'bg-success',
  cancelado: 'bg-danger',
};

export const PROJECT_STATUS_ORDER: ProjectStatus[] = [
  'por-planificar',
  'planificacion',
  'visita-tecnica',
  'diseno',
  'materiales',
  'instalacion-programada',
  'en-instalacion',
  'inspeccion',
  'finalizado',
  'cancelado',
];

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  pendiente: 'Pendiente',
  'en-progreso': 'En progreso',
  'en-revision': 'En revisión',
  completada: 'Completada',
};

export const TASK_STATUS_CLASS: Record<TaskStatus, string> = {
  pendiente: 'bg-slate-100 text-slate-700 border-slate-200',
  'en-progreso': 'bg-info-soft text-info border-info/20',
  'en-revision': 'bg-warning-soft text-warning border-warning/20',
  completada: 'bg-success-soft text-success border-success/20',
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
  urgente: 'Urgente',
};

/** Etiquetas del módulo de tareas generales (la prioridad media se muestra como Normal). */
export const TASK_PRIORITY_LABEL: Record<Priority, string> = {
  baja: 'Baja',
  media: 'Normal',
  alta: 'Alta',
  urgente: 'Urgente',
};

export const PRIORITY_CLASS: Record<Priority, string> = {
  baja: 'bg-slate-100 text-slate-600 border-slate-200',
  media: 'bg-info-soft text-info border-info/20',
  alta: 'bg-warning-soft text-warning border-warning/20',
  urgente: 'bg-danger-soft text-danger border-danger/20',
};

export const USER_STATUS_LABEL: Record<UserStatus, string> = {
  activo: 'Activo',
  invitacion: 'Invitación pendiente',
  suspendido: 'Suspendido',
};

export const USER_STATUS_CLASS: Record<UserStatus, string> = {
  activo: 'bg-success-soft text-success border-success/20',
  invitacion: 'bg-warning-soft text-warning border-warning/20',
  suspendido: 'bg-slate-100 text-slate-600 border-slate-200',
};

export const PROJECT_TYPE_LABEL: Record<ProjectType, string> = {
  residencial: 'Residencial',
  comercial: 'Comercial',
  industrial: 'Industrial',
  respaldo: 'Respaldo',
};

export const SYSTEM_TYPE_LABEL: Record<SystemType, string> = {
  interconectado: 'Conectado a la red',
  baterias: 'Con baterías de respaldo',
  hibrido: 'Sistema híbrido',
};

export const MODULE_LABEL: Record<ModuleKey, string> = {
  dashboard: 'Dashboard',
  solicitudes: 'Solicitudes',
  cotizaciones: 'Cotizaciones',
  proyectos: 'Proyectos',
  tareas: 'Tareas',
  agenda: 'Agenda',
  usuarios: 'Usuarios',
  roles: 'Roles',
  configuracion: 'Configuración',
};

export const PERMISSION_LABEL: Record<PermissionAction, string> = {
  ver: 'Ver',
  crear: 'Crear',
  editar: 'Editar',
  eliminar: 'Eliminar',
};

export const SPECIAL_PERMISSION_LABEL: Record<SpecialPermission, string> = {
  asignar: 'Asignar',
  ver_todas: 'Ver todas',
};

export const AGENDA_CATEGORY_LABEL: Record<EventCategory, string> = {
  'visita-tecnica': 'Visita técnica',
  levantamiento: 'Levantamiento',
  instalacion: 'Instalación',
  mantenimiento: 'Mantenimiento',
  'reunion-cliente': 'Reunión con cliente',
  'reunion-interna': 'Reunión interna',
  'entrega-materiales': 'Entrega de materiales',
  inspeccion: 'Inspección',
  'seguimiento-comercial': 'Seguimiento comercial',
  otro: 'Otro',
};

export const AGENDA_CATEGORY_CHIP: Record<EventCategory, string> = {
  'visita-tecnica': 'bg-info-soft text-info border-info/25',
  levantamiento: 'bg-purple-50 text-purple-700 border-purple-200',
  instalacion: 'bg-light-green text-forest border-forest/20',
  mantenimiento: 'bg-warning-soft text-warning border-warning/25',
  'reunion-cliente': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'reunion-interna': 'bg-slate-100 text-slate-700 border-slate-200',
  'entrega-materiales': 'bg-teal-50 text-teal-700 border-teal-200',
  inspeccion: 'bg-solar-soft text-forest border-solar/30',
  'seguimiento-comercial': 'bg-rose-50 text-rose-700 border-rose-200',
  otro: 'bg-natural text-charcoal border-line',
};

export const AGENDA_CATEGORY_DOT: Record<EventCategory, string> = {
  'visita-tecnica': 'bg-info',
  levantamiento: 'bg-purple-500',
  instalacion: 'bg-forest',
  mantenimiento: 'bg-warning',
  'reunion-cliente': 'bg-indigo-500',
  'reunion-interna': 'bg-slate-400',
  'entrega-materiales': 'bg-teal-500',
  inspeccion: 'bg-solar',
  'seguimiento-comercial': 'bg-rose-500',
  otro: 'bg-slate-400',
};

export const AGENDA_CATEGORY_BORDER: Record<EventCategory, string> = {
  'visita-tecnica': 'border-l-info',
  levantamiento: 'border-l-purple-500',
  instalacion: 'border-l-forest',
  mantenimiento: 'border-l-warning',
  'reunion-cliente': 'border-l-indigo-500',
  'reunion-interna': 'border-l-slate-400',
  'entrega-materiales': 'border-l-teal-500',
  inspeccion: 'border-l-solar',
  'seguimiento-comercial': 'border-l-rose-500',
  otro: 'border-l-slate-400',
};

export const AGENDA_CATEGORY_SOFT: Record<EventCategory, string> = {
  'visita-tecnica': 'bg-info-soft/70',
  levantamiento: 'bg-purple-50',
  instalacion: 'bg-light-green',
  mantenimiento: 'bg-warning-soft/70',
  'reunion-cliente': 'bg-indigo-50',
  'reunion-interna': 'bg-slate-100',
  'entrega-materiales': 'bg-teal-50',
  inspeccion: 'bg-solar-soft',
  'seguimiento-comercial': 'bg-rose-50',
  otro: 'bg-natural',
};

export const EVENT_STATUS_LABEL: Record<EventStatus, string> = {
  programada: 'Programada',
  confirmada: 'Confirmada',
  'en-curso': 'En curso',
  completada: 'Completada',
  cancelada: 'Cancelada',
};

export const EVENT_STATUS_CLASS: Record<EventStatus, string> = {
  programada: 'bg-info-soft text-info border-info/20',
  confirmada: 'bg-success-soft text-success border-success/20',
  'en-curso': 'bg-warning-soft text-warning border-warning/20',
  completada: 'bg-light-green text-forest border-forest/15',
  cancelada: 'bg-slate-100 text-slate-500 border-slate-200',
};

export const EVENT_STATUS_DOT: Record<EventStatus, string> = {
  programada: 'bg-info',
  confirmada: 'bg-success',
  'en-curso': 'bg-warning',
  completada: 'bg-forest',
  cancelada: 'bg-slate-400',
};

export const ACTIVITY_LABEL = {
  solicitud: 'Solicitud',
  estado: 'Estado',
  cotizacion: 'Cotización',
  proyecto: 'Proyecto',
  tarea: 'Tarea',
  agenda: 'Agenda',
  comentario: 'Comentario',
  archivo: 'Archivo',
  usuario: 'Usuario',
  sistema: 'Sistema',
} as const;

export function badge(value: string, label: string, className: string): string {
  return `<span class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${className}">${label}</span>`;
}
