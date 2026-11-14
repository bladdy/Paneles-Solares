import type { AdminState } from '../../types/admin';
import { ADMIN_STATE_VERSION } from '../../types/admin';
import { seedRoles } from './roles';
import { seedUsers } from './usuarios';
import { seedSolicitudes } from './solicitudes';
import { seedProjects } from './proyectos';
import { seedTasks } from './tareas';
import { seedCalendarEvents } from './agenda';
import { seedActivities } from './actividades';

export const seedAdminState: AdminState = {
  version: ADMIN_STATE_VERSION,
  solicitudes: seedSolicitudes,
  projects: seedProjects,
  generalTasks: seedTasks,
  calendarEvents: seedCalendarEvents,
  users: seedUsers,
  roles: seedRoles,
  activities: seedActivities,
  counters: {
    solicitud: 12,
    proyecto: 8,
    tarea: seedTasks.length,
    evento: seedCalendarEvents.length,
  },
  preferences: {
    companyName: 'EnerSol',
    currency: 'MXN',
    timezone: 'America/Mexico_City',
    notifyNewRequests: true,
    notifyQuotes: true,
    notifyProjectUpdates: true,
    weeklySummary: false,
  },
};

export {
  seedRoles,
  seedUsers,
  seedSolicitudes,
  seedProjects,
  seedTasks,
  seedCalendarEvents,
  seedActivities,
};
