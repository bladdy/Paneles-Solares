import {
  demoUsers,
  getSession,
  loadState,
  loginWithCredentials,
  roleById,
} from '../../services/store';
import { escapeHtml } from '../../utils/format';
import { setButtonLoading, toastError } from './ui';

function safeNext(): string {
  const params = new URLSearchParams(window.location.search);
  const next = params.get('next');
  if (next && next.startsWith('/admin') && !next.startsWith('/admin/login')) return next;
  return '/admin/dashboard';
}

function initRedirect(): void {
  if (!getSession()) return;
  const params = new URLSearchParams(window.location.search);
  if (params.get('switch') === '1') return;
  window.location.replace(safeNext());
}

function initQuickAccess(): void {
  const container = document.getElementById('quick-access');
  if (!container) return;
  const state = loadState();
  const users = demoUsers();
  container.innerHTML = users
    .map((user) => {
      const role = roleById(state, user.roleId);
      const name = `${user.firstName} ${user.lastName}`.trim();
      return `
        <button
          type="button"
          class="flex w-full items-center gap-3 rounded-xl border border-line bg-white px-3.5 py-2.5 text-left transition-colors hover:border-forest/30 hover:bg-natural"
          data-quick-email="${escapeHtml(user.email)}"
        >
          <span class="admin-avatar h-9 w-9 text-xs" style="background-color:${escapeHtml(user.avatarColor)}">${escapeHtml(
            name
              .split(/\s+/)
              .slice(0, 2)
              .map((part) => part[0]?.toUpperCase() ?? '')
              .join(''),
          )}</span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-semibold text-charcoal">${escapeHtml(name)}</span>
            <span class="block truncate text-xs text-muted">${escapeHtml(role?.name ?? 'Sin rol')}</span>
          </span>
          <span class="text-xs font-semibold text-forest">Entrar</span>
        </button>
      `;
    })
    .join('');

  container.querySelectorAll<HTMLButtonElement>('[data-quick-email]').forEach((button) => {
    button.addEventListener('click', () => {
      const email = button.dataset.quickEmail ?? '';
      const emailInput = document.getElementById('login-email') as HTMLInputElement | null;
      const passwordInput = document.getElementById('login-password') as HTMLInputElement | null;
      if (emailInput) emailInput.value = email;
      if (passwordInput && !passwordInput.value) passwordInput.value = 'demo1234';
      const form = document.getElementById('login-form') as HTMLFormElement | null;
      form?.requestSubmit();
    });
  });
}

function initPasswordToggle(): void {
  const toggle = document.getElementById('toggle-password');
  const input = document.getElementById('login-password') as HTMLInputElement | null;
  if (!toggle || !input) return;
  toggle.addEventListener('click', () => {
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    toggle.setAttribute('aria-pressed', String(show));
    toggle.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
  });
}

function setFieldError(field: HTMLInputElement, message: string): void {
  field.classList.add('admin-input-error');
  field.setAttribute('aria-invalid', 'true');
  const error = document.getElementById(`${field.id}-error`);
  if (error) {
    error.textContent = message;
    error.classList.remove('hidden');
  }
}

function clearFieldError(field: HTMLInputElement): void {
  field.classList.remove('admin-input-error');
  field.removeAttribute('aria-invalid');
  const error = document.getElementById(`${field.id}-error`);
  if (error) {
    error.textContent = '';
    error.classList.add('hidden');
  }
}

function initForm(): void {
  const form = document.getElementById('login-form') as HTMLFormElement | null;
  if (!form) return;
  const email = document.getElementById('login-email') as HTMLInputElement;
  const password = document.getElementById('login-password') as HTMLInputElement;
  const remember = document.getElementById('login-remember') as HTMLInputElement;
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');

  [email, password].forEach((field) => {
    field.addEventListener('input', () => clearFieldError(field));
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    let valid = true;
    const emailValue = email.value.trim();
    if (!emailValue) {
      setFieldError(email, 'Ingresa tu correo electrónico.');
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
      setFieldError(email, 'El formato del correo no es válido.');
      valid = false;
    }
    if (!password.value.trim()) {
      setFieldError(password, 'Ingresa tu contraseña de demostración.');
      valid = false;
    }
    if (!valid) return;

    try {
      if (submit) setButtonLoading(submit, true, 'Ingresando…');
      loginWithCredentials(emailValue, password.value, remember?.checked ?? true);
      window.setTimeout(() => {
        window.location.href = safeNext();
      }, 350);
    } catch (error) {
      toastError(error);
      setFieldError(email, 'No encontramos una cuenta activa con ese correo.');
      if (submit) setButtonLoading(submit, false);
    }
  });
}

export function initLogin(): void {
  initRedirect();
  initQuickAccess();
  initPasswordToggle();
  initForm();
}
