import {
  clearSession,
  demoUsers,
  getSession,
  getSessionUser,
  hasPermission,
  loadState,
  roleById,
  setSessionForUser,
} from '../../services/store';
import type { DemoSession, User } from '../../types/admin';
import { escapeHtml, relativeTime } from '../../utils/format';
import { icon } from './icons';
import { confirmDialog, toast, toastError } from './ui';

const SIDEBAR_KEY = 'enersol.admin.sidebar.v1';

function el<T extends HTMLElement>(selector: string): T | null {
  return document.querySelector<T>(selector);
}

function setText(selector: string, value: string): void {
  document.querySelectorAll<HTMLElement>(selector).forEach((node) => {
    node.textContent = value;
  });
}

function applyUser(user: User): void {
  const name = `${user.firstName} ${user.lastName}`.trim();
  setText('[data-admin-user-name]', name);
  setText('[data-admin-user-initials]', name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join(''));
  const avatar = el<HTMLElement>('[data-admin-user-avatar]');
  if (avatar) avatar.style.backgroundColor = user.avatarColor;
  setText('[data-admin-user-job]', user.jobTitle);
}

function applyRole(roleName: string): void {
  setText('[data-admin-role-name]', roleName);
}

function buildRoleSwitcher(session: DemoSession): void {
  const select = el<HTMLSelectElement>('#role-switcher');
  if (!select) return;
  const state = loadState();
  const users = demoUsers();
  select.innerHTML = users
    .map((user) => {
      const role = roleById(state, user.roleId);
      const label = `${role?.name ?? 'Sin rol'} · ${user.firstName} ${user.lastName}`;
      return `<option value="${user.id}" ${user.id === session.userId ? 'selected' : ''}>${escapeHtml(
        label,
      )}</option>`;
    })
    .join('');
  select.addEventListener('change', () => {
    const userId = select.value;
    try {
      const next = setSessionForUser(userId, true);
      const user = loadState().users.find((item) => item.id === next.userId);
      toast(
        `Ahora navegas como ${user ? `${user.firstName} ${user.lastName}` : next.name}.`,
        'info',
        'Rol de demostración actualizado',
      );
      window.setTimeout(() => window.location.reload(), 450);
    } catch (error) {
      toastError(error);
    }
  });
}

function applyPermissions(session: DemoSession): void {
  document.querySelectorAll<HTMLElement>('[data-permission-module]').forEach((node) => {
    const module = node.dataset.permissionModule as Parameters<typeof hasPermission>[1];
    if (!module) return;
    if (!hasPermission(session.roleId, module, 'ver')) {
      node.remove();
    }
  });
}

function initSidebar(): void {
  const body = document.body;
  if (window.localStorage.getItem(SIDEBAR_KEY) === 'collapsed') {
    body.classList.add('sidebar-collapsed');
  }
  document.querySelectorAll<HTMLElement>('[data-sidebar-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      body.classList.toggle('sidebar-open');
      button.setAttribute('aria-expanded', String(body.classList.contains('sidebar-open')));
    });
  });
  const collapse = el<HTMLElement>('[data-sidebar-collapse]');
  collapse?.addEventListener('click', () => {
    body.classList.toggle('sidebar-collapsed');
    window.localStorage.setItem(
      SIDEBAR_KEY,
      body.classList.contains('sidebar-collapsed') ? 'collapsed' : 'expanded',
    );
  });
  el<HTMLElement>('#sidebar-backdrop')?.addEventListener('click', () => {
    body.classList.remove('sidebar-open');
  });
  document.querySelectorAll<HTMLAnchorElement>('#admin-sidebar a[href]').forEach((link) => {
    link.addEventListener('click', () => {
      if (window.matchMedia('(max-width: 1023px)').matches) {
        body.classList.remove('sidebar-open');
      }
    });
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') body.classList.remove('sidebar-open');
  });
}

function initLogout(): void {
  document.querySelectorAll<HTMLElement>('[data-admin-logout]').forEach((button) => {
    button.addEventListener('click', async () => {
      const confirmed = await confirmDialog({
        title: 'Cerrar sesión de demostración',
        message:
          'Se cerrará tu sesión simulada. Los cambios que hiciste en los datos se conservan en este navegador.',
        confirmLabel: 'Cerrar sesión',
        tone: 'primary',
      });
      if (!confirmed) return;
      clearSession();
      window.location.href = '/admin/login';
    });
  });
}

function initNotifications(): void {
  const button = el<HTMLButtonElement>('[data-notifications-button]');
  const panel = el<HTMLElement>('[data-notifications-panel]');
  if (!button || !panel) return;
  const state = loadState();
  const pending = state.solicitudes.filter((item) =>
    ['nueva', 'en-revision', 'pendiente-info'].includes(item.status),
  ).length;
  const badge = el<HTMLElement>('[data-notifications-badge]');
  if (badge) {
    badge.textContent = pending > 9 ? '9+' : String(pending);
    badge.classList.toggle('hidden', pending === 0);
  }

  const activities = state.activities.slice(0, 6);
  panel.innerHTML = `
    <div class="flex items-center justify-between border-b border-line px-4 py-3">
      <p class="text-sm font-semibold text-forest">Actividad reciente</p>
      <a href="/admin/dashboard#actividad" class="text-xs font-semibold text-forest hover:underline">Ver todo</a>
    </div>
    <ul class="admin-scroll max-h-80 divide-y divide-line/70 overflow-y-auto">
      ${
        activities.length
          ? activities
              .map(
                (item) => `
            <li class="flex gap-3 px-4 py-3">
              <span class="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-light-green text-forest">
                ${icon('activity', 'h-4 w-4')}
              </span>
              <div class="min-w-0">
                <p class="truncate text-sm font-medium text-charcoal">${escapeHtml(item.title)}</p>
                <p class="mt-0.5 line-clamp-2 text-xs text-muted">${escapeHtml(item.description ?? '')}</p>
                <p class="mt-1 text-[11px] text-muted">${escapeHtml(relativeTime(item.timestamp))}</p>
              </div>
            </li>
          `,
              )
              .join('')
          : '<li class="px-4 py-8 text-center text-sm text-muted">Sin actividad reciente.</li>'
      }
    </ul>
  `;

  button.addEventListener('click', (event) => {
    event.stopPropagation();
    panel.classList.toggle('hidden');
    button.setAttribute('aria-expanded', String(!panel.classList.contains('hidden')));
  });
  document.addEventListener('click', (event) => {
    if (!panel.contains(event.target as Node) && !button.contains(event.target as Node)) {
      panel.classList.add('hidden');
      button.setAttribute('aria-expanded', 'false');
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      panel.classList.add('hidden');
      button.setAttribute('aria-expanded', 'false');
    }
  });
}

function initUserMenu(): void {
  const button = el<HTMLElement>('[data-user-menu-button]');
  const menu = el<HTMLElement>('[data-user-menu]');
  if (!button || !menu) return;
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    menu.classList.toggle('hidden');
    button.setAttribute('aria-expanded', String(!menu.classList.contains('hidden')));
  });
  document.addEventListener('click', (event) => {
    if (!menu.contains(event.target as Node) && !button.contains(event.target as Node)) {
      menu.classList.add('hidden');
      button.setAttribute('aria-expanded', 'false');
    }
  });
}

export function requireSession(): DemoSession {
  const session = getSession();
  if (!session) {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.replace(`/admin/login?next=${next}`);
    throw new Error('Redirigiendo al inicio de sesión.');
  }
  return session;
}

export function initAdminShell(): DemoSession | null {
  if (typeof window === 'undefined') return null;
  const session = getSession();
  if (!session) {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.replace(`/admin/login?next=${next}`);
    return null;
  }

  const user = getSessionUser();
  const state = loadState();
  const role = roleById(state, session.roleId);
  if (user) applyUser(user);
  applyRole(role?.name ?? 'Sin rol');
  buildRoleSwitcher(session);
  applyPermissions(session);
  initSidebar();
  initLogout();
  initNotifications();
  initUserMenu();

  return session;
}
