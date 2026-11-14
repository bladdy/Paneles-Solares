import {
  getConfig,
  getConfigIssues,
  getSession,
  hasPermission,
  loadState,
  resetAllDemoData,
  resetConfig,
  resetDemoData,
  saveConfig,
  updatePreferences,
} from '../../services/store';
import type { AdminPreferences } from '../../types/admin';
import { escapeHtml, formatDate, formatNumber } from '../../utils/format';
import { icon } from './icons';
import { confirmDialog, toast, toastError } from './ui';

function canManage(): boolean {
  const session = getSession();
  return session ? hasPermission(session.roleId, 'configuracion', 'editar') : false;
}

function fillPreferences(prefs: AdminPreferences): void {
  const setValue = (id: string, value: string) => {
    const input = document.getElementById(id) as HTMLInputElement | null;
    if (input) input.value = value;
  };
  setValue('pref-company', prefs.companyName);
  const currency = document.getElementById('pref-currency') as HTMLSelectElement | null;
  if (currency) currency.value = prefs.currency;
  const timezone = document.getElementById('pref-timezone') as HTMLSelectElement | null;
  if (timezone) timezone.value = prefs.timezone;
  const toggles: Array<[string, boolean]> = [
    ['pref-notify-requests', prefs.notifyNewRequests],
    ['pref-notify-quotes', prefs.notifyQuotes],
    ['pref-notify-projects', prefs.notifyProjectUpdates],
    ['pref-weekly-summary', prefs.weeklySummary],
  ];
  toggles.forEach(([id, value]) => {
    const input = document.getElementById(id) as HTMLInputElement | null;
    if (input) input.checked = value;
  });
}

function renderStats(): void {
  const container = document.getElementById('config-stats');
  if (!container) return;
  const state = loadState();
  const config = getConfig();
  const issues = getConfigIssues(config);
  const items = [
    { label: 'Empresa', value: state.preferences.companyName, iconName: 'building' as const },
    { label: 'Usuarios', value: formatNumber(state.users.length), iconName: 'users' as const },
    { label: 'Proyectos', value: formatNumber(state.projects.length), iconName: 'kanban' as const },
    {
      label: 'Configuración del cotizador',
      value: issues.length === 0 ? 'Válida' : `${issues.length} aviso(s)`,
      iconName: 'settings' as const,
      tone: issues.length === 0 ? 'text-success' : 'text-warning',
    },
  ];
  container.innerHTML = items
    .map(
      (item) => `
      <div class="admin-card flex items-center gap-3 p-4">
        <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-light-green text-forest">${icon(item.iconName, 'h-4 w-4')}</span>
        <div class="min-w-0">
          <p class="truncate font-display text-lg font-extrabold text-forest ${item.tone ?? ''}">${escapeHtml(item.value)}</p>
          <p class="text-[11px] font-medium text-muted">${item.label}</p>
        </div>
      </div>
    `,
    )
    .join('');
}

function bindPreferencesForm(): void {
  const form = document.getElementById('preferences-form') as HTMLFormElement | null;
  if (!form) return;
  if (!canManage()) {
    form.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input, select, button[type="submit"]').forEach((field) => {
      field.disabled = true;
    });
  }
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!canManage()) {
      toast('No tienes permiso para cambiar la configuración.', 'warning');
      return;
    }
    const value = (id: string) => (document.getElementById(id) as HTMLInputElement | null)?.value.trim() ?? '';
    const checked = (id: string) => (document.getElementById(id) as HTMLInputElement | null)?.checked ?? false;
    try {
      updatePreferences({
        companyName: value('pref-company') || 'EnerSol',
        currency: value('pref-currency') || 'MXN',
        timezone: value('pref-timezone') || 'America/Mexico_City',
        notifyNewRequests: checked('pref-notify-requests'),
        notifyQuotes: checked('pref-notify-quotes'),
        notifyProjectUpdates: checked('pref-notify-projects'),
        weeklySummary: checked('pref-weekly-summary'),
      });
      toast('Preferencias guardadas.', 'success');
      renderStats();
    } catch (error) {
      toastError(error);
    }
  });
}

function bindResetButtons(): void {
  const buttons: Array<{ id: string; title: string; message: string; run: () => void }> = [
    {
      id: 'reset-state',
      title: 'Restablecer datos operativos',
      message:
        'Se restauran solicitudes, proyectos, usuarios, roles y actividad a los datos de demostración. La configuración del cotizador no cambia.',
      run: () => resetDemoData(),
    },
    {
      id: 'reset-config',
      title: 'Restablecer configuración del cotizador',
      message: 'Se restaura la configuración predeterminada de paneles, inversores, precios y reglas de cálculo.',
      run: () => {
        resetConfig();
        saveConfig(getConfig());
      },
    },
    {
      id: 'reset-all',
      title: 'Restablecer toda la demostración',
      message: 'Se borran todos los cambios locales: datos operativos y configuración del cotizador vuelven a su estado inicial.',
      run: () => resetAllDemoData(),
    },
  ];

  buttons.forEach((item) => {
    document.getElementById(item.id)?.addEventListener('click', async () => {
      if (!canManage()) {
        toast('No tienes permiso para restablecer la demostración.', 'warning');
        return;
      }
      const confirmed = await confirmDialog({
        title: item.title,
        message: item.message,
        confirmLabel: 'Restablecer',
        tone: 'danger',
      });
      if (!confirmed) return;
      try {
        item.run();
        toast('La demostración se restableció correctamente.', 'success');
        renderStats();
        window.setTimeout(() => window.location.reload(), 600);
      } catch (error) {
        toastError(error);
      }
    });
  });
}

function renderIssues(): void {
  const container = document.getElementById('config-issues');
  if (!container) return;
  const issues = getConfigIssues();
  if (issues.length === 0) {
    container.innerHTML = `
      <div class="flex items-start gap-2.5 rounded-xl border border-success/20 bg-success-soft/60 p-3">
        ${icon('checkCircle', 'mt-0.5 h-4 w-4 shrink-0 text-success')}
        <p class="text-xs leading-relaxed text-charcoal/80">
          La configuración del cotizador es válida y está lista para usarse en el sitio público.
        </p>
      </div>
    `;
    return;
  }
  container.innerHTML = `
    <div class="flex items-start gap-2.5 rounded-xl border border-warning/25 bg-warning-soft/60 p-3">
      ${icon('alert', 'mt-0.5 h-4 w-4 shrink-0 text-warning')}
      <div>
        <p class="text-xs font-semibold text-charcoal">Revisa la configuración del cotizador</p>
        <ul class="mt-1.5 space-y-1 text-xs leading-relaxed text-charcoal/75">
          ${issues.map((issue) => `<li>• ${escapeHtml(issue)}</li>`).join('')}
        </ul>
      </div>
    </div>
  `;
}

function renderMeta(): void {
  const container = document.getElementById('config-meta');
  if (!container) return;
  const state = loadState();
  const config = getConfig();
  container.innerHTML = `
    <dl class="space-y-2.5 text-xs">
      <div class="flex justify-between gap-3"><dt class="text-muted">Versión de datos</dt><dd class="font-mono font-semibold text-charcoal">v${state.version}</dd></div>
      <div class="flex justify-between gap-3"><dt class="text-muted">Solicitudes</dt><dd class="font-semibold text-charcoal">${formatNumber(state.solicitudes.length)}</dd></div>
      <div class="flex justify-between gap-3"><dt class="text-muted">Proyectos</dt><dd class="font-semibold text-charcoal">${formatNumber(state.projects.length)}</dd></div>
      <div class="flex justify-between gap-3"><dt class="text-muted">Roles</dt><dd class="font-semibold text-charcoal">${formatNumber(state.roles.length)}</dd></div>
      <div class="flex justify-between gap-3"><dt class="text-muted">Paneles en catálogo</dt><dd class="font-semibold text-charcoal">${formatNumber(config.panels.length)}</dd></div>
      <div class="flex justify-between gap-3"><dt class="text-muted">Inversores en catálogo</dt><dd class="font-semibold text-charcoal">${formatNumber(config.inverters.length)}</dd></div>
      <div class="flex justify-between gap-3"><dt class="text-muted">Baterías en catálogo</dt><dd class="font-semibold text-charcoal">${formatNumber(config.batteries.length)}</dd></div>
      <div class="flex justify-between gap-3"><dt class="text-muted">Moneda</dt><dd class="font-semibold text-charcoal">${escapeHtml(config.general.currency)}</dd></div>
      <div class="flex justify-between gap-3"><dt class="text-muted">Hoy</dt><dd class="font-semibold text-charcoal">${formatDate(new Date())}</dd></div>
    </dl>
    <p class="mt-3 rounded-lg border border-line bg-natural/70 p-2.5 text-[11px] leading-relaxed text-muted">
      Los datos se guardan únicamente en el <strong>localStorage</strong> de este navegador. No existe backend, autenticación real ni envío de correos.
    </p>
  `;
}

export function initSettings(): void {
  const state = loadState();
  fillPreferences(state.preferences);
  renderStats();
  renderIssues();
  renderMeta();
  bindPreferencesForm();
  bindResetButtons();
}
