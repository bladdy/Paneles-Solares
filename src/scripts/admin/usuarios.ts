import {
  createUser,
  deleteUser,
  getSession,
  hasPermission,
  loadState,
  roleById,
  setUserStatus,
  updateUser,
} from '../../services/store';
import type { User, UserStatus } from '../../types/admin';
import {
  escapeHtml,
  formatDate,
  formatNumber,
  relativeTime,
  safeJson,
} from '../../utils/format';
import { USER_STATUS_CLASS, USER_STATUS_LABEL } from '../../utils/status';
import { icon } from './icons';
import {
  avatarLetter,
  confirmDialog,
  emptyStateHtml,
  openModal,
  toast,
  toastError,
} from './ui';

interface Filters {
  search: string;
  role: string;
  status: 'todos' | UserStatus;
  page: number;
}

const PAGE_SIZE = 8;

const state = {
  filters: { search: '', role: 'todos', status: 'todos', page: 1 } as Filters,
  list: [] as User[],
};

function fullName(user: User): string {
  return `${user.firstName} ${user.lastName}`.trim();
}

function filtered(): User[] {
  const data = loadState();
  const f = state.filters;
  const term = f.search.trim().toLowerCase();
  return data.users.filter((user) => {
    if (f.role !== 'todos' && user.roleId !== f.role) return false;
    if (f.status !== 'todos' && user.status !== f.status) return false;
    if (!term) return true;
    return [fullName(user), user.email, user.phone, user.jobTitle]
      .join(' ')
      .toLowerCase()
      .includes(term);
  });
}

function canManage(): boolean {
  const session = getSession();
  return session ? hasPermission(session.roleId, 'usuarios', 'editar') : false;
}

function canCreate(): boolean {
  const session = getSession();
  return session ? hasPermission(session.roleId, 'usuarios', 'crear') : false;
}

function roleOptions(selected = ''): string {
  return loadState()
    .roles.map(
      (role) =>
        `<option value="${role.id}" ${role.id === selected ? 'selected' : ''}>${escapeHtml(role.name)}</option>`,
    )
    .join('');
}

function renderStats(): void {
  const container = document.getElementById('users-stats');
  if (!container) return;
  const users = loadState().users;
  const active = users.filter((user) => user.status === 'activo').length;
  const invited = users.filter((user) => user.status === 'invitacion').length;
  const suspended = users.filter((user) => user.status === 'suspendido').length;
  const roles = loadState().roles.length;
  container.innerHTML = [
    { label: 'Usuarios totales', value: formatNumber(users.length), tone: 'bg-light-green text-forest' },
    { label: 'Activos', value: formatNumber(active), tone: 'bg-success-soft text-success' },
    { label: 'Invitaciones pendientes', value: formatNumber(invited), tone: 'bg-warning-soft text-warning' },
    { label: 'Suspendidos', value: formatNumber(suspended), tone: 'bg-slate-100 text-slate-600' },
    { label: 'Roles configurados', value: formatNumber(roles), tone: 'bg-info-soft text-info' },
  ]
    .map(
      (item) => `
      <div class="admin-card p-4">
        <p class="text-[11px] font-bold uppercase tracking-wider text-muted">${item.label}</p>
        <p class="mt-1.5 flex items-center gap-2 font-display text-2xl font-extrabold text-forest">
          <span class="h-2 w-2 rounded-full ${item.tone.split(' ')[0]}"></span>${item.value}
        </p>
      </div>
    `,
    )
    .join('');
}

function renderFilters(): void {
  const container = document.getElementById('users-filters');
  const roleSelect = document.getElementById('users-role-filter') as HTMLSelectElement | null;
  if (!container || !roleSelect) return;
  const data = loadState();
  roleSelect.innerHTML = `
    <option value="todos">Todos los roles</option>
    ${data.roles
      .map((role) => `<option value="${role.id}" ${role.id === state.filters.role ? 'selected' : ''}>${escapeHtml(role.name)}</option>`)
      .join('')}
  `;

  const counts = [
    { key: 'todos', label: 'Todos', count: data.users.length },
    { key: 'activo', label: 'Activos', count: data.users.filter((user) => user.status === 'activo').length },
    { key: 'invitacion', label: 'Invitaciones', count: data.users.filter((user) => user.status === 'invitacion').length },
    { key: 'suspendido', label: 'Suspendidos', count: data.users.filter((user) => user.status === 'suspendido').length },
  ];
  container.innerHTML = counts
    .map(
      (item) => `
      <button type="button" class="admin-chip ${state.filters.status === item.key ? 'admin-chip-active' : ''}" data-status-chip="${item.key}">
        ${item.label} <span class="rounded-full bg-charcoal/5 px-1.5 text-[11px] font-semibold">${item.count}</span>
      </button>
    `,
    )
    .join('');

  container.querySelectorAll<HTMLButtonElement>('[data-status-chip]').forEach((button) => {
    button.addEventListener('click', () => {
      state.filters.status = button.dataset.statusChip as Filters['status'];
      state.filters.page = 1;
      render();
    });
  });
}

function rowActions(user: User): string {
  const active = user.status === 'activo';
  return [
    `<button type="button" class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-charcoal hover:bg-natural" data-edit-user="${user.id}" role="menuitem">
      ${icon('pencil', 'h-4 w-4 text-muted')} Editar usuario
    </button>`,
    `<button type="button" class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-charcoal hover:bg-natural" data-toggle-user="${user.id}" role="menuitem">
      ${icon(active ? 'lock' : 'checkCircle', 'h-4 w-4 text-muted')} ${active ? 'Suspender acceso' : 'Activar acceso'}
    </button>`,
    `<button type="button" class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-danger hover:bg-danger-soft" data-delete-user="${user.id}" role="menuitem">
      ${icon('trash', 'h-4 w-4')} Eliminar
    </button>`,
  ].join('');
}

function renderTable(): void {
  const container = document.getElementById('users-table');
  if (!container) return;
  const rows = state.list;
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  state.filters.page = Math.min(state.filters.page, totalPages);
  const start = (state.filters.page - 1) * PAGE_SIZE;
  const pageRows = rows.slice(start, start + PAGE_SIZE)
    .slice()
    .sort((a, b) => fullName(a).localeCompare(fullName(b)));

  const count = document.getElementById('users-count');
  if (count) count.textContent = `${formatNumber(rows.length)} usuario${rows.length === 1 ? '' : 's'}`;

  if (rows.length === 0) {
    container.innerHTML = emptyStateHtml({
      iconName: 'users',
      title: 'No encontramos usuarios',
      description: 'Ajusta los filtros o invita a un nuevo integrante del equipo.',
      action: canCreate()
        ? '<button type="button" class="admin-btn admin-btn-primary admin-btn-sm" data-new-user>Invitar usuario</button>'
        : undefined,
    });
    document.getElementById('users-pagination')?.setAttribute('hidden', '');
    bindTableEvents();
    return;
  }
  document.getElementById('users-pagination')?.removeAttribute('hidden');

  container.innerHTML = `
    <div class="overflow-x-auto">
      <table class="admin-table min-w-[860px]">
        <thead>
          <tr>
            <th>Usuario</th>
            <th>Teléfono</th>
            <th>Rol</th>
            <th>Estado</th>
            <th>Último acceso</th>
            <th>Alta</th>
            <th class="w-12 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${pageRows
            .map((user) => {
              const role = roleById(loadState(), user.roleId);
              return `
                <tr>
                  <td class="max-w-[260px]">
                    <div class="flex items-center gap-3">
                      <span class="admin-avatar h-9 w-9 text-[11px]" style="background-color:${user.avatarColor}">${escapeHtml(
                        avatarLetter(fullName(user)),
                      )}</span>
                      <div class="min-w-0">
                        <p class="truncate font-semibold text-charcoal">${escapeHtml(fullName(user))}</p>
                        <p class="truncate text-xs text-muted">${escapeHtml(user.email)}</p>
                        <p class="truncate text-[11px] text-muted">${escapeHtml(user.jobTitle)}</p>
                      </div>
                    </div>
                  </td>
                  <td class="whitespace-nowrap text-sm">${escapeHtml(user.phone)}</td>
                  <td>
                    <span class="admin-badge border-line bg-natural text-charcoal">${escapeHtml(role?.name ?? 'Sin rol')}</span>
                  </td>
                  <td><span class="admin-badge ${USER_STATUS_CLASS[user.status]}">${USER_STATUS_LABEL[user.status]}</span></td>
                  <td class="whitespace-nowrap text-xs text-muted">${user.lastAccess ? relativeTime(user.lastAccess) : 'Sin acceso'}</td>
                  <td class="whitespace-nowrap text-xs text-muted">${formatDate(user.createdAt)}</td>
                  <td class="text-right">
                    ${
                      canManage()
                        ? `<div class="relative inline-block" data-row-menu>
                            <button type="button" class="admin-icon-btn" data-menu-button aria-haspopup="true" aria-expanded="false" aria-label="Acciones de ${escapeHtml(fullName(user))}">
                              ${icon('more', 'h-4 w-4')}
                            </button>
                            <div class="absolute right-0 top-full z-30 mt-1 hidden w-52 overflow-hidden rounded-xl border border-line bg-white p-1.5 text-left shadow-xl" data-menu role="menu">
                              ${rowActions(user)}
                            </div>
                          </div>`
                        : '<span class="text-xs text-muted">—</span>'
                    }
                  </td>
                </tr>
              `;
            })
            .join('')}
        </tbody>
      </table>
    </div>
  `;

  const range = document.getElementById('users-range');
  if (range) range.textContent = `Mostrando ${start + 1}–${Math.min(start + PAGE_SIZE, rows.length)} de ${rows.length}`;
  const label = document.getElementById('users-page-label');
  if (label) label.textContent = `Página ${state.filters.page} de ${totalPages}`;

  bindTableEvents();
}

function bindTableEvents(): void {
  document.querySelectorAll<HTMLElement>('[data-row-menu]').forEach((menu) => {
    const button = menu.querySelector<HTMLButtonElement>('[data-menu-button]');
    const panel = menu.querySelector<HTMLElement>('[data-menu]');
    if (!button || !panel) return;
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const isOpen = !panel.classList.contains('hidden');
      document.querySelectorAll<HTMLElement>('[data-menu]').forEach((other) => other.classList.add('hidden'));
      document.querySelectorAll<HTMLButtonElement>('[data-menu-button]').forEach((other) => other.setAttribute('aria-expanded', 'false'));
      panel.classList.toggle('hidden', isOpen);
      button.setAttribute('aria-expanded', String(!isOpen));
    });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-edit-user]').forEach((button) => {
    button.addEventListener('click', () => {
      const user = loadState().users.find((item) => item.id === button.dataset.editUser);
      if (user) openUserModal(user);
    });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-toggle-user]').forEach((button) => {
    button.addEventListener('click', () => {
      const user = loadState().users.find((item) => item.id === button.dataset.toggleUser);
      if (!user) return;
      try {
        setUserStatus(user.id, user.status === 'activo' ? 'suspendido' : 'activo');
        toast(user.status === 'activo' ? 'Acceso suspendido.' : 'Acceso activado.', 'success');
        render();
      } catch (error) {
        toastError(error);
      }
    });
  });

  document.querySelectorAll<HTMLButtonElement>('[data-delete-user]').forEach((button) => {
    button.addEventListener('click', async () => {
      const user = loadState().users.find((item) => item.id === button.dataset.deleteUser);
      if (!user) return;
      const confirmed = await confirmDialog({
        title: 'Eliminar usuario',
        message: `¿Eliminar a ${fullName(user)}? Se quitará del directorio de demostración y no podrá iniciar sesión.`,
        confirmLabel: 'Eliminar',
        tone: 'danger',
      });
      if (!confirmed) return;
      try {
        deleteUser(user.id);
        toast('Usuario eliminado.', 'success');
        render();
      } catch (error) {
        toastError(error);
      }
    });
  });

  document.querySelectorAll<HTMLElement>('[data-new-user]').forEach((button) => {
    if (button.dataset.bound === 'true') return;
    button.dataset.bound = 'true';
    button.addEventListener('click', () => openUserModal());
  });
}

function openUserModal(user?: User): void {
  const modal = openModal({
    title: user ? 'Editar usuario' : 'Invitar usuario',
    subtitle: user
      ? 'Actualiza los datos y el rol del integrante.'
      : 'La invitación es simulada: el usuario queda registrado de inmediato.',
    size: 'lg',
    content: `
      <form id="user-form" class="space-y-4">
        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label class="admin-label" for="user-first">Nombre *</label>
            <input id="user-first" class="admin-input" required value="${escapeHtml(user?.firstName ?? '')}" />
          </div>
          <div>
            <label class="admin-label" for="user-last">Apellido *</label>
            <input id="user-last" class="admin-input" required value="${escapeHtml(user?.lastName ?? '')}" />
          </div>
          <div>
            <label class="admin-label" for="user-email">Correo electrónico *</label>
            <input id="user-email" type="email" class="admin-input" required value="${escapeHtml(user?.email ?? '')}" />
          </div>
          <div>
            <label class="admin-label" for="user-phone">Teléfono *</label>
            <input id="user-phone" class="admin-input" required value="${escapeHtml(user?.phone ?? '')}" placeholder="+52 55 0000 0000" />
          </div>
          <div>
            <label class="admin-label" for="user-role">Rol *</label>
            <select id="user-role" class="admin-select" required>${roleOptions(user?.roleId ?? 'rol-comercial')}</select>
          </div>
          <div>
            <label class="admin-label" for="user-status">Estado *</label>
            <select id="user-status" class="admin-select">
              ${(['activo', 'invitacion', 'suspendido'] as UserStatus[])
                .map(
                  (status) =>
                    `<option value="${status}" ${(user?.status ?? 'invitacion') === status ? 'selected' : ''}>${USER_STATUS_LABEL[status]}</option>`,
                )
                .join('')}
            </select>
          </div>
          <div class="sm:col-span-2">
            <label class="admin-label" for="user-job">Puesto</label>
            <input id="user-job" class="admin-input" value="${escapeHtml(user?.jobTitle ?? '')}" placeholder="Ej. Asesor comercial" />
          </div>
        </div>
        ${
          user
            ? `<p class="rounded-lg border border-line bg-natural/70 p-3 text-xs text-muted">
                Alta: ${formatDate(user.createdAt)} · Último acceso: ${user.lastAccess ? formatDate(user.lastAccess) : 'sin acceso'}.
              </p>`
            : ''
        }
      </form>
    `,
    footer: `
      <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" class="admin-btn admin-btn-secondary" data-overlay-close>Cancelar</button>
        <button type="submit" form="user-form" class="admin-btn admin-btn-primary">${user ? 'Guardar cambios' : 'Invitar usuario'}</button>
      </div>
    `,
  });

  modal.panel.querySelector<HTMLFormElement>('#user-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const get = (id: string) => modal.panel.querySelector<HTMLInputElement>(`#${id}`)?.value.trim() ?? '';
    const select = (id: string) => modal.panel.querySelector<HTMLSelectElement>(`#${id}`)?.value ?? '';
    if (!get('user-first') || !get('user-last') || !get('user-email') || !get('user-phone') || !select('user-role')) {
      toast('Completa los campos obligatorios del usuario.', 'warning');
      return;
    }
    try {
      if (user) {
        updateUser(user.id, {
          firstName: get('user-first'),
          lastName: get('user-last'),
          email: get('user-email'),
          phone: get('user-phone'),
          roleId: select('user-role'),
          status: select('user-status') as UserStatus,
          jobTitle: get('user-job') || 'Colaborador',
        });
      } else {
        createUser({
          firstName: get('user-first'),
          lastName: get('user-last'),
          email: get('user-email'),
          phone: get('user-phone'),
          roleId: select('user-role'),
          status: select('user-status') as UserStatus,
          jobTitle: get('user-job') || 'Colaborador',
        });
      }
      modal.close();
      toast(user ? 'Usuario actualizado.' : 'Usuario invitado al equipo.', 'success');
      render();
    } catch (error) {
      toastError(error);
    }
  });
}

function render(): void {
  state.list = filtered();
  renderStats();
  renderFilters();
  renderTable();
}

export function initUsers(): void {
  const saved = safeJson<Partial<Filters> | null>(window.sessionStorage.getItem('enersol.usuarios.filters'), null);
  if (saved) Object.assign(state.filters, saved);
  const search = document.getElementById('users-search') as HTMLInputElement | null;
  if (search) {
    search.value = state.filters.search;
    search.addEventListener('input', () => {
      state.filters.search = search.value;
      state.filters.page = 1;
      renderTable();
    });
  }
  const roleFilter = document.getElementById('users-role-filter') as HTMLSelectElement | null;
  roleFilter?.addEventListener('change', () => {
    state.filters.role = roleFilter.value;
    state.filters.page = 1;
    render();
  });
  const statusFilter = document.getElementById('users-status-filter') as HTMLSelectElement | null;
  if (statusFilter) {
    statusFilter.value = state.filters.status;
    statusFilter.addEventListener('change', () => {
      state.filters.status = statusFilter.value as Filters['status'];
      state.filters.page = 1;
      render();
    });
  }
  document.getElementById('users-prev')?.addEventListener('click', () => {
    if (state.filters.page > 1) {
      state.filters.page -= 1;
      renderTable();
    }
  });
  document.getElementById('users-next')?.addEventListener('click', () => {
    const totalPages = Math.max(1, Math.ceil(state.list.length / PAGE_SIZE));
    if (state.filters.page < totalPages) {
      state.filters.page += 1;
      renderTable();
    }
  });
  document.addEventListener('click', () => {
    document.querySelectorAll<HTMLElement>('[data-menu]').forEach((menu) => menu.classList.add('hidden'));
    document.querySelectorAll<HTMLButtonElement>('[data-menu-button]').forEach((button) => button.setAttribute('aria-expanded', 'false'));
  });

  render();

  window.addEventListener('beforeunload', () => {
    window.sessionStorage.setItem('enersol.usuarios.filters', JSON.stringify(state.filters));
  });
}
