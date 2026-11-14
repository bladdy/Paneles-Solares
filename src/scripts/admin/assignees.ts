import type { User } from '../../types/admin';
import { loadState } from '../../services/store';
import { escapeHtml } from '../../utils/format';
import { icon } from './icons';

function usersFor(ids: string[]): User[] {
  const state = loadState();
  return ids
    .map((id) => state.users.find((user) => user.id === id))
    .filter((user): user is User => Boolean(user));
}

function fullName(user: User): string {
  return `${user.firstName} ${user.lastName}`.trim();
}

function initials(user: User): string {
  return `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase();
}

export function assigneeNames(ids: string[]): string {
  const users = usersFor(ids);
  return users.length ? users.map(fullName).join(', ') : 'Sin asignar';
}

export function avatarStackHtml(ids: string[], max = 3, size: 'xs' | 'sm' | 'md' = 'sm'): string {
  const users = usersFor(ids);
  if (users.length === 0) {
    return `<span class="text-xs italic text-muted">Sin asignar</span>`;
  }
  const visible = users.slice(0, max);
  const rest = users.length - visible.length;
  const sizeClass =
    size === 'xs' ? 'h-6 w-6 text-[9px]' : size === 'md' ? 'h-9 w-9 text-xs' : 'h-8 w-8 text-[11px]';
  return `
    <span class="admin-avatar-stack" title="${escapeHtml(users.map(fullName).join(', '))}">
      ${visible
        .map(
          (user) => `
            <span
              class="admin-avatar ${sizeClass} ring-2 ring-white"
              style="background-color:${escapeHtml(user.avatarColor)}"
              aria-label="${escapeHtml(fullName(user))}"
            >${escapeHtml(initials(user))}</span>
          `,
        )
        .join('')}
      ${rest > 0 ? `<span class="admin-avatar ${sizeClass} bg-charcoal/80 text-white ring-2 ring-white" aria-label="${rest} responsables más">+${rest}</span>` : ''}
    </span>
  `;
}

/** Pila de avatares con desplegable para consultar la lista completa. */
export function assigneeDetailsHtml(ids: string[]): string {
  const users = usersFor(ids);
  if (users.length === 0) {
    return `<span class="text-xs italic text-muted">Sin asignar</span>`;
  }
  return `
    <details class="assignee-details relative">
      <summary class="flex cursor-pointer list-none items-center gap-2" aria-label="Ver responsables">
        ${avatarStackHtml(ids, 3, 'sm')}
        <span class="text-muted/70">${icon('chevronDown', 'h-3.5 w-3.5')}</span>
      </summary>
      <div class="absolute left-0 top-full z-30 mt-2 w-64 rounded-xl border border-line bg-white p-2 shadow-xl">
        <p class="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted">
          ${users.length} responsable${users.length === 1 ? '' : 's'}
        </p>
        ${users
          .map(
            (user) => `
              <div class="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-natural">
                <span class="admin-avatar h-7 w-7 text-[10px]" style="background-color:${escapeHtml(user.avatarColor)}">${escapeHtml(initials(user))}</span>
                <div class="min-w-0">
                  <p class="truncate text-xs font-semibold text-charcoal">${escapeHtml(fullName(user))}</p>
                  <p class="truncate text-[10px] text-muted">${escapeHtml(user.jobTitle)}</p>
                </div>
              </div>
            `,
          )
          .join('')}
      </div>
    </details>
  `;
}

export function assigneeSelectorHtml(
  selectedIds: string[],
  options: { placeholder?: string; compact?: boolean } = {},
): string {
  return `
    <div class="assignee-selector" data-assignee-selector>
      <div class="mb-2 flex flex-wrap gap-1.5" data-assignee-chips></div>
      <div class="relative">
        <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
          ${icon('search', 'h-4 w-4')}
        </span>
        <input
          type="search"
          class="admin-input pl-9"
          data-assignee-search
          placeholder="${escapeHtml(options.placeholder ?? 'Buscar por nombre o cargo…')}"
          aria-label="Buscar responsables"
        />
      </div>
      <div class="mt-2 max-h-48 overflow-y-auto rounded-xl border border-line bg-white admin-scroll ${options.compact ? '' : ''}" data-assignee-options></div>
      <p class="mt-1.5 text-[11px] text-muted" data-assignee-hint>Sin responsables seleccionados.</p>
      <input type="hidden" data-assignee-value value="${escapeHtml(selectedIds.join(','))}" />
    </div>
  `;
}

export interface AssigneeSelectorHandle {
  getSelected(): string[];
  setSelected(ids: string[]): void;
}

export function bindAssigneeSelector(
  root: HTMLElement,
  initialIds: string[],
  onChange?: (ids: string[]) => void,
): AssigneeSelectorHandle {
  const state = loadState();
  const users = state.users.filter((user) => user.status === 'activo');
  let selected = initialIds.filter((id) => users.some((user) => user.id === id));
  let search = '';

  const chips = root.querySelector<HTMLElement>('[data-assignee-chips]');
  const optionsBox = root.querySelector<HTMLElement>('[data-assignee-options]');
  const searchInput = root.querySelector<HTMLInputElement>('[data-assignee-search]');
  const hint = root.querySelector<HTMLElement>('[data-assignee-hint]');
  const hidden = root.querySelector<HTMLInputElement>('[data-assignee-value]');

  const notify = () => {
    if (hidden) hidden.value = selected.join(',');
    onChange?.([...selected]);
  };

  function renderChips(): void {
    if (!chips) return;
    chips.innerHTML = selected.length
      ? selected
          .map((id) => users.find((user) => user.id === id))
          .filter((user): user is User => Boolean(user))
          .map(
            (user) => `
              <span class="inline-flex max-w-full items-center gap-1.5 rounded-full border border-line bg-natural py-0.5 pl-0.5 pr-1.5">
                <span class="admin-avatar h-6 w-6 text-[9px]" style="background-color:${escapeHtml(user.avatarColor)}">${escapeHtml(initials(user))}</span>
                <span class="truncate text-xs font-medium text-charcoal">${escapeHtml(fullName(user))}</span>
                <button type="button" class="admin-icon-btn h-5 w-5 rounded-full hover:bg-danger-soft hover:text-danger" data-assignee-remove="${user.id}" aria-label="Quitar a ${escapeHtml(fullName(user))}">
                  ${icon('x', 'h-3 w-3')}
                </button>
              </span>
            `,
          )
          .join('')
      : '<span class="text-xs italic text-muted">Sin responsables seleccionados.</span>';
    if (hint) {
      hint.textContent =
        selected.length === 0
          ? 'Sin responsables seleccionados.'
          : `${selected.length} responsable${selected.length === 1 ? '' : 's'} seleccionado${selected.length === 1 ? '' : 's'}.`;
    }
  }

  function renderOptions(): void {
    if (!optionsBox) return;
    const term = search.trim().toLowerCase();
    const filtered = users.filter((user) => {
      const haystack = `${fullName(user)} ${user.jobTitle} ${user.email}`.toLowerCase();
      return !term || haystack.includes(term);
    });
    optionsBox.innerHTML = filtered.length
      ? filtered
          .map((user) => {
            const isSelected = selected.includes(user.id);
            return `
              <button
                type="button"
                class="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-natural ${isSelected ? 'bg-light-green/40' : ''}"
                data-assignee-option="${user.id}"
                aria-pressed="${isSelected}"
              >
                <span class="admin-avatar h-8 w-8 text-[10px]" style="background-color:${escapeHtml(user.avatarColor)}">${escapeHtml(initials(user))}</span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-semibold text-charcoal">${escapeHtml(fullName(user))}</span>
                  <span class="block truncate text-[11px] text-muted">${escapeHtml(user.jobTitle)}</span>
                </span>
                <span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${isSelected ? 'border-forest bg-forest text-white' : 'border-line text-transparent'}">
                  ${icon('check', 'h-3 w-3')}
                </span>
              </button>
            `;
          })
          .join('')
      : '<p class="px-3 py-4 text-center text-xs text-muted">No se encontraron usuarios.</p>';
  }

  function render(): void {
    renderChips();
    renderOptions();
  }

  chips?.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLElement>('[data-assignee-remove]');
    if (!button) return;
    const id = button.dataset.assigneeRemove ?? '';
    selected = selected.filter((item) => item !== id);
    render();
    notify();
  });

  optionsBox?.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLElement>('[data-assignee-option]');
    if (!button) return;
    const id = button.dataset.assigneeOption ?? '';
    selected = selected.includes(id)
      ? selected.filter((item) => item !== id)
      : [...selected, id];
    render();
    notify();
  });

  searchInput?.addEventListener('input', () => {
    search = searchInput.value;
    renderOptions();
  });

  render();

  return {
    getSelected: () => [...selected],
    setSelected: (ids: string[]) => {
      selected = ids.filter((id) => users.some((user) => user.id === id));
      render();
      notify();
    },
  };
}
