import type {
  ModuleKey,
  ModulePermissions,
  PermissionKey,
  PermissionMatrix,
  Role,
} from '../../types/admin';
import { MODULE_VALUES, PERMISSION_ACTION_VALUES, SPECIAL_PERMISSION_VALUES } from '../../types/admin';

function emptyPermissions(): PermissionMatrix {
  return MODULE_VALUES.reduce((matrix, module) => {
    matrix[module] = PERMISSION_ACTION_VALUES.reduce(
      (actions, action) => {
        actions[action] = false;
        return actions;
      },
      {} as ModulePermissions,
    );
    SPECIAL_PERMISSION_VALUES.forEach((permission) => {
      matrix[module][permission] = false;
    });
    return matrix;
  }, {} as PermissionMatrix);
}

type PermissionOverrides = Partial<Record<ModuleKey, Partial<Record<PermissionKey, boolean>>>>;

function permissions(overrides: PermissionOverrides): PermissionMatrix {
  const matrix = emptyPermissions();
  (Object.keys(overrides) as ModuleKey[]).forEach((module) => {
    Object.assign(matrix[module], overrides[module]);
  });
  return matrix;
}

const allPermissions = permissions(
  MODULE_VALUES.reduce((overrides, module) => {
    overrides[module] = {
      ver: true,
      crear: true,
      editar: true,
      eliminar: true,
      asignar: true,
      ver_todas: true,
    };
    return overrides;
  }, {} as PermissionOverrides),
);

export const seedRoles: Role[] = [
  {
    id: 'rol-admin',
    name: 'Administrador',
    description: 'Acceso total a la operación, configuración y administración del sistema.',
    system: true,
    color: 'forest',
    permissions: allPermissions,
  },
  {
    id: 'rol-gerente',
    name: 'Gerente de proyectos',
    description: 'Coordina proyectos, cotizaciones, tareas y al equipo de operación.',
    system: true,
    color: 'info',
    permissions: permissions({
      dashboard: { ver: true },
      solicitudes: { ver: true, crear: true, editar: true, eliminar: true },
      cotizaciones: { ver: true, crear: true, editar: true, eliminar: true },
      proyectos: { ver: true, crear: true, editar: true, eliminar: true },
      tareas: {
        ver: true,
        crear: true,
        editar: true,
        eliminar: true,
        asignar: true,
        ver_todas: true,
      },
      agenda: {
        ver: true,
        crear: true,
        editar: true,
        eliminar: true,
        asignar: true,
        ver_todas: true,
      },
      usuarios: { ver: true },
      roles: { ver: true },
      configuracion: { ver: true },
    }),
  },
  {
    id: 'rol-supervisor',
    name: 'Supervisor de instalaciones',
    description: 'Supervisa la ejecución en campo, el cronograma y las tareas técnicas.',
    system: true,
    color: 'warning',
    permissions: permissions({
      dashboard: { ver: true },
      solicitudes: { ver: true },
      cotizaciones: { ver: true },
      proyectos: { ver: true, editar: true },
      tareas: {
        ver: true,
        crear: true,
        editar: true,
        asignar: true,
        ver_todas: true,
      },
      agenda: {
        ver: true,
        crear: true,
        editar: true,
        asignar: true,
        ver_todas: true,
      },
      usuarios: { ver: true },
    }),
  },
  {
    id: 'rol-tecnico',
    name: 'Técnico instalador',
    description: 'Consulta únicamente los proyectos asignados, sus tareas y actividades.',
    system: true,
    color: 'success',
    permissions: permissions({
      proyectos: { ver: true, editar: true },
      tareas: { ver: true, editar: true },
      agenda: { ver: true },
      usuarios: { ver: true },
    }),
  },
  {
    id: 'rol-comercial',
    name: 'Asesor comercial',
    description: 'Gestiona solicitudes, cotizaciones y el seguimiento con el cliente.',
    system: true,
    color: 'solar',
    permissions: permissions({
      dashboard: { ver: true },
      solicitudes: { ver: true, crear: true, editar: true, eliminar: true },
      cotizaciones: { ver: true, crear: true, editar: true, eliminar: true },
      proyectos: { ver: true },
      tareas: { ver: true, crear: true, editar: true },
      agenda: { ver: true, crear: true, editar: true },
      usuarios: { ver: true },
    }),
  },
];

export function roleById(roles: Role[], roleId: string): Role | undefined {
  return roles.find((role) => role.id === roleId);
}

export function can(
  roles: Role[],
  roleId: string,
  module: ModuleKey,
  action: PermissionKey,
): boolean {
  const role = roleById(roles, roleId);
  return Boolean(role?.permissions[module]?.[action]);
}
