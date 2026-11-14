import type { ProjectType, SolarEstimate, SystemType } from './solar';
import type { GeneralTask } from './task';
import type { CalendarEvent } from './calendar';

export const ADMIN_STATE_VERSION = 2;

export const REQUEST_STATUS_VALUES = [
  'nueva',
  'en-revision',
  'pendiente-info',
  'cotizacion-calculada',
  'cotizacion-enviada',
  'aceptada',
  'rechazada',
  'convertida',
] as const;
export type RequestStatus = (typeof REQUEST_STATUS_VALUES)[number];

export const PROJECT_STATUS_VALUES = [
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
] as const;
export type ProjectStatus = (typeof PROJECT_STATUS_VALUES)[number];

export const TASK_STATUS_VALUES = ['pendiente', 'en-progreso', 'en-revision', 'completada'] as const;
export type TaskStatus = (typeof TASK_STATUS_VALUES)[number];

export const PRIORITY_VALUES = ['baja', 'media', 'alta', 'urgente'] as const;
export type Priority = (typeof PRIORITY_VALUES)[number];

export const USER_STATUS_VALUES = ['activo', 'invitacion', 'suspendido'] as const;
export type UserStatus = (typeof USER_STATUS_VALUES)[number];

export const MODULE_VALUES = [
  'dashboard',
  'solicitudes',
  'cotizaciones',
  'proyectos',
  'tareas',
  'agenda',
  'usuarios',
  'roles',
  'configuracion',
] as const;
export type ModuleKey = (typeof MODULE_VALUES)[number];

export const PERMISSION_ACTION_VALUES = ['ver', 'crear', 'editar', 'eliminar'] as const;
export type PermissionAction = (typeof PERMISSION_ACTION_VALUES)[number];

export const SPECIAL_PERMISSION_VALUES = ['asignar', 'ver_todas'] as const;
export type SpecialPermission = (typeof SPECIAL_PERMISSION_VALUES)[number];

export type PermissionKey = PermissionAction | SpecialPermission;

export type ModulePermissions = Record<PermissionAction, boolean> &
  Record<SpecialPermission, boolean>;

export type PermissionMatrix = Record<ModuleKey, ModulePermissions>;

export interface SpecialPermissionRow {
  key: string;
  module: ModuleKey;
  permission: SpecialPermission;
  label: string;
  description: string;
}

export type ActivityType =
  | 'solicitud'
  | 'estado'
  | 'cotizacion'
  | 'proyecto'
  | 'tarea'
  | 'agenda'
  | 'comentario'
  | 'archivo'
  | 'usuario'
  | 'sistema';

export interface ActivityEntry {
  id: string;
  timestamp: string;
  actorId: string;
  type: ActivityType;
  title: string;
  description?: string;
  requestId?: string;
  projectId?: string;
}

export interface ClientInfo {
  name: string;
  company?: string;
  email: string;
  phone: string;
  location: string;
  propertyType: string;
  comments?: string;
}

export interface EnergyInfo {
  projectType: ProjectType;
  monthlyConsumptionKwh: number;
  bimonthlyConsumptionKwh: number;
  billAmount: number;
  tariff: number;
  requiredPowerKw: number;
  propertyType: string;
  roofAreaM2?: number;
  roofType?: string;
  orientation?: string;
}

export interface BackupInfo {
  hours: number;
  equipment: string[];
  loadKw: number;
}

export interface InternalNote {
  id: string;
  authorId: string;
  timestamp: string;
  text: string;
}

export interface Solicitud {
  id: string;
  folio: string;
  createdAt: string;
  status: RequestStatus;
  source: 'sitio-publico' | 'manual';
  client: ClientInfo;
  energy: EnergyInfo;
  systemType: SystemType;
  backup?: BackupInfo;
  calculation: SolarEstimate;
  responsibleUserId: string | null;
  internalNotes: InternalNote[];
  activities: ActivityEntry[];
  projectId: string | null;
  rejectionReason?: string;
}

export interface ProjectTask {
  id: string;
  title: string;
  description: string;
  assigneeId: string;
  priority: Priority;
  startDate: string;
  dueDate: string;
  status: TaskStatus;
  createdAt: string;
}

export type ProjectFileKind = 'cotizacion' | 'plano' | 'fotografia' | 'ficha' | 'instalacion';

export interface ProjectFile {
  id: string;
  name: string;
  kind: ProjectFileKind;
  sizeKb: number;
  uploadedById: string;
  uploadedAt: string;
}

export interface Project {
  id: string;
  folio: string;
  name: string;
  requestId: string | null;
  client: ClientInfo;
  projectType: ProjectType;
  systemType: SystemType;
  location: string;
  capacityKwp: number;
  amount: number;
  responsibleUserId: string;
  startDate: string;
  estimatedEndDate: string;
  status: ProjectStatus;
  progress: number;
  description?: string;
  tasks: ProjectTask[];
  teamIds: string[];
  files: ProjectFile[];
  activities: ActivityEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  roleId: string;
  status: UserStatus;
  lastAccess: string;
  createdAt: string;
  jobTitle: string;
  avatarColor: string;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  system: boolean;
  color: 'forest' | 'solar' | 'success' | 'info' | 'warning';
  permissions: PermissionMatrix;
}

export interface DemoSession {
  userId: string;
  roleId: string;
  name: string;
  email: string;
  loginAt: string;
  remember: boolean;
  demo: true;
}

export interface AdminPreferences {
  companyName: string;
  currency: string;
  timezone: string;
  notifyNewRequests: boolean;
  notifyQuotes: boolean;
  notifyProjectUpdates: boolean;
  weeklySummary: boolean;
}

export interface AdminState {
  version: number;
  solicitudes: Solicitud[];
  projects: Project[];
  generalTasks: GeneralTask[];
  calendarEvents: CalendarEvent[];
  users: User[];
  roles: Role[];
  activities: ActivityEntry[];
  counters: { solicitud: number; proyecto: number; tarea: number; evento: number };
  preferences: AdminPreferences;
}

export interface NewSolicitudInput {
  client: ClientInfo;
  energy: {
    projectType: ProjectType;
    monthlyConsumptionKwh: number;
    billAmount?: number;
    tariff?: number;
    propertyType: string;
    roofAreaM2?: number;
    roofType?: string;
    orientation?: string;
  };
  systemType: SystemType;
  backup?: BackupInfo;
  source?: 'sitio-publico' | 'manual';
}

export interface ConvertProjectInput {
  name: string;
  responsibleUserId: string;
  startDate: string;
  estimatedEndDate: string;
  status: ProjectStatus;
  initialTasks: string[];
}

export interface DashboardMetrics {
  totalSolicitudes: number;
  pendingSolicitudes: number;
  quotesSent: number;
  quotesAccepted: number;
  activeProjects: number;
  completedProjects: number;
  totalProjectValue: number;
  conversionRate: number;
}
