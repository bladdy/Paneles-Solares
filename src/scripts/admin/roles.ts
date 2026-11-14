import {
  createRole,
  deleteRole,
  emptyPermissionMatrix,
  getSession,
  hasPermission,
  loadState,
  updateRole,
  updateRolePermissions,
} from '../../services/store';
import type {
  ModuleKey,
  PermissionAction,
  PermissionMatrix,
  Role,
} from '../../types/admin';
import { MODULE_VALUES, PERMISSION_ACTION_VALUES } from '../../types/admin';
import {
  escapeHtml,
  formatNumber,
  safeJson,
} from '../../utils/format';
import {
  MODULE_LABEL,
  PERMISSION_LABEL,
} from '../../utils/status';
import { icon } from './icons';
import {
  confirmDialog,
  emptyStateHtml,
  openModal,
  toast,
  toastError,
} from './ui';

const ROLE_COLOR_CLASS: Record<Role['color'], string> = {
  forest: 'bg-forest text-solar',
  solar: 'bg-solar-soft text-[#9A6700]',
  success: 'bg-success-soft text-success',
  info: 'bg-info-soft text-info',
  warning: 'bg-warning-soft text-warning',
};

const ROLE_COLOR_DOT: Record<Role['color'], string> = {
  forest: 'bg-forest',
  solar: 'bg-solar',
  success: 'bg-success',
  info: 'bg-info',
  warning: 'bg-warning',
};

let selectedRoleId = '';
let draft: PermissionMatrix = emptyPermissionMatrix();
let draftRoleId = '';

function canManage(): boolean {
  const session = getSession();
  return session ? hasPermission(session.roleId, 'roles', 'editar') : false;
}

function canCreate(): boolean {
  const session = getSession();
  return session ? hasPermission(session.roleId, 'roles', 'crear') : false;
}

function selectedRole(): Role | undefined {
  return loadState().roles.find((role) => role.id === selectedRoleId);
}

function loadDraft(role: Role): void {
  if (draftRoleId === role.id) return;
  draft = JSON.parse(JSON.stringify(role.permissions)) as PermissionMatrix;
  draftRoleId = role.id;
}

function normalizeMatrix(matrix: PermissionMatrix): PermissionMatrix {
  const result = JSON.parse(JSON.stringify(matrix)) as PermissionMatrix;
  MODULE_VALUES.forEach((module) => {
    const row = result[module];
    if (!row.ver && (row.crear || row.editar || row.eliminar)) row.ver = true;
    if (!row.ver) {
      row.crear = false;
      row.editar = false;
      row.eliminar = false;
    }
  });
  return result;
}

function ensureSelection(): void {
  const roles = loadState().roles;
  if (!selectedRoleId || !roles.some((role) => role.id === selectedRoleId)) {
    selectedRoleId = roles[0]?.id ?? '';
    draftRoleId = '';
  }
}

/* ------------------------------------------------------------------ */
/* Lista de roles                                                      */
/* ------------------------------------------------------------------ */

function renderRoleList(): void {
  const container = document.getElementById('roles-list');
  if (!container) return;
  const data = loadState();
  const roles = data.roles;

  container.innerHTML = roles
    .map((role) => {
      const active = role.id === selectedRoleId;
      const memberCount = data.users.filter((user) => user.roleId === role.id).length;
      const moduleCount = MODULE_VALUES.filter((module) => role.permissions[module].ver).length;
      return `
        <button
          type="button"
          class="w-full rounded-xl border p-3 text-left transition-colors ${
            active ? 'border-forest/30 bg-light-green/40' : 'border-line bg-white hover:border-forest/20 hover:bg-natural/60'
          }"
          data-select-role="${role.id}"
          aria-pressed="${active}"
        >
          <div class="flex items-start gap-2.5">
            <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${ROLE_COLOR_CLASS[role.color]}">
              ${icon(role.system ? 'shieldCheck' : 'shield', 'h-4 w-4')}
            </span>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5">
                <p class="truncate text-sm font-semibold text-charcoal">${escapeHtml(role.name)}</p>
                ${role.system ? '<span class="rounded bg-charcoal/5 px-1.5 py-0.5 text-[10px] font-semibold text-muted">Sistema</span>' : ''}
              </div>
              <p class="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-muted">${escapeHtml(role.description)}</p>
              <p class="mt-1 text-[11px] font-medium text-charcoal/70">${memberCount} usuario${memberCount === 1 ? '' : 's'} · ${moduleCount} módulo${moduleCount === 1 ? '' : 's'}</p>
            </div>
          </div>
        </button>
      `;
    })
    .join('');

  container.querySelectorAll<HTMLButtonElement>('[data-select-role]').forEach((button) => {
    button.addEventListener('click', () => {
      selectedRoleId = button.dataset.selectRole ?? '';
      draftRoleId = '';
      render();
    });
  });
}

/* ------------------------------------------------------------------ */
/* Editor                                                              */
/* ------------------------------------------------------------------ */

function renderEditor(): void {
  const main = document.getElementById('roles-editor');
  if (!main) return;
  const role = selectedRole();
  if (!role) {
    main.innerHTML = emptyStateHtml({
      iconName: 'shield',
      title: 'Sin roles configurados',
      description: 'Crea un rol para definir permisos de acceso.',
    });
    return;
  }

  loadDraft(role);
  const readonly = !canManage() || role.id === 'rol-admin';
  const adminLocked = role.id === 'rol-admin';
  const stale = JSON.stringify(draft) !== JSON.stringify(role.permissions);

  main.innerHTML = `
    <div class="admin-card">
      <div class="admin-card-header flex-wrap gap-3">
        <div class="flex items-start gap-3">
          <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${ROLE_COLOR_CLASS[role.color]}">
            ${icon(role.system ? 'shieldCheck' : 'shield', 'h-5 w-5')}
          </span>
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <h2 class="font-display text-lg font-extrabold tracking-tight text-forest">${escapeHtml(role.name)}</h2>
              ${role.system ? '<span class="admin-badge border-line bg-natural text-muted">Rol del sistema</span>' : ''}
            </div>
            <p class="mt-0.5 max-w-xl text-xs leading-relaxed text-muted">${escapeHtml(role.description)}</p>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          ${
            canManage() && !adminLocked
              ? `<button type="button" class="admin-btn admin-btn-secondary admin-btn-sm" data-edit-role>${icon('pencil', 'h-3.5 w-3.5')} Editar datos</button>`
              : ''
          }
          ${
            canManage() && !role.system
              ? `<button type="button" class="admin-btn admin-btn-danger-soft admin-btn-sm" data-delete-role>${icon('trash', 'h-3.5 w-3.5')} Eliminar</button>`
              : ''
          }
        </div>
      </div>

      ${
        adminLocked
          ? `<div class="mx-4 mt-4 flex items-start gap-2.5 rounded-xl border border-info/20 bg-info-soft/60 p-3">
              ${icon('lock', 'mt-0.5 h-4 w-4 shrink-0 text-info')}
              <p class="text-xs leading-relaxed text-charcoal/80">
                El rol <strong>Administrador</strong> conserva acceso total por diseño y no puede modificarse.
              </p>
            </div>`
          : ''
      }

      <div class="admin-card-body">
        ${
          readonly && !adminLocked
            ? `<p class="mb-4 rounded-lg border border-line bg-natural/70 p-3 text-xs text-muted">
                Tienes acceso de solo lectura a los roles con tu perfil actual.
              </p>`
            : ''
        }
        <div class="overflow-x-auto rounded-xl border border-line">
          <table class="admin-table min-w-[560px]">
            <thead>
              <tr>
                <th>Módulo</th>
                ${PERMISSION_ACTION_VALUES.map((action) => `<th class="text-center">${PERMISSION_LABEL[action]}</th>`).join('')}
                <th class="text-center">Total</th>
              </tr>
            </thead>
            <tbody>
              ${MODULE_VALUES.map((module) => {
                const row = draft[module];
                const count = PERMISSION_ACTION_VALUES.filter((action) => row[action]).length;
                return `
                  <tr>
                    <td class="font-medium text-charcoal">
                      <span class="flex items-center gap-2">
                        <span class="h-1.5 w-1.5 rounded-full ${count > 0 ? 'bg-forest' : 'bg-line'}"></span>
                        ${MODULE_LABEL[module]}
                      </span>
                    </td>
                    ${PERMISSION_ACTION_VALUES.map(
                      (action) => `
                        <td class="text-center">
                          <input
                            type="checkbox"
                            class="admin-checkbox"
                            data-perm-module="${module}"
                            data-perm-action="${action}"
                            ${row[action] ? 'checked' : ''}
                            ${readonly ? 'disabled' : ''}
                            aria-label="${PERMISSION_LABEL[action]} ${MODULE_LABEL[module]}"
                          />
                        </td>
                      `,
                    ).join('')}
                    <td class="text-center">
                      <span class="text-[11px] font-semibold ${count === 4 ? 'text-success' : count > 0 ? 'text-charcoal' : 'text-muted'}">${count}/4</span>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

        ${
          !readonly
            ? `<div class="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p class="text-[11px] text-muted">Los permisos de creación, edición y eliminación requieren el permiso de ver.</p>
                <div class="flex flex-wrap gap-2">
                  <button type="button" class="admin-btn admin-btn-secondary admin-btn-sm" data-reset-perms ${stale ? '' : 'disabled'}>
                    ${icon('rotate', 'h-3.5 w-3.5')} Restablecer
                  </button>
                  <button type="button" class="admin-btn admin-btn-primary admin-btn-sm" data-save-perms ${stale ? '' : 'disabled'}>
                    ${icon('save', 'h-3.5 w-3.5')} Guardar permisos
                  </button>
                </div>
              </div>`
            : ''
        }
      </div>
    </div>
  `;

  bindEditor(role, readonly);
}

function bindEditor(role: Role, readonly: boolean): void {
  if (readonly) {
    document.querySelectorAll<HTMLElement>('[data-edit-role], [data-delete-role]').forEach((button) => {
      button.addEventListener('click', () => toast('No tienes permiso para modificar este rol.', 'warning'));
    });
    return;
  }

  document.querySelectorAll<HTMLInputElement>('[data-perm-module]').forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      const module = checkbox.dataset.permModule as ModuleKey;
      const action = checkbox.dataset.permAction as PermissionAction;
      draft[module][action] = checkbox.checked;
      if (checkbox.checked && !draft[module].ver) draft[module].ver = true;
      if (!checkbox.checked && action === 'ver') {
        draft[module].crear = false;
        draft[module].editar = false;
        draft[module].eliminar = false;
      }
      draft = normalizeMatrix(draft);
      renderEditor();
    });
  });

  document.querySelectorAll<HTMLElement>('[data-save-perms]').forEach((button) => {
    button.addEventListener('click', () => {
      try {
        updateRolePermissions(role.id, normalizeMatrix(draft));
        draftRoleId = '';
        toast('Matriz de permisos actualizada.', 'success');
        render();
      } catch (error) {
        toastError(error);
      }
    });
  });

  document.querySelectorAll<HTMLElement>('[data-reset-perms]').forEach((button) => {
    button.addEventListener('click', () => {
      draft = JSON.parse(JSON.stringify(role.permissions)) as PermissionMatrix;
      draftRoleId = role.id;
      renderEditor();
    });
  });

  document.querySelectorAll<HTMLElement>('[data-edit-role]').forEach((button) => {
    button.addEventListener('click', () => openRoleModal(role));
  });

  document.querySelectorAll<HTMLElement>('[data-delete-role]').forEach((button) => {
    button.addEventListener('click', async () => {
      const confirmed = await confirmDialog({
        title: 'Eliminar rol',
        message: `¿Eliminar el rol "${role.name}"? Solo se puede eliminar si no tiene usuarios asignados.`,
        confirmLabel: 'Eliminar',
        tone: 'danger',
      });
      if (!confirmed) return;
      try {
        deleteRole(role.id);
        selectedRoleId = '';
        draftRoleId = '';
        toast('Rol eliminado.', 'success');
        render();
      } catch (error) {
        toastError(error);
      }
    });
  });
}

/* ------------------------------------------------------------------ */
/* Modal de rol                                                        */
/* ------------------------------------------------------------------ */

const COLOR_OPTIONS: Array<{ value: Role['color']; label: string }> = [
  { value: 'forest', label: 'Verde bosque' },
  { value: 'solar', label: 'Amarillo solar' },
  { value: 'success', label: 'Verde éxito' },
  { value: 'info', label: 'Azul información' },
  { value: 'warning', label: 'Ámbar advertencia' },
];

function openRoleModal(role?: Role): void {
  const modal = openModal({
    title: role ? 'Editar rol' : 'Nuevo rol',
    subtitle: role ? 'Actualiza los datos del rol.' : 'Define el nombre y la base de permisos del nuevo rol.',
    size: 'lg',
    content: `
      <form id="role-form" class="space-y-4">
        <div class="grid gap-4 sm:grid-cols-2">
          <div class="sm:col-span-2">
            <label class="admin-label" for="role-name">Nombre *</label>
            <input id="role-name" class="admin-input" required value="${escapeHtml(role?.name ?? '')}" placeholder="Ej. Coordinador de instalaciones" />
          </div>
          <div class="sm:col-span-2">
            <label class="admin-label" for="role-description">Descripción *</label>
            <textarea id="role-description" class="admin-textarea" rows="3" required placeholder="Responsabilidades del rol…">${escapeHtml(
              role?.description ?? '',
            )}</textarea>
          </div>
          <div>
            <label class="admin-label" for="role-color">Color de identificación *</label>
            <select id="role-color" class="admin-select">
              ${COLOR_OPTIONS.map(
                (option) =>
                  `<option value="${option.value}" ${(role?.color ?? 'info') === option.value ? 'selected' : ''}>${option.label}</option>`,
              ).join('')}
            </select>
          </div>
          <div class="flex items-end">
            <p class="rounded-lg border border-line bg-natural/70 p-3 text-[11px] leading-relaxed text-muted">
              Después de crear el rol podrás ajustar su matriz de permisos módulo por módulo.
            </p>
          </div>
        </div>
      </form>
    `,
    footer: `
      <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" class="admin-btn admin-btn-secondary" data-overlay-close>Cancelar</button>
        <button type="submit" form="role-form" class="admin-btn admin-btn-primary">${role ? 'Guardar cambios' : 'Crear rol'}</button>
      </div>
    `,
  });

  modal.panel.querySelector<HTMLFormElement>('#role-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = modal.panel.querySelector<HTMLInputElement>('#role-name')?.value.trim() ?? '';
    const description = modal.panel.querySelector<HTMLTextAreaElement>('#role-description')?.value.trim() ?? '';
    const color = (modal.panel.querySelector<HTMLSelectElement>('#role-color')?.value ?? 'info') as Role['color'];
    if (!name || !description) {
      toast('Completa el nombre y la descripción del rol.', 'warning');
      return;
    }
    try {
      if (role) {
        updateRole(role.id, { name, description, color });
        toast('Rol actualizado.', 'success');
      } else {
        const permissions = emptyPermissionMatrix();
        permissions.dashboard.ver = true;
        const created = createRole({ name, description, color, permissions });
        selectedRoleId = created.id;
        draftRoleId = '';
        toast('Rol creado. Ajusta sus permisos.', 'success');
      }
      modal.close();
      render();
    } catch (error) {
      toastError(error);
    }
  });
}

/* ------------------------------------------------------------------ */
/* Arranque                                                            */
/* ------------------------------------------------------------------ */

function renderSummary(): void {
  const container = document.getElementById('roles-summary');
  if (!container) return;
  const data = loadState();
  const items = [
    { label: 'Roles', value: data.roles.length, iconName: 'shield' as const },
    { label: 'Roles del sistema', value: data.roles.filter((role) => role.system).length, iconName: 'lock' as const },
    { label: 'Roles personalizados', value: data.roles.filter((role) => !role.system).length, iconName: 'sparkles' as const },
    { label: 'Usuarios asignados', value: data.users.length, iconName: 'users' as const },
  ];
  container.innerHTML = items
    .map(
      (item) => `
      <div class="admin-card flex items-center gap-3 p-4">
        <span class="flex h-9 w-9 items-center justify-center rounded-lg bg-light-green text-forest">${icon(item.iconName, 'h-4 w-4')}</span>
        <div>
          <p class="font-display text-xl font-extrabold text-forest">${formatNumber(item.value)}</p>
          <p class="text-[11px] font-medium text-muted">${item.label}</p>
        </div>
      </div>
    `,
    )
    .join('');
}

function render(): void {
  ensureSelection();
  renderSummary();
  renderRoleList();
  renderEditor();
}

export function initRoles(): void {
  const saved = safeJson<string | null>(window.sessionStorage.getItem('enersol.roles.selected'), null);
  if (saved) selectedRoleId = saved;
  document.querySelectorAll<HTMLElement>('[data-new-role]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!canCreate()) {
        toast('No tienes permiso para crear roles.', 'warning');
        return;
      }
      openRoleModal();
    });
  });
  render();
  window.addEventListener('beforeunload', () => {
    window.sessionStorage.setItem('enersol.roles.selected', JSON.stringify(selectedRoleId));
  });
}
