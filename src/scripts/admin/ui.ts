import { escapeHtml } from '../../utils/format';
import { icon, type IconName } from './icons';
import type { User } from '../../types/admin';

type ToastType = 'success' | 'error' | 'info' | 'warning';

const TOAST_STYLES: Record<ToastType, { icon: IconName; classes: string; iconClasses: string }> = {
  success: {
    icon: 'checkCircle',
    classes: 'border-success/25',
    iconClasses: 'text-success',
  },
  error: {
    icon: 'xCircle',
    classes: 'border-danger/25',
    iconClasses: 'text-danger',
  },
  warning: {
    icon: 'alert',
    classes: 'border-warning/25',
    iconClasses: 'text-warning',
  },
  info: {
    icon: 'info',
    classes: 'border-info/25',
    iconClasses: 'text-info',
  },
};

let toastRoot: HTMLElement | null = null;

const TOAST_ROOT_CLASS =
  'pointer-events-none fixed bottom-4 right-4 z-[120] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2';

function getToastRoot(): HTMLElement {
  if (toastRoot?.isConnected) return toastRoot;
  toastRoot = document.getElementById('toast-root');
  if (!toastRoot) {
    toastRoot = document.createElement('div');
    toastRoot.id = 'toast-root';
    document.body.appendChild(toastRoot);
  }
  toastRoot.className = TOAST_ROOT_CLASS;
  return toastRoot;
}

export function toast(message: string, type: ToastType = 'success', title?: string): void {
  const root = getToastRoot();
  const style = TOAST_STYLES[type];
  const element = document.createElement('div');
  element.className = `admin-toast ${style.classes}`;
  element.setAttribute('role', type === 'error' ? 'alert' : 'status');
  element.innerHTML = `
    <span class="mt-0.5 ${style.iconClasses}">${icon(style.icon, 'h-5 w-5')}</span>
    <div class="min-w-0 flex-1">
      ${title ? `<p class="text-sm font-semibold text-charcoal">${escapeHtml(title)}</p>` : ''}
      <p class="text-sm leading-snug text-charcoal/80">${escapeHtml(message)}</p>
    </div>
    <button type="button" class="admin-icon-btn -mr-1 -mt-1 h-7 w-7" aria-label="Cerrar notificación" data-toast-close>
      ${icon('x', 'h-4 w-4')}
    </button>
  `;
  root.appendChild(element);
  const remove = () => {
    element.style.opacity = '0';
    element.style.transform = 'translateY(8px)';
    element.style.transition = 'opacity 150ms, transform 150ms';
    window.setTimeout(() => element.remove(), 160);
  };
  element.querySelector('[data-toast-close]')?.addEventListener('click', remove);
  window.setTimeout(remove, 5200);
}

export function toastError(error: unknown): void {
  const message = error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
  toast(message, 'error', 'No se pudo completar la operación');
}

export function spinnerHtml(className = 'h-4 w-4'): string {
  return `<svg class="${className} animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-opacity="0.25" stroke-width="3"></circle><path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="3" stroke-linecap="round"></path></svg>`;
}

export function setButtonLoading(button: HTMLButtonElement, loading: boolean, label?: string): void {
  if (loading) {
    button.dataset.originalHtml = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `${spinnerHtml()} <span>${escapeHtml(label ?? 'Procesando…')}</span>`;
  } else {
    button.disabled = false;
    if (button.dataset.originalHtml) {
      button.innerHTML = button.dataset.originalHtml;
      delete button.dataset.originalHtml;
    }
  }
}

export function avatarLetter(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function avatarHtml(
  name: string,
  color = '#123B2A',
  size: 'sm' | 'md' | 'lg' = 'md',
): string {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  const sizes = {
    sm: 'h-8 w-8 text-[11px]',
    md: 'h-9 w-9 text-xs',
    lg: 'h-11 w-11 text-sm',
  };
  return `<span class="admin-avatar ${sizes[size]}" style="background-color:${escapeHtml(color)}" title="${escapeHtml(name)}" aria-label="${escapeHtml(name)}">${escapeHtml(initials)}</span>`;
}

export function userAvatar(user: User | undefined, size: 'sm' | 'md' | 'lg' = 'md'): string {
  if (!user) {
    return `<span class="admin-avatar ${size === 'sm' ? 'h-8 w-8 text-[11px]' : size === 'lg' ? 'h-11 w-11 text-sm' : 'h-9 w-9 text-xs'} bg-slate-400" aria-label="Sin asignar">?</span>`;
  }
  return avatarHtml(`${user.firstName} ${user.lastName}`, user.avatarColor, size);
}

/* ------------------------------------------------------------------ */
/* Overlays                                                            */
/* ------------------------------------------------------------------ */

interface OverlayOptions {
  title: string;
  subtitle?: string;
  content: string;
  footer?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  onClose?: () => void;
}

interface OverlayHandle {
  panel: HTMLElement;
  close: () => void;
}

let bodyLockCount = 0;

function lockBody(): void {
  bodyLockCount += 1;
  document.body.style.overflow = 'hidden';
}

function unlockBody(): void {
  bodyLockCount = Math.max(0, bodyLockCount - 1);
  if (bodyLockCount === 0) document.body.style.overflow = '';
}

function overlayRoot(): HTMLElement {
  return document.getElementById('overlay-root') ?? document.body;
}

function focusables(panel: HTMLElement): HTMLElement[] {
  return Array.from(
    panel.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => element.offsetParent !== null);
}

function activateOverlay(
  backdrop: HTMLElement,
  panel: HTMLElement,
  userOnClose?: () => void,
): OverlayHandle {
  lockBody();
  const previousFocus = document.activeElement as HTMLElement | null;
  let closed = false;

  const close = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', keyHandler, true);
    backdrop.remove();
    panel.remove();
    unlockBody();
    previousFocus?.focus();
    userOnClose?.();
  };

  const keyHandler = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    const items = focusables(panel);
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  document.addEventListener('keydown', keyHandler, true);
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) close();
  });
  panel.querySelectorAll<HTMLElement>('[data-overlay-close]').forEach((button) => {
    button.addEventListener('click', close);
  });
  window.setTimeout(() => {
    const items = focusables(panel);
    (items[0] ?? panel).focus();
  }, 20);

  return { panel, close };
}

export function openModal(options: OverlayOptions): OverlayHandle {
  const backdrop = document.createElement('div');
  backdrop.className = 'admin-backdrop';
  const titleId = `overlay-title-${Date.now()}`;
  const panel = document.createElement('div');
  panel.className = 'admin-modal-panel';
  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };
  panel.classList.add(sizes[options.size ?? 'md']);
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', titleId);
  panel.tabIndex = -1;
  panel.innerHTML = `
    <div class="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
      <div class="min-w-0">
        <h2 id="${titleId}" class="font-display text-lg font-bold text-forest">${escapeHtml(options.title)}</h2>
        ${options.subtitle ? `<p class="mt-0.5 text-sm text-muted">${escapeHtml(options.subtitle)}</p>` : ''}
      </div>
      <button type="button" class="admin-icon-btn -mr-1.5 -mt-1" aria-label="Cerrar" data-overlay-close>
        ${icon('x', 'h-5 w-5')}
      </button>
    </div>
    <div class="px-5 py-5">${options.content}</div>
    ${options.footer ? `<div class="border-t border-line bg-natural/50 px-5 py-4">${options.footer}</div>` : ''}
  `;
  const root = overlayRoot();
  root.appendChild(backdrop);
  root.appendChild(panel);
  return activateOverlay(backdrop, panel, options.onClose);
}

export function openDrawer(
  options: OverlayOptions & { side?: 'right' | 'left' },
): OverlayHandle {
  const backdrop = document.createElement('div');
  backdrop.className = 'admin-backdrop';
  const titleId = `drawer-title-${Date.now()}`;
  const panel = document.createElement('div');
  panel.className = 'admin-drawer-panel';
  if (options.size === 'lg' || options.size === 'xl') panel.classList.add('max-w-xl');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', titleId);
  panel.tabIndex = -1;
  panel.innerHTML = `
    <div class="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
      <div class="min-w-0">
        <h2 id="${titleId}" class="font-display text-lg font-bold text-forest">${escapeHtml(options.title)}</h2>
        ${options.subtitle ? `<p class="mt-0.5 text-sm text-muted">${escapeHtml(options.subtitle)}</p>` : ''}
      </div>
      <button type="button" class="admin-icon-btn -mr-1.5 -mt-1" aria-label="Cerrar" data-overlay-close>
        ${icon('x', 'h-5 w-5')}
      </button>
    </div>
    <div class="admin-scroll flex-1 overflow-y-auto px-5 py-5">${options.content}</div>
    ${options.footer ? `<div class="border-t border-line bg-natural/50 px-5 py-4">${options.footer}</div>` : ''}
  `;
  const root = overlayRoot();
  root.appendChild(backdrop);
  root.appendChild(panel);
  return activateOverlay(backdrop, panel, options.onClose);
}

export async function confirmDialog(options: {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'primary' | 'danger' | 'success';
}): Promise<boolean> {
  const toneClass =
    options.tone === 'danger'
      ? 'admin-btn-danger'
      : options.tone === 'success'
        ? 'admin-btn-success'
        : 'admin-btn-primary';

  return new Promise((resolve) => {
    let settled = false;
    const modal = openModal({
      title: options.title,
      content: `<p class="text-sm leading-relaxed text-charcoal/80">${escapeHtml(options.message)}</p>`,
      footer: `
        <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" class="admin-btn admin-btn-secondary" data-confirm-cancel>${escapeHtml(options.cancelLabel ?? 'Cancelar')}</button>
          <button type="button" class="admin-btn ${toneClass}" data-confirm-ok>${escapeHtml(options.confirmLabel ?? 'Confirmar')}</button>
        </div>
      `,
      size: 'sm',
      onClose: () => {
        if (!settled) {
          settled = true;
          resolve(false);
        }
      },
    });
    modal.panel.querySelector('[data-confirm-ok]')?.addEventListener('click', () => {
      settled = true;
      modal.close();
      resolve(true);
    });
    modal.panel.querySelector('[data-confirm-cancel]')?.addEventListener('click', () => {
      modal.close();
    });
  });
}

/* ------------------------------------------------------------------ */
/* Varios                                                              */
/* ------------------------------------------------------------------ */

export function downloadText(filename: string, content: string, mime = 'text/csv;charset=utf-8;'): void {
  const blob = new Blob([`\uFEFF${content}`], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function emptyStateHtml(options: {
  iconName: IconName;
  title: string;
  description: string;
  action?: string;
}): string {
  return `
    <div class="admin-empty">
      <span class="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-light-green text-forest">${icon(options.iconName, 'h-6 w-6')}</span>
      <h3 class="font-display text-base font-bold text-forest">${escapeHtml(options.title)}</h3>
      <p class="mt-1 max-w-sm text-sm text-muted">${escapeHtml(options.description)}</p>
      ${options.action ? `<div class="mt-5">${options.action}</div>` : ''}
    </div>
  `;
}
