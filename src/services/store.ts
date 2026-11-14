import type {
  ActivityEntry,
  AdminPreferences,
  AdminState,
  ConvertProjectInput,
  DemoSession,
  ModuleKey,
  ModulePermissions,
  NewSolicitudInput,
  PermissionKey,
  PermissionMatrix,
  Project,
  ProjectFile,
  ProjectFileKind,
  ProjectStatus,
  ProjectTask,
  Role,
  Solicitud,
  TaskStatus,
  User,
  UserStatus,
} from '../types/admin';
import { ADMIN_STATE_VERSION, MODULE_VALUES, SPECIAL_PERMISSION_VALUES } from '../types/admin';
import type { GeneralTask, GeneralTaskInput, TaskHistoryKind } from '../types/task';
import type { CalendarEvent, CalendarEventInput } from '../types/calendar';
import type { SolarConfig } from '../types/solar';
import { seedAdminState } from './mock';
import { createDefaultConfig } from '../data/cotizador-defaults';
import { calculateSolarEstimate, validateSolarConfig } from '../utils/solar-calculator';
import { projectProgress } from '../utils/project';
import { uid } from '../utils/format';

const STATE_KEY = 'enersol.admin.state.v1';
const CONFIG_KEY = 'enersol.cotizador.config.v1';
const SESSION_KEY = 'enersol.admin.session.v1';
const FOLIO_YEAR = 2026;

let cachedState: AdminState | null = null;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function localGet(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function sessionGet(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function localSet(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* almacenamiento no disponible: se conserva en memoria */
  }
}

function localRemove(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* noop */
  }
}

function sessionRemove(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    /* noop */
  }
}

function now(): string {
  return new Date().toISOString();
}

function folio(prefix: 'SOL' | 'PRY' | 'TAR' | 'AGE', number: number): string {
  return `${prefix}-${FOLIO_YEAR}-${String(number).padStart(3, '0')}`;
}

function fullPermissions(row?: Partial<ModulePermissions> | null): ModulePermissions {
  return {
    ver: Boolean(row?.ver),
    crear: Boolean(row?.crear),
    editar: Boolean(row?.editar),
    eliminar: Boolean(row?.eliminar),
    asignar: Boolean(row?.asignar),
    ver_todas: Boolean(row?.ver_todas),
  };
}

/**
 * Migración de la versión 1 a la 2: conserva los datos existentes del
 * navegador y agrega tareas generales, agenda, contadores y los nuevos
 * permisos sin perder solicitudes, proyectos ni usuarios.
 */
function migrateState(parsed: AdminState): AdminState | null {
  if (!parsed || parsed.version !== 1) return null;
  if (
    !Array.isArray(parsed.solicitudes) ||
    !Array.isArray(parsed.projects) ||
    !Array.isArray(parsed.users) ||
    !Array.isArray(parsed.roles)
  ) {
    return null;
  }

  const migrated = parsed as AdminState;
  migrated.version = ADMIN_STATE_VERSION;

  if (!Array.isArray(migrated.generalTasks)) {
    migrated.generalTasks = clone(seedAdminState.generalTasks);
  }
  if (!Array.isArray(migrated.calendarEvents)) {
    migrated.calendarEvents = clone(seedAdminState.calendarEvents);
  }
  migrated.counters = {
    solicitud: migrated.counters?.solicitud ?? seedAdminState.counters.solicitud,
    proyecto: migrated.counters?.proyecto ?? seedAdminState.counters.proyecto,
    tarea: Math.max(migrated.counters?.tarea ?? 0, migrated.generalTasks.length),
    evento: Math.max(migrated.counters?.evento ?? 0, migrated.calendarEvents.length),
  };

  migrated.roles = migrated.roles.map((role) => {
    const seedRole = seedAdminState.roles.find((item) => item.id === role.id);
    const permissions = {} as PermissionMatrix;
    MODULE_VALUES.forEach((module) => {
      const current = role.permissions?.[module] as Partial<ModulePermissions> | undefined;
      const seedRow = seedRole?.permissions[module];
      const row = fullPermissions(current ?? seedRow);
      if (current && row.asignar === false && typeof current.asignar !== 'boolean') {
        row.asignar = Boolean(seedRow?.asignar);
      }
      if (current && row.ver_todas === false && typeof current.ver_todas !== 'boolean') {
        row.ver_todas = Boolean(seedRow?.ver_todas);
      }
      if (!row.ver) {
        SPECIAL_PERMISSION_VALUES.forEach((permission) => {
          row[permission] = false;
        });
      }
      permissions[module] = row;
    });
    role.permissions = permissions;
    return role;
  });

  return migrated;
}

export function loadState(): AdminState {
  if (cachedState) return cachedState;
  const raw = localGet(STATE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as AdminState;
      if (
        parsed &&
        parsed.version === ADMIN_STATE_VERSION &&
        Array.isArray(parsed.solicitudes) &&
        Array.isArray(parsed.projects) &&
        Array.isArray(parsed.generalTasks) &&
        Array.isArray(parsed.calendarEvents) &&
        Array.isArray(parsed.users) &&
        Array.isArray(parsed.roles)
      ) {
        cachedState = parsed;
        return parsed;
      }
      const migrated = migrateState(parsed);
      if (migrated) {
        cachedState = migrated;
        persistState(migrated);
        return migrated;
      }
    } catch {
      /* datos corruptos: se restaura la semilla */
    }
  }
  cachedState = clone(seedAdminState);
  persistState(cachedState);
  return cachedState;
}

function persistState(state: AdminState): void {
  cachedState = state;
  localSet(STATE_KEY, JSON.stringify(state));
}

export function saveState(state: AdminState): void {
  persistState(state);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('enersol:state-changed'));
  }
}

export function resetDemoData(): void {
  cachedState = clone(seedAdminState);
  localRemove(STATE_KEY);
  persistState(cachedState);
  window.dispatchEvent(new CustomEvent('enersol:state-changed'));
}

export function resetAllDemoData(): void {
  resetDemoData();
  resetConfig();
}

/* ------------------------------------------------------------------ */
/* Configuración del cotizador                                         */
/* ------------------------------------------------------------------ */

export function getConfig(): SolarConfig {
  const raw = localGet(CONFIG_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as SolarConfig;
      if (parsed?.general && Array.isArray(parsed.panels) && Array.isArray(parsed.inverters)) {
        return parsed;
      }
    } catch {
      /* configuración inválida: usar valores predeterminados */
    }
  }
  return createDefaultConfig();
}

export function saveConfig(config: SolarConfig): void {
  const errors = validateSolarConfig(config);
  if (errors.length > 0) {
    throw new Error(errors[0]);
  }
  localSet(CONFIG_KEY, JSON.stringify(config));
}

export function resetConfig(): SolarConfig {
  localRemove(CONFIG_KEY);
  return createDefaultConfig();
}

/* ------------------------------------------------------------------ */
/* Sesión simulada                                                     */
/* ------------------------------------------------------------------ */

export function getSession(): DemoSession | null {
  if (typeof window === 'undefined') return null;
  const raw = localGet(SESSION_KEY) ?? sessionGet(SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as DemoSession;
    if (parsed?.userId && parsed?.roleId) return parsed;
  } catch {
    /* sesión inválida */
  }
  return null;
}

export function setSessionForUser(userId: string, remember = true): DemoSession {
  const state = loadState();
  const user = state.users.find((item) => item.id === userId);
  if (!user) throw new Error('No se encontró el usuario de demostración.');
  const session: DemoSession = {
    userId: user.id,
    roleId: user.roleId,
    name: `${user.firstName} ${user.lastName}`.trim(),
    email: user.email,
    loginAt: now(),
    remember,
    demo: true,
  };
  localRemove(SESSION_KEY);
  sessionRemove(SESSION_KEY);
  if (remember) {
    localSet(SESSION_KEY, JSON.stringify(session));
  } else {
    try {
      window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch {
      localSet(SESSION_KEY, JSON.stringify(session));
    }
  }
  return session;
}

export function loginWithCredentials(email: string, _password: string, remember = true): DemoSession {
  const state = loadState();
  const user = state.users.find(
    (item) => item.email.toLowerCase() === email.trim().toLowerCase() && item.status === 'activo',
  );
  if (!user) {
    throw new Error('No encontramos una cuenta activa con ese correo.');
  }
  const session = setSessionForUser(user.id, remember);
  const dbUser = state.users.find((item) => item.id === user.id);
  if (dbUser) {
    dbUser.lastAccess = now();
    saveState(state);
  }
  return session;
}

export function clearSession(): void {
  localRemove(SESSION_KEY);
  sessionRemove(SESSION_KEY);
}

export function getSessionUser(): User | null {
  const session = getSession();
  if (!session) return null;
  const state = loadState();
  return state.users.find((user) => user.id === session.userId) ?? null;
}

export function demoUsers(): User[] {
  const state = loadState();
  const roleOrder = ['rol-admin', 'rol-gerente', 'rol-supervisor', 'rol-tecnico', 'rol-comercial'];
  const users = roleOrder
    .map((roleId) => state.users.find((user) => user.roleId === roleId && user.status === 'activo'))
    .filter((user): user is User => Boolean(user));
  state.roles
    .filter((role) => !role.system)
    .forEach((role) => {
      const user = state.users.find((item) => item.roleId === role.id && item.status === 'activo');
      if (user) users.push(user);
    });
  return users;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export function userById(state: AdminState, id: string | null | undefined): User | undefined {
  if (!id) return undefined;
  return state.users.find((user) => user.id === id);
}

export function userName(state: AdminState, id: string | null | undefined): string {
  if (!id) return 'Sin asignar';
  if (id === 'sistema') return 'Sistema';
  const user = userById(state, id);
  return user ? `${user.firstName} ${user.lastName}`.trim() : 'Usuario';
}

export function roleById(state: AdminState, id: string | null | undefined): Role | undefined {
  if (!id) return undefined;
  return state.roles.find((role) => role.id === id);
}

export function hasPermission(
  roleId: string | null | undefined,
  module: ModuleKey,
  action: PermissionKey,
): boolean {
  const state = loadState();
  const role = roleById(state, roleId);
  return Boolean(role?.permissions[module]?.[action]);
}

export function currentRole(): Role | undefined {
  const session = getSession();
  if (!session) return undefined;
  return roleById(loadState(), session.roleId);
}

export function currentUserId(): string {
  return getSession()?.userId ?? 'usr-admin';
}

function actorId(): string {
  return currentUserId();
}

function createActivity(
  fields: Omit<ActivityEntry, 'id' | 'timestamp'> & { timestamp?: string },
): ActivityEntry {
  return {
    id: uid('act'),
    timestamp: fields.timestamp ?? now(),
    ...fields,
  };
}

function pushActivity(
  state: AdminState,
  entry: ActivityEntry,
  target?: { requestId?: string; projectId?: string },
): void {
  state.activities.unshift(entry);
  if (state.activities.length > 200) state.activities.length = 200;

  if (target?.requestId) {
    const request = state.solicitudes.find((item) => item.id === target.requestId);
    request?.activities.unshift(entry);
  }
  if (target?.projectId) {
    const project = state.projects.find((item) => item.id === target.projectId);
    project?.activities.unshift(entry);
  }
}

function addProjectActivity(
  state: AdminState,
  projectId: string,
  type: ActivityEntry['type'],
  title: string,
  description?: string,
): void {
  const project = state.projects.find((item) => item.id === projectId);
  const entry = createActivity({
    actorId: actorId(),
    type,
    title,
    description,
    projectId,
    requestId: project?.requestId ?? undefined,
  });
  pushActivity(state, entry, { projectId, requestId: project?.requestId ?? undefined });
}

function recomputeProjectProgress(project: Project): void {
  project.progress = projectProgress(project);
  project.updatedAt = now();
}

/* ------------------------------------------------------------------ */
/* Solicitudes                                                         */
/* ------------------------------------------------------------------ */

function pickAdvisor(state: AdminState): string | null {
  const advisors = state.users.filter(
    (user) => user.roleId === 'rol-comercial' && user.status === 'activo',
  );
  if (advisors.length === 0) return null;
  const loads = advisors.map((advisor) => ({
    id: advisor.id,
    count: state.solicitudes.filter((request) => request.responsibleUserId === advisor.id).length,
  }));
  loads.sort((a, b) => a.count - b.count);
  return loads[0]?.id ?? null;
}

export function addSolicitud(input: NewSolicitudInput): Solicitud {
  const state = loadState();
  const config = getConfig();
  const calculation = calculateSolarEstimate(
    {
      projectType: input.energy.projectType,
      monthlyConsumptionKwh: input.energy.monthlyConsumptionKwh,
      monthlyBill: input.energy.billAmount,
      tariff: input.energy.tariff,
      systemType: input.systemType,
      backupHours: input.backup?.hours,
      backupLoadKw: input.backup?.loadKw,
    },
    config,
  );

  state.counters.solicitud += 1;
  const id = folio('SOL', state.counters.solicitud);
  const createdAt = now();
  const request: Solicitud = {
    id,
    folio: id,
    createdAt,
    status: 'nueva',
    source: input.source ?? 'sitio-publico',
    client: {
      ...input.client,
      propertyType: input.client.propertyType || input.energy.propertyType,
    },
    energy: {
      projectType: input.energy.projectType,
      monthlyConsumptionKwh: input.energy.monthlyConsumptionKwh,
      bimonthlyConsumptionKwh: input.energy.monthlyConsumptionKwh * 2,
      billAmount: input.energy.billAmount ?? 0,
      tariff: input.energy.tariff ?? calculation.assumptions.tariff,
      requiredPowerKw: calculation.requiredPowerKw,
      propertyType: input.energy.propertyType,
      roofAreaM2: input.energy.roofAreaM2,
      roofType: input.energy.roofType,
      orientation: input.energy.orientation,
    },
    systemType: input.systemType,
    backup: input.backup,
    calculation,
    responsibleUserId: pickAdvisor(state),
    internalNotes: [],
    activities: [],
    projectId: null,
  };

  const entry = createActivity({
    actorId: input.source === 'manual' ? actorId() : 'sistema',
    type: 'solicitud',
    title: 'Nueva solicitud registrada',
    description:
      input.source === 'manual'
        ? 'La solicitud fue capturada manualmente por el equipo comercial.'
        : 'La solicitud ingresó desde el cotizador público.',
    requestId: id,
  });
  request.activities.push(entry);
  pushActivity(state, entry, { requestId: id });
  state.solicitudes.unshift(request);
  saveState(state);
  return request;
}

export function updateSolicitud(id: string, patch: Partial<Solicitud>): Solicitud {
  const state = loadState();
  const request = state.solicitudes.find((item) => item.id === id);
  if (!request) throw new Error('La solicitud no existe.');
  Object.assign(request, patch);
  saveState(state);
  return request;
}

export function assignSolicitud(id: string, userId: string, notes?: string): void {
  const state = loadState();
  const request = state.solicitudes.find((item) => item.id === id);
  if (!request) throw new Error('La solicitud no existe.');
  request.responsibleUserId = userId;
  pushActivity(
    state,
    createActivity({
      actorId: actorId(),
      type: 'estado',
      title: 'Responsable comercial actualizado',
      description: `${notes ? `${notes} ` : ''}Asignada a ${userName(state, userId)}.`,
      requestId: id,
    }),
    { requestId: id },
  );
  saveState(state);
}

export function setSolicitudStatus(id: string, status: Solicitud['status'], note?: string): void {
  const state = loadState();
  const request = state.solicitudes.find((item) => item.id === id);
  if (!request) throw new Error('La solicitud no existe.');
  request.status = status;
  pushActivity(
    state,
    createActivity({
      actorId: actorId(),
      type: 'estado',
      title: `Estado actualizado: ${status}`,
      description: note,
      requestId: id,
    }),
    { requestId: id },
  );
  saveState(state);
}

export function addSolicitudNote(id: string, text: string): void {
  const state = loadState();
  const request = state.solicitudes.find((item) => item.id === id);
  if (!request) throw new Error('La solicitud no existe.');
  request.internalNotes.unshift({
    id: uid('note'),
    authorId: actorId(),
    timestamp: now(),
    text,
  });
  pushActivity(
    state,
    createActivity({
      actorId: actorId(),
      type: 'comentario',
      title: 'Nota interna agregada',
      description: text,
      requestId: id,
    }),
    { requestId: id },
  );
  saveState(state);
}

export function recalculateSolicitud(id: string): Solicitud {
  const state = loadState();
  const request = state.solicitudes.find((item) => item.id === id);
  if (!request) throw new Error('La solicitud no existe.');
  const config = getConfig();
  const calculation = calculateSolarEstimate(
    {
      projectType: request.energy.projectType,
      monthlyConsumptionKwh: request.energy.monthlyConsumptionKwh,
      monthlyBill: request.energy.billAmount,
      tariff: request.energy.tariff,
      systemType: request.systemType,
      backupHours: request.backup?.hours,
      backupLoadKw: request.backup?.loadKw,
    },
    config,
  );
  request.calculation = calculation;
  request.energy.requiredPowerKw = calculation.requiredPowerKw;
  if (['nueva', 'en-revision', 'pendiente-info'].includes(request.status)) {
    request.status = 'cotizacion-calculada';
  }
  pushActivity(
    state,
    createActivity({
      actorId: actorId(),
      type: 'cotizacion',
      title: 'Cotización recalculada',
      description: `Nueva inversión estimada: $${calculation.total.toLocaleString('es-MX')} MXN.`,
      requestId: id,
    }),
    { requestId: id },
  );
  saveState(state);
  return request;
}

export function acceptSolicitud(id: string): void {
  const state = loadState();
  const request = state.solicitudes.find((item) => item.id === id);
  if (!request) throw new Error('La solicitud no existe.');
  request.status = 'aceptada';
  pushActivity(
    state,
    createActivity({
      actorId: actorId(),
      type: 'estado',
      title: 'Propuesta aceptada por el cliente',
      description: 'La solicitud está lista para convertirse en proyecto.',
      requestId: id,
    }),
    { requestId: id },
  );
  saveState(state);
}

export function rejectSolicitud(id: string, reason: string): void {
  const state = loadState();
  const request = state.solicitudes.find((item) => item.id === id);
  if (!request) throw new Error('La solicitud no existe.');
  request.status = 'rechazada';
  request.rejectionReason = reason;
  pushActivity(
    state,
    createActivity({
      actorId: actorId(),
      type: 'estado',
      title: 'Solicitud rechazada',
      description: reason,
      requestId: id,
    }),
    { requestId: id },
  );
  saveState(state);
}

export function convertSolicitudToProject(id: string, input: ConvertProjectInput): Project {
  const state = loadState();
  const request = state.solicitudes.find((item) => item.id === id);
  if (!request) throw new Error('La solicitud no existe.');
  if (request.projectId) throw new Error('La solicitud ya fue convertida en proyecto.');

  state.counters.proyecto += 1;
  const projectId = folio('PRY', state.counters.proyecto);
  const timestamp = now();
  const tasks: ProjectTask[] = input.initialTasks.map((title, index) => ({
    id: uid('tsk'),
    title,
    description: 'Tarea inicial generada durante la conversión de la solicitud.',
    assigneeId: input.responsibleUserId,
    priority: index === 0 ? 'alta' : 'media',
    startDate: input.startDate,
    dueDate: new Date(
      new Date(input.startDate).getTime() + (index + 1) * 7 * 86_400_000,
    )
      .toISOString()
      .slice(0, 10),
    status: 'pendiente' as TaskStatus,
    createdAt: timestamp,
  }));

  const project: Project = {
    id: projectId,
    folio: projectId,
    name: input.name,
    requestId: request.id,
    client: request.client,
    projectType: request.energy.projectType,
    systemType: request.systemType,
    location: request.client.location,
    capacityKwp: request.calculation.installedCapacityKwp,
    amount: request.calculation.total,
    responsibleUserId: input.responsibleUserId,
    startDate: input.startDate,
    estimatedEndDate: input.estimatedEndDate,
    status: input.status,
    progress: 0,
    description: 'Proyecto creado a partir de la solicitud ' + request.folio + '.',
    tasks,
    teamIds: [input.responsibleUserId],
    files: [],
    activities: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  recomputeProjectProgress(project);

  project.activities.push(
    createActivity({
      actorId: actorId(),
      type: 'proyecto',
      title: 'Proyecto creado',
      description: `Conversión de la solicitud ${request.folio} con ${tasks.length} tarea(s) inicial(es).`,
      projectId,
      requestId: request.id,
    }),
  );

  request.status = 'convertida';
  request.projectId = projectId;
  request.activities.unshift(
    createActivity({
      actorId: actorId(),
      type: 'proyecto',
      title: 'Solicitud convertida en proyecto',
      description: `Se creó el proyecto ${projectId}.`,
      requestId: request.id,
      projectId,
    }),
  );

  pushActivity(
    state,
    createActivity({
      actorId: actorId(),
      type: 'proyecto',
      title: 'Nueva conversión a proyecto',
      description: `${request.client.name} · ${input.name}`,
      requestId: request.id,
      projectId,
    }),
  );

  state.projects.unshift(project);
  saveState(state);
  return project;
}

/* ------------------------------------------------------------------ */
/* Proyectos                                                           */
/* ------------------------------------------------------------------ */

export interface NewProjectInput {
  name: string;
  clientName: string;
  company?: string;
  email: string;
  phone: string;
  location: string;
  projectType: Project['projectType'];
  systemType: Project['systemType'];
  capacityKwp: number;
  amount: number;
  responsibleUserId: string;
  startDate: string;
  estimatedEndDate: string;
  status: ProjectStatus;
  description?: string;
}

export function addProject(input: NewProjectInput): Project {
  const state = loadState();
  state.counters.proyecto += 1;
  const projectId = folio('PRY', state.counters.proyecto);
  const timestamp = now();
  const project: Project = {
    id: projectId,
    folio: projectId,
    name: input.name,
    requestId: null,
    client: {
      name: input.clientName,
      company: input.company,
      email: input.email,
      phone: input.phone,
      location: input.location,
      propertyType: input.projectType === 'industrial' ? 'Nave industrial' : 'Propiedad',
    },
    projectType: input.projectType,
    systemType: input.systemType,
    location: input.location,
    capacityKwp: input.capacityKwp,
    amount: input.amount,
    responsibleUserId: input.responsibleUserId,
    startDate: input.startDate,
    estimatedEndDate: input.estimatedEndDate,
    status: input.status,
    progress: 0,
    description: input.description,
    tasks: [],
    teamIds: [input.responsibleUserId],
    files: [],
    activities: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  project.activities.push(
    createActivity({
      actorId: actorId(),
      type: 'proyecto',
      title: 'Proyecto creado manualmente',
      description: 'Alta directa desde el módulo de proyectos.',
      projectId,
    }),
  );
  pushActivity(
    state,
    createActivity({
      actorId: actorId(),
      type: 'proyecto',
      title: 'Proyecto registrado',
      description: `${input.clientName} · ${input.name}`,
      projectId,
    }),
  );
  state.projects.unshift(project);
  saveState(state);
  return project;
}

export function updateProject(id: string, patch: Partial<Project>): Project {
  const state = loadState();
  const project = state.projects.find((item) => item.id === id);
  if (!project) throw new Error('El proyecto no existe.');
  Object.assign(project, patch);
  project.updatedAt = now();
  saveState(state);
  return project;
}

export function setProjectStatus(id: string, status: ProjectStatus): void {
  const state = loadState();
  const project = state.projects.find((item) => item.id === id);
  if (!project) throw new Error('El proyecto no existe.');
  project.status = status;
  if (status === 'finalizado') project.progress = 100;
  addProjectActivity(state, id, 'estado', 'Estado del proyecto actualizado', `Nuevo estado: ${status}.`);
  saveState(state);
}

export function addTask(
  projectId: string,
  input: {
    title: string;
    description: string;
    assigneeId: string;
    priority: ProjectTask['priority'];
    startDate: string;
    dueDate: string;
    status: TaskStatus;
  },
): ProjectTask {
  const state = loadState();
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) throw new Error('El proyecto no existe.');
  const task: ProjectTask = {
    ...input,
    id: uid('tsk'),
    createdAt: now(),
  };
  project.tasks.push(task);
  recomputeProjectProgress(project);
  addProjectActivity(state, projectId, 'tarea', 'Nueva tarea creada', input.title);
  saveState(state);
  return task;
}

export function updateTask(
  projectId: string,
  taskId: string,
  patch: Partial<ProjectTask>,
): ProjectTask {
  const state = loadState();
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) throw new Error('El proyecto no existe.');
  const task = project.tasks.find((item) => item.id === taskId);
  if (!task) throw new Error('La tarea no existe.');
  Object.assign(task, patch);
  recomputeProjectProgress(project);
  if (patch.status) {
    addProjectActivity(
      state,
      projectId,
      'tarea',
      patch.status === 'completada' ? 'Tarea completada' : 'Estado de tarea actualizado',
      `${task.title} · ${patch.status}`,
    );
  }
  saveState(state);
  return task;
}

export function deleteTask(projectId: string, taskId: string): void {
  const state = loadState();
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) throw new Error('El proyecto no existe.');
  const task = project.tasks.find((item) => item.id === taskId);
  if (!task) throw new Error('La tarea no existe.');
  project.tasks = project.tasks.filter((item) => item.id !== taskId);
  recomputeProjectProgress(project);
  addProjectActivity(state, projectId, 'tarea', 'Tarea eliminada', task.title);
  saveState(state);
}

export function addProjectFile(
  projectId: string,
  input: { name: string; kind: ProjectFileKind; sizeKb: number },
): ProjectFile {
  const state = loadState();
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) throw new Error('El proyecto no existe.');
  const file: ProjectFile = {
    id: uid('fil'),
    name: input.name,
    kind: input.kind,
    sizeKb: input.sizeKb,
    uploadedById: actorId(),
    uploadedAt: now(),
  };
  project.files.unshift(file);
  project.updatedAt = now();
  addProjectActivity(state, projectId, 'archivo', 'Archivo agregado', input.name);
  saveState(state);
  return file;
}

export function addProjectComment(projectId: string, text: string): void {
  const state = loadState();
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) throw new Error('El proyecto no existe.');
  addProjectActivity(state, projectId, 'comentario', 'Comentario del equipo', text);
  saveState(state);
}

export function addProjectMember(projectId: string, userId: string): void {
  const state = loadState();
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) throw new Error('El proyecto no existe.');
  if (project.teamIds.includes(userId)) return;
  project.teamIds.push(userId);
  project.updatedAt = now();
  addProjectActivity(
    state,
    projectId,
    'proyecto',
    'Integrante agregado al equipo',
    userName(state, userId),
  );
  saveState(state);
}

export function removeProjectMember(projectId: string, userId: string): void {
  const state = loadState();
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) throw new Error('El proyecto no existe.');
  if (project.responsibleUserId === userId) {
    throw new Error('No puedes retirar al responsable principal del proyecto.');
  }
  project.teamIds = project.teamIds.filter((id) => id !== userId);
  project.updatedAt = now();
  addProjectActivity(
    state,
    projectId,
    'proyecto',
    'Integrante retirado del equipo',
    userName(state, userId),
  );
  saveState(state);
}

export function updatePreferences(patch: Partial<AdminPreferences>): void {
  const state = loadState();
  state.preferences = { ...state.preferences, ...patch };
  saveState(state);
}

/* ------------------------------------------------------------------ */
/* Usuarios y roles                                                    */
/* ------------------------------------------------------------------ */

export interface UserFormInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  roleId: string;
  status: UserStatus;
  jobTitle?: string;
}

export function createUser(input: UserFormInput): User {
  const state = loadState();
  if (state.users.some((user) => user.email.toLowerCase() === input.email.toLowerCase())) {
    throw new Error('Ya existe un usuario con ese correo electrónico.');
  }
  const colors = ['#123B2A', '#175CD3', '#B54708', '#067647', '#6941C6', '#C4320A', '#0F766E'];
  const user: User = {
    id: uid('usr'),
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    email: input.email.trim(),
    phone: input.phone.trim(),
    roleId: input.roleId,
    status: input.status,
    lastAccess: '',
    createdAt: now(),
    jobTitle: input.jobTitle || 'Colaborador',
    avatarColor: colors[state.users.length % colors.length],
  };
  state.users.push(user);
  pushActivity(
    state,
    createActivity({
      actorId: actorId(),
      type: 'usuario',
      title: 'Usuario creado',
      description: `${user.firstName} ${user.lastName} · ${user.email}`,
    }),
  );
  saveState(state);
  return user;
}

export function updateUser(id: string, patch: Partial<UserFormInput>): User {
  const state = loadState();
  const user = state.users.find((item) => item.id === id);
  if (!user) throw new Error('El usuario no existe.');
  if (
    patch.email &&
    state.users.some(
      (item) => item.id !== id && item.email.toLowerCase() === patch.email!.toLowerCase(),
    )
  ) {
    throw new Error('Ya existe un usuario con ese correo electrónico.');
  }
  Object.assign(user, patch);
  pushActivity(
    state,
    createActivity({
      actorId: actorId(),
      type: 'usuario',
      title: 'Usuario actualizado',
      description: `${user.firstName} ${user.lastName}`,
    }),
  );
  saveState(state);
  return user;
}

export function setUserStatus(id: string, status: UserStatus): void {
  const state = loadState();
  const user = state.users.find((item) => item.id === id);
  if (!user) throw new Error('El usuario no existe.');
  user.status = status;
  pushActivity(
    state,
    createActivity({
      actorId: actorId(),
      type: 'usuario',
      title: 'Estado de usuario actualizado',
      description: `${user.firstName} ${user.lastName} · ${status}`,
    }),
  );
  saveState(state);
}

export function setUserRole(id: string, roleId: string): void {
  const state = loadState();
  const user = state.users.find((item) => item.id === id);
  if (!user) throw new Error('El usuario no existe.');
  const role = roleById(state, roleId);
  if (!role) throw new Error('El rol no existe.');
  user.roleId = roleId;
  pushActivity(
    state,
    createActivity({
      actorId: actorId(),
      type: 'usuario',
      title: 'Rol de usuario actualizado',
      description: `${user.firstName} ${user.lastName} ahora tiene el rol ${role.name}.`,
    }),
  );
  saveState(state);
  const session = getSession();
  if (session?.userId === id) {
    setSessionForUser(id, session.remember);
  }
}

export function deleteUser(id: string): void {
  const state = loadState();
  const user = state.users.find((item) => item.id === id);
  if (!user) throw new Error('El usuario no existe.');
  if (getSession()?.userId === id) {
    throw new Error('No puedes eliminar el usuario de la sesión actual.');
  }
  state.users = state.users.filter((item) => item.id !== id);
  pushActivity(
    state,
    createActivity({
      actorId: actorId(),
      type: 'usuario',
      title: 'Usuario eliminado',
      description: `${user.firstName} ${user.lastName} · ${user.email}`,
    }),
  );
  saveState(state);
}

export function createRole(input: {
  name: string;
  description: string;
  color: Role['color'];
  permissions: PermissionMatrix;
}): Role {
  const state = loadState();
  if (state.roles.some((role) => role.name.toLowerCase() === input.name.toLowerCase())) {
    throw new Error('Ya existe un rol con ese nombre.');
  }
  const role: Role = {
    id: uid('rol'),
    name: input.name,
    description: input.description,
    system: false,
    color: input.color,
    permissions: clone(input.permissions),
  };
  state.roles.push(role);
  pushActivity(
    state,
    createActivity({
      actorId: actorId(),
      type: 'usuario',
      title: 'Rol personalizado creado',
      description: role.name,
    }),
  );
  saveState(state);
  return role;
}

export function updateRole(
  id: string,
  patch: { name?: string; description?: string; color?: Role['color'] },
): Role {
  const state = loadState();
  const role = state.roles.find((item) => item.id === id);
  if (!role) throw new Error('El rol no existe.');
  if (patch.name && state.roles.some((item) => item.id !== id && item.name.toLowerCase() === patch.name!.toLowerCase())) {
    throw new Error('Ya existe un rol con ese nombre.');
  }
  Object.assign(role, patch);
  pushActivity(
    state,
    createActivity({
      actorId: actorId(),
      type: 'usuario',
      title: 'Rol actualizado',
      description: role.name,
    }),
  );
  saveState(state);
  return role;
}

export function updateRolePermissions(id: string, permissions: PermissionMatrix): void {
  const state = loadState();
  const role = state.roles.find((item) => item.id === id);
  if (!role) throw new Error('El rol no existe.');
  if (role.id === 'rol-admin') {
    throw new Error('El rol Administrador conserva acceso total y no puede modificarse.');
  }
  role.permissions = clone(permissions);
  pushActivity(
    state,
    createActivity({
      actorId: actorId(),
      type: 'usuario',
      title: 'Permisos actualizados',
      description: `Se actualizó la matriz de permisos del rol ${role.name}.`,
    }),
  );
  saveState(state);
}

export function deleteRole(id: string): void {
  const state = loadState();
  const role = state.roles.find((item) => item.id === id);
  if (!role) throw new Error('El rol no existe.');
  if (role.system) throw new Error('Los roles del sistema no se pueden eliminar.');
  if (state.users.some((user) => user.roleId === id)) {
    throw new Error('No puedes eliminar un rol que tiene usuarios asignados.');
  }
  state.roles = state.roles.filter((item) => item.id !== id);
  saveState(state);
}

export interface RoleFormInput {
  name: string;
  description: string;
  color: Role['color'];
  permissions: PermissionMatrix;
}

export function emptyPermissionMatrix(): PermissionMatrix {
  const matrix = {} as PermissionMatrix;
  MODULE_VALUES.forEach((module) => {
    matrix[module] = fullPermissions(null);
  });
  return matrix;
}

/* ------------------------------------------------------------------ */
/* Tareas generales                                                    */
/* ------------------------------------------------------------------ */

function pushTaskHistory(
  task: GeneralTask,
  kind: TaskHistoryKind,
  title: string,
  description?: string,
): void {
  task.history.unshift({
    id: uid('th'),
    actorId: actorId(),
    timestamp: now(),
    kind,
    title,
    description,
  });
}

export function addGeneralTask(input: GeneralTaskInput): GeneralTask {
  const state = loadState();
  state.counters.tarea += 1;
  const id = folio('TAR', state.counters.tarea);
  const timestamp = now();
  const task: GeneralTask = {
    id,
    folio: id,
    title: input.title.trim(),
    description: input.description.trim(),
    assigneeIds: Array.from(new Set(input.assigneeIds.filter(Boolean))),
    creatorId: actorId(),
    dueDate: input.dueDate,
    priority: input.priority,
    status: input.status,
    startDate: input.startDate || undefined,
    projectId: input.projectId || null,
    notes: input.notes?.trim() || undefined,
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt: input.status === 'completada' ? timestamp : undefined,
    comments: [],
    history: [],
  };
  pushTaskHistory(task, 'creado', 'Tarea creada', `Alta de la tarea ${task.folio}.`);
  state.generalTasks.unshift(task);
  pushActivity(
    state,
    createActivity({
      actorId: actorId(),
      type: 'tarea',
      title: 'Nueva tarea general',
      description: `${task.folio} · ${task.title}`,
    }),
  );
  saveState(state);
  return task;
}

export function updateGeneralTask(id: string, input: GeneralTaskInput): GeneralTask {
  const state = loadState();
  const task = state.generalTasks.find((item) => item.id === id);
  if (!task) throw new Error('La tarea no existe.');

  const previousStatus = task.status;
  const previousAssignees = [...task.assigneeIds].sort().join('|');
  const nextAssignees = Array.from(new Set(input.assigneeIds.filter(Boolean)));
  const timestamp = now();

  const changedContent =
    task.title !== input.title.trim() ||
    task.description !== input.description.trim() ||
    task.dueDate !== input.dueDate ||
    task.priority !== input.priority ||
    (task.startDate ?? '') !== (input.startDate ?? '') ||
    (task.projectId ?? '') !== (input.projectId ?? '') ||
    (task.notes ?? '') !== (input.notes?.trim() ?? '');

  task.title = input.title.trim();
  task.description = input.description.trim();
  task.assigneeIds = nextAssignees;
  task.dueDate = input.dueDate;
  task.priority = input.priority;
  task.status = input.status;
  task.startDate = input.startDate || undefined;
  task.projectId = input.projectId || null;
  task.notes = input.notes?.trim() || undefined;
  task.updatedAt = timestamp;

  if (input.status === 'completada') {
    task.completedAt = task.completedAt ?? timestamp;
  } else {
    task.completedAt = undefined;
  }

  if (previousStatus !== task.status) {
    pushTaskHistory(
      task,
      'estado',
      task.status === 'completada' ? 'Tarea completada' : `Estado actualizado: ${task.status}`,
      task.status === 'completada'
        ? 'La tarea se marcó como completada.'
        : `Estado anterior: ${previousStatus}.`,
    );
  }
  if (previousAssignees !== [...nextAssignees].sort().join('|')) {
    pushTaskHistory(
      task,
      'asignacion',
      'Responsables actualizados',
      nextAssignees.map((userId) => userName(state, userId)).join(', ') || 'Sin responsables.',
    );
  }
  if (changedContent) {
    pushTaskHistory(task, 'edicion', 'Tarea actualizada', 'Se modificó la información general.');
  }

  pushActivity(
    state,
    createActivity({
      actorId: actorId(),
      type: 'tarea',
      title: 'Tarea general actualizada',
      description: `${task.folio} · ${task.title}`,
    }),
  );
  saveState(state);
  return task;
}

export function setGeneralTaskStatus(id: string, status: TaskStatus): void {
  const state = loadState();
  const task = state.generalTasks.find((item) => item.id === id);
  if (!task) throw new Error('La tarea no existe.');
  if (task.status === status) return;
  const previous = task.status;
  task.status = status;
  task.updatedAt = now();
  task.completedAt = status === 'completada' ? now() : undefined;
  pushTaskHistory(
    task,
    'estado',
    status === 'completada' ? 'Tarea completada' : `Estado actualizado: ${status}`,
    `Estado anterior: ${previous}.`,
  );
  pushActivity(
    state,
    createActivity({
      actorId: actorId(),
      type: 'tarea',
      title: 'Estado de tarea general actualizado',
      description: `${task.folio} · ${task.title} · ${status}`,
    }),
  );
  saveState(state);
}

export function assignGeneralTask(id: string, userIds: string[]): void {
  const state = loadState();
  const task = state.generalTasks.find((item) => item.id === id);
  if (!task) throw new Error('La tarea no existe.');
  const next = Array.from(new Set(userIds.filter(Boolean)));
  if (next.length === 0) throw new Error('La tarea debe tener al menos un responsable.');
  task.assigneeIds = next;
  task.updatedAt = now();
  pushTaskHistory(
    task,
    'asignacion',
    'Responsables actualizados',
    next.map((userId) => userName(state, userId)).join(', '),
  );
  saveState(state);
}

export function addGeneralTaskComment(id: string, text: string): void {
  const state = loadState();
  const task = state.generalTasks.find((item) => item.id === id);
  if (!task) throw new Error('La tarea no existe.');
  const clean = text.trim();
  if (!clean) throw new Error('Escribe un comentario antes de guardarlo.');
  task.comments.unshift({
    id: uid('cmt'),
    authorId: actorId(),
    timestamp: now(),
    text: clean,
  });
  pushTaskHistory(task, 'comentario', 'Comentario agregado', clean);
  task.updatedAt = now();
  saveState(state);
}

export function deleteGeneralTask(id: string): void {
  const state = loadState();
  const task = state.generalTasks.find((item) => item.id === id);
  if (!task) throw new Error('La tarea no existe.');
  state.generalTasks = state.generalTasks.filter((item) => item.id !== id);
  pushActivity(
    state,
    createActivity({
      actorId: actorId(),
      type: 'tarea',
      title: 'Tarea general eliminada',
      description: `${task.folio} · ${task.title}`,
    }),
  );
  saveState(state);
}

export function getGeneralTask(id: string): GeneralTask | undefined {
  return loadState().generalTasks.find((item) => item.id === id);
}

/* ------------------------------------------------------------------ */
/* Agenda                                                              */
/* ------------------------------------------------------------------ */

function minutesFromTime(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0);
}

export function validateCalendarEventInput(input: CalendarEventInput): string | null {
  if (!input.title.trim()) return 'El título de la actividad es obligatorio.';
  if (!input.date) return 'La fecha de la actividad es obligatoria.';
  if (!input.startTime || !input.endTime) return 'Indica la hora de inicio y de finalización.';
  if (minutesFromTime(input.endTime) <= minutesFromTime(input.startTime)) {
    return 'La hora de finalización debe ser posterior a la hora de inicio.';
  }
  if (input.assigneeIds.filter(Boolean).length === 0) {
    return 'Asigna al menos un responsable a la actividad.';
  }
  return null;
}

export function addCalendarEvent(input: CalendarEventInput): CalendarEvent {
  const error = validateCalendarEventInput(input);
  if (error) throw new Error(error);
  const state = loadState();
  state.counters.evento += 1;
  const id = folio('AGE', state.counters.evento);
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
  pushActivity(
    state,
    createActivity({
      actorId: actorId(),
      type: 'agenda',
      title: 'Nueva actividad de agenda',
      description: `${event.folio} · ${event.title}`,
    }),
  );
  saveState(state);
  return event;
}

export function updateCalendarEvent(id: string, input: CalendarEventInput): CalendarEvent {
  const error = validateCalendarEventInput(input);
  if (error) throw new Error(error);
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
  pushActivity(
    state,
    createActivity({
      actorId: actorId(),
      type: 'agenda',
      title: 'Actividad de agenda actualizada',
      description: `${event.folio} · ${event.title}`,
    }),
  );
  saveState(state);
  return event;
}

export function setCalendarEventStatus(
  id: string,
  status: CalendarEvent['status'],
): void {
  const state = loadState();
  const event = state.calendarEvents.find((item) => item.id === id);
  if (!event) throw new Error('La actividad no existe.');
  event.status = status;
  event.updatedAt = now();
  pushActivity(
    state,
    createActivity({
      actorId: actorId(),
      type: 'agenda',
      title: 'Estado de actividad actualizado',
      description: `${event.folio} · ${event.title} · ${status}`,
    }),
  );
  saveState(state);
}

export function deleteCalendarEvent(id: string): void {
  const state = loadState();
  const event = state.calendarEvents.find((item) => item.id === id);
  if (!event) throw new Error('La actividad no existe.');
  state.calendarEvents = state.calendarEvents.filter((item) => item.id !== id);
  pushActivity(
    state,
    createActivity({
      actorId: actorId(),
      type: 'agenda',
      title: 'Actividad de agenda eliminada',
      description: `${event.folio} · ${event.title}`,
    }),
  );
  saveState(state);
}

export function getCalendarEvent(id: string): CalendarEvent | undefined {
  return loadState().calendarEvents.find((item) => item.id === id);
}

export function getSolicitud(id: string): Solicitud | undefined {
  return loadState().solicitudes.find((item) => item.id === id);
}

export function getProject(id: string): Project | undefined {
  return loadState().projects.find((item) => item.id === id);
}

export function getConfigIssues(config = getConfig()): string[] {
  return validateSolarConfig(config);
}
