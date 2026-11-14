import {
  getConfig,
  getConfigIssues,
  saveConfig,
} from '../../services/store';
import { createDefaultConfig, PROJECT_TYPE_OPTIONS } from '../../data/cotizador-defaults';
import {
  calculateSolarEstimate,
  SolarCalculationError,
} from '../../utils/solar-calculator';
import type {
  Battery,
  BatteryType,
  Inverter,
  InverterType,
  ProjectType,
  SolarConfig,
  SolarPanel,
  SystemType,
} from '../../types/solar';
import {
  escapeHtml,
  formatCurrency,
  formatDecimal,
  formatNumber,
  formatPercent,
} from '../../utils/format';
import { SYSTEM_TYPE_LABEL } from '../../utils/status';
import { icon } from './icons';
import {
  confirmDialog,
  emptyStateHtml,
  openModal,
  toast,
  toastError,
} from './ui';

type TabKey = 'general' | 'paneles' | 'inversores' | 'baterias' | 'instalacion' | 'precios' | 'tipos';
type CatalogKind = 'panels' | 'inverters' | 'batteries';

interface TabDef {
  key: TabKey;
  label: string;
  iconName: 'settings' | 'sun' | 'zap' | 'battery' | 'wrench' | 'dollar' | 'target';
}

const TABS: TabDef[] = [
  { key: 'general', label: 'General', iconName: 'settings' },
  { key: 'paneles', label: 'Paneles', iconName: 'sun' },
  { key: 'inversores', label: 'Inversores', iconName: 'zap' },
  { key: 'baterias', label: 'Baterías', iconName: 'battery' },
  { key: 'instalacion', label: 'Instalación', iconName: 'wrench' },
  { key: 'precios', label: 'Precios', iconName: 'dollar' },
  { key: 'tipos', label: 'Tipos de proyecto', iconName: 'target' },
];

const INVERTER_TYPES: Array<{ value: InverterType; label: string }> = [
  { value: 'string', label: 'String' },
  { value: 'micro', label: 'Microinversor' },
  { value: 'hibrido', label: 'Híbrido' },
];

const BATTERY_TYPES: Array<{ value: BatteryType; label: string }> = [
  { value: 'litio', label: 'Litio' },
  { value: 'gel', label: 'Gel' },
  { value: 'agm', label: 'AGM' },
];

const CURRENCIES = ['MXN', 'USD', 'EUR'];

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

let draft: SolarConfig = clone(getConfig());
let saved = JSON.stringify(draft);
let activeTab: TabKey = 'general';

const preview = {
  projectType: 'residencial' as ProjectType,
  systemType: 'interconectado' as SystemType,
  monthlyConsumptionKwh: 450,
  tariff: 0,
};

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */

function dirty(): boolean {
  return JSON.stringify(draft) !== saved;
}

function catalogItems(kind: CatalogKind): Array<SolarPanel | Inverter | Battery> {
  if (kind === 'panels') return draft.panels;
  if (kind === 'inverters') return draft.inverters;
  return draft.batteries;
}

function setCatalogProp(kind: CatalogKind, id: string, prop: string, value: unknown): void {
  const items = catalogItems(kind) as unknown as Array<Record<string, unknown>>;
  const item = items.find((entry) => entry.id === id);
  if (!item) return;
  item[prop] = value;
}

function catalogTitle(kind: CatalogKind, item: SolarPanel | Inverter | Battery): string {
  const label = `${item.brand} ${item.model}`.trim();
  if (!label) return 'Nuevo equipo';
  if (kind === 'panels') return `${label} · ${(item as SolarPanel).watt} W`;
  if (kind === 'inverters') return `${label} · ${(item as Inverter).capacityKw} kW`;
  return `${label} · ${(item as Battery).capacityKwh} kWh`;
}

function newId(kind: CatalogKind): string {
  const prefix = kind === 'panels' ? 'pnl' : kind === 'inverters' ? 'inv' : 'bat';
  return `${prefix}-${Date.now().toString(36)}`;
}

/* ------------------------------------------------------------------ */
/* Formularios genéricos                                               */
/* ------------------------------------------------------------------ */

function numberField(options: {
  path: string;
  label: string;
  value: number;
  step?: string;
  min?: string;
  max?: string;
  suffix?: string;
  help?: string;
}): string {
  return `
    <div>
      <label class="admin-label" for="field-${options.path.replace(/\./g, '-')}">${escapeHtml(options.label)}</label>
      <div class="relative">
        <input
          id="field-${options.path.replace(/\./g, '-')}"
          type="number"
          class="admin-input ${options.suffix ? 'pr-12' : ''}"
          data-config="${options.path}"
          value="${escapeHtml(String(options.value))}"
          step="${options.step ?? '1'}"
          ${options.min !== undefined ? `min="${options.min}"` : ''}
          ${options.max !== undefined ? `max="${options.max}"` : ''}
        />
        ${options.suffix ? `<span class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted">${escapeHtml(options.suffix)}</span>` : ''}
      </div>
      ${options.help ? `<p class="admin-help">${escapeHtml(options.help)}</p>` : ''}
    </div>
  `;
}

function selectField(options: {
  path: string;
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  help?: string;
}): string {
  return `
    <div>
      <label class="admin-label" for="field-${options.path.replace(/\./g, '-')}">${escapeHtml(options.label)}</label>
      <select id="field-${options.path.replace(/\./g, '-')}" class="admin-select" data-config="${options.path}">
        ${options.options
          .map(
            (option) =>
              `<option value="${escapeHtml(option.value)}" ${option.value === options.value ? 'selected' : ''}>${escapeHtml(
                option.label,
              )}</option>`,
          )
          .join('')}
      </select>
      ${options.help ? `<p class="admin-help">${escapeHtml(options.help)}</p>` : ''}
    </div>
  `;
}

function checkboxField(options: {
  path: string;
  label: string;
  checked: boolean;
  help?: string;
}): string {
  return `
    <label class="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-natural/40 p-3.5 transition-colors hover:border-forest/25 hover:bg-light-green/30">
      <input type="checkbox" class="admin-checkbox mt-0.5" data-config="${options.path}" ${options.checked ? 'checked' : ''} />
      <span>
        <span class="block text-sm font-semibold text-charcoal">${escapeHtml(options.label)}</span>
        ${options.help ? `<span class="mt-0.5 block text-xs leading-relaxed text-muted">${escapeHtml(options.help)}</span>` : ''}
      </span>
    </label>
  `;
}

/* ------------------------------------------------------------------ */
/* Pestañas                                                            */
/* ------------------------------------------------------------------ */

function generalTab(): string {
  const g = draft.general;
  return `
    <div class="space-y-5">
      <p class="rounded-xl border border-info/20 bg-info-soft/50 p-3 text-xs leading-relaxed text-charcoal/80">
        Estos parámetros alimentan el cálculo del cotizador público. Los cambios se aplican cuando guardas la configuración.
      </p>
      <div class="grid gap-4 sm:grid-cols-2">
        ${numberField({ path: 'general.peakSunHours', label: 'Horas solares pico', value: g.peakSunHours, step: '0.1', min: '0', max: '10', suffix: 'h/día', help: 'Promedio diario de irradiancia efectiva.' })}
        ${numberField({ path: 'general.performanceRatio', label: 'Factor de rendimiento', value: g.performanceRatio, step: '0.01', min: '0.01', max: '1', help: 'Entre 0.01 y 1. Considera pérdidas por temperatura y cableado.' })}
        ${numberField({ path: 'general.coverageTarget', label: 'Cobertura objetivo', value: g.coverageTarget, step: '1', min: '1', max: '150', suffix: '%', help: 'Porcentaje del consumo que debe cubrir el sistema.' })}
        ${numberField({ path: 'general.safetyMargin', label: 'Margen de seguridad', value: g.safetyMargin, step: '1', min: '0', max: '100', suffix: '%', help: 'Sobredimensiona el sistema ante variaciones de consumo.' })}
        ${numberField({ path: 'general.defaultTariff', label: 'Tarifa de referencia', value: g.defaultTariff, step: '0.01', min: '0', suffix: '/kWh', help: 'Se usa cuando el cliente no indica su tarifa.' })}
        ${numberField({ path: 'general.taxPercent', label: 'Impuesto general', value: g.taxPercent, step: '0.1', min: '0', max: '100', suffix: '%' })}
        ${selectField({
          path: 'general.currency',
          label: 'Moneda de cotización',
          value: g.currency,
          options: CURRENCIES.map((currency) => ({ value: currency, label: currency })),
          help: 'Solo cambia la presentación; los precios del catálogo se interpretan en esta moneda.',
        })}
      </div>
    </div>
  `;
}

interface CatalogField {
  prop: string;
  label: string;
  type: 'text' | 'number' | 'select';
  step?: string;
  min?: string;
  suffix?: string;
  options?: Array<{ value: string; label: string }>;
}

const CATALOG_FIELDS: Record<CatalogKind, CatalogField[]> = {
  panels: [
    { prop: 'brand', label: 'Marca', type: 'text' },
    { prop: 'model', label: 'Modelo', type: 'text' },
    { prop: 'watt', label: 'Potencia', type: 'number', step: '1', min: '1', suffix: 'W' },
    { prop: 'price', label: 'Precio unitario', type: 'number', step: '1', min: '0', suffix: 'MXN' },
    { prop: 'efficiency', label: 'Eficiencia', type: 'number', step: '0.1', min: '0', suffix: '%' },
  ],
  inverters: [
    { prop: 'brand', label: 'Marca', type: 'text' },
    { prop: 'model', label: 'Modelo', type: 'text' },
    { prop: 'capacityKw', label: 'Capacidad', type: 'number', step: '0.1', min: '0.1', suffix: 'kW' },
    { prop: 'price', label: 'Precio unitario', type: 'number', step: '1', min: '0', suffix: 'MXN' },
    { prop: 'type', label: 'Tipo', type: 'select', options: INVERTER_TYPES },
  ],
  batteries: [
    { prop: 'brand', label: 'Marca', type: 'text' },
    { prop: 'model', label: 'Modelo', type: 'text' },
    { prop: 'capacityKwh', label: 'Capacidad', type: 'number', step: '0.01', min: '0.01', suffix: 'kWh' },
    { prop: 'price', label: 'Precio unitario', type: 'number', step: '1', min: '0', suffix: 'MXN' },
    { prop: 'type', label: 'Tipo', type: 'select', options: BATTERY_TYPES },
  ],
};

const CATALOG_META: Record<CatalogKind, { title: string; description: string; empty: string; iconName: 'sun' | 'zap' | 'battery' }> = {
  panels: {
    title: 'Catálogo de paneles',
    description: 'Solo los paneles activos participan en el cálculo. El cotizador prioriza el panel preferido de cada tipo de proyecto.',
    empty: 'Agrega al menos un panel activo para poder cotizar.',
    iconName: 'sun',
  },
  inverters: {
    title: 'Catálogo de inversores',
    description: 'El sistema elige el inversor activo con capacidad suficiente para el 115% de la potencia instalada.',
    empty: 'Agrega al menos un inversor activo para poder cotizar.',
    iconName: 'zap',
  },
  batteries: {
    title: 'Catálogo de baterías',
    description: 'Solo se usan en sistemas con baterías o híbridos. Se selecciona la batería activa de mayor capacidad.',
    empty: 'Agrega baterías si ofreces sistemas con respaldo.',
    iconName: 'battery',
  },
};

function priceUnit(): string {
  return draft.general.currency;
}

function catalogTab(kind: CatalogKind): string {
  const meta = CATALOG_META[kind];
  const fields = CATALOG_FIELDS[kind];
  const items = catalogItems(kind);
  const activeCount = items.filter((item) => item.active).length;

  return `
    <div class="space-y-4">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 class="admin-section-title">${meta.title}</h2>
          <p class="admin-section-subtitle max-w-2xl">${meta.description}</p>
        </div>
        <button type="button" class="admin-btn admin-btn-primary admin-btn-sm shrink-0" data-add-item="${kind}">
          ${icon('plus', 'h-4 w-4')} Agregar
        </button>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <span class="admin-badge border-line bg-natural text-charcoal">${items.length} registrado${items.length === 1 ? '' : 's'}</span>
        <span class="admin-badge border-success/20 bg-success-soft text-success">${activeCount} activo${activeCount === 1 ? '' : 's'}</span>
        ${items.length > activeCount ? `<span class="admin-badge border-line bg-white text-muted">${items.length - activeCount} inactivo${items.length - activeCount === 1 ? '' : 's'}</span>` : ''}
      </div>

      ${
        items.length === 0
          ? emptyStateHtml({
              iconName: meta.iconName,
              title: 'Catálogo vacío',
              description: meta.empty,
              action: `<button type="button" class="admin-btn admin-btn-primary admin-btn-sm" data-add-item="${kind}">Agregar el primero</button>`,
            })
          : `<div class="grid gap-3 lg:grid-cols-2">
              ${items
                .map((item) => {
                  const record = item as unknown as Record<string, unknown>;
                  return `
                    <article class="rounded-xl border p-4 transition-colors ${
                      item.active ? 'border-line bg-white' : 'border-dashed border-line bg-natural/40'
                    }">
                      <div class="flex items-start justify-between gap-2">
                        <div class="min-w-0">
                          <p class="truncate text-sm font-semibold text-charcoal" data-card-title="${kind}-${item.id}">${escapeHtml(
                            catalogTitle(kind, item),
                          )}</p>
                          <p class="mt-0.5 font-mono text-[10px] text-muted">${escapeHtml(item.id)}</p>
                        </div>
                        <label class="flex shrink-0 cursor-pointer items-center gap-1.5 text-[11px] font-medium text-muted">
                          <input type="checkbox" class="admin-checkbox" data-catalog="${kind}" data-id="${item.id}" data-prop="active" ${item.active ? 'checked' : ''} />
                          Activo
                        </label>
                      </div>
                      <div class="mt-3 grid gap-2.5 sm:grid-cols-2">
                        ${fields
                          .map((field) => {
                            const value = record[field.prop];
                            const inputId = `${kind}-${item.id}-${field.prop}`;
                            if (field.type === 'select') {
                              return `
                                <div class="${field.prop === 'brand' || field.prop === 'model' ? '' : 'sm:col-span-1'}">
                                  <label class="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted" for="${inputId}">${field.label}</label>
                                  <select id="${inputId}" class="admin-select px-2.5 py-1.5 text-xs" data-catalog="${kind}" data-id="${item.id}" data-prop="${field.prop}">
                                    ${(field.options ?? [])
                                      .map(
                                        (option) =>
                                          `<option value="${option.value}" ${option.value === value ? 'selected' : ''}>${option.label}</option>`,
                                      )
                                      .join('')}
                                  </select>
                                </div>
                              `;
                            }
                            return `
                              <div>
                                <label class="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted" for="${inputId}">${field.label}</label>
                                <div class="relative">
                                  <input
                                    id="${inputId}"
                                    type="${field.type}"
                                    class="admin-input px-2.5 py-1.5 text-xs ${field.suffix ? 'pr-12' : ''}"
                                    data-catalog="${kind}"
                                    data-id="${item.id}"
                                    data-prop="${field.prop}"
                                    value="${escapeHtml(String(value ?? ''))}"
                                    ${field.step ? `step="${field.step}"` : ''}
                                    ${field.min !== undefined ? `min="${field.min}"` : ''}
                                  />
                                  ${field.suffix ? `<span class="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted">${field.suffix}</span>` : ''}
                                </div>
                              </div>
                            `;
                          })
                          .join('')}
                      </div>
                      <div class="mt-3 flex items-center justify-between gap-2 border-t border-line/70 pt-2.5">
                        <span class="text-[11px] text-muted">
                          ${
                            kind === 'panels'
                              ? `${formatNumber(Number(record.watt) || 0)} W · ${formatCurrency(Number(record.price) || 0, priceUnit())}`
                              : kind === 'inverters'
                                ? `${formatDecimal(Number(record.capacityKw) || 0, 1)} kW · ${formatCurrency(Number(record.price) || 0, priceUnit())}`
                                : `${formatDecimal(Number(record.capacityKwh) || 0, 2)} kWh · ${formatCurrency(Number(record.price) || 0, priceUnit())}`
                          }
                        </span>
                        <div class="flex items-center gap-1.5">
                          <button type="button" class="admin-btn admin-btn-secondary admin-btn-sm" data-edit-item="${kind}" data-id="${item.id}">
                            ${icon('pencil', 'h-3.5 w-3.5')} Editar
                          </button>
                          <button type="button" class="admin-icon-btn h-8 w-8 text-danger hover:bg-danger-soft" data-delete-item="${kind}" data-id="${item.id}" aria-label="Eliminar ${escapeHtml(catalogTitle(kind, item))}">
                            ${icon('trash', 'h-3.5 w-3.5')}
                          </button>
                        </div>
                      </div>
                    </article>
                  `;
                })
                .join('')}
            </div>`
      }
    </div>
  `;
}

function installationTab(): string {
  const c = draft.installation;
  return `
    <div class="space-y-5">
      <p class="rounded-xl border border-line bg-natural/50 p-3 text-xs leading-relaxed text-muted">
        Costos aplicados cuando el modo de precio es <strong>costo desglosado</strong>. Se multiplican por la capacidad instalada (kWp) o se suman una sola vez.
      </p>
      <div>
        <h3 class="mb-3 flex items-center gap-2 text-sm font-semibold text-charcoal">${icon('wrench', 'h-4 w-4 text-forest')} Costos por kWp instalado</h3>
        <div class="grid gap-4 sm:grid-cols-3">
          ${numberField({ path: 'installation.laborPerKwp', label: 'Mano de obra', value: c.laborPerKwp, min: '0', suffix: '/kWp' })}
          ${numberField({ path: 'installation.structurePerKwp', label: 'Estructura', value: c.structurePerKwp, min: '0', suffix: '/kWp' })}
          ${numberField({ path: 'installation.wiringPerKwp', label: 'Cableado', value: c.wiringPerKwp, min: '0', suffix: '/kWp' })}
        </div>
      </div>
      <div class="border-t border-line pt-5">
        <h3 class="mb-3 flex items-center gap-2 text-sm font-semibold text-charcoal">${icon('dollar', 'h-4 w-4 text-forest')} Costos fijos por proyecto</h3>
        <div class="grid gap-4 sm:grid-cols-2">
          ${numberField({ path: 'installation.protections', label: 'Protecciones eléctricas', value: c.protections, min: '0', suffix: priceUnit() })}
          ${numberField({ path: 'installation.installationBase', label: 'Instalación y puesta en marcha', value: c.installationBase, min: '0', suffix: priceUnit() })}
          ${numberField({ path: 'installation.transport', label: 'Transporte y logística', value: c.transport, min: '0', suffix: priceUnit() })}
          ${numberField({ path: 'installation.other', label: 'Otros conceptos', value: c.other, min: '0', suffix: priceUnit() })}
        </div>
      </div>
    </div>
  `;
}

function pricingTab(): string {
  const p = draft.pricing;
  return `
    <div class="space-y-5">
      ${checkboxField({
        path: 'pricing.usePricePerWatt',
        label: 'Usar precio por watt llave en mano',
        checked: p.usePricePerWatt,
        help: 'Sustituye los costos desglosados por un precio único por watt instalado. Las baterías se siguen cobrando aparte.',
      })}
      <div class="grid gap-4 sm:grid-cols-2 ${p.usePricePerWatt ? '' : 'opacity-60'}">
        ${numberField({ path: 'pricing.pricePerWatt', label: 'Precio por watt', value: p.pricePerWatt, step: '0.01', min: '0', suffix: `/${priceUnit()}` })}
        ${numberField({ path: 'pricing.marginPercent', label: 'Margen de utilidad', value: p.marginPercent, step: '0.1', min: '0', max: '300', suffix: '%' })}
        ${numberField({ path: 'pricing.discountPercent', label: 'Descuento comercial', value: p.discountPercent, step: '0.1', min: '0', max: '100', suffix: '%' })}
        ${numberField({ path: 'pricing.taxPercent', label: 'Impuesto aplicado', value: p.taxPercent, step: '0.1', min: '0', max: '100', suffix: '%' })}
      </div>
      <div class="rounded-xl border border-line bg-natural/50 p-4">
        <p class="text-sm font-semibold text-charcoal">Orden del cálculo</p>
        <ol class="mt-2 space-y-1 text-xs leading-relaxed text-muted">
          <li>1. Costo base de equipos e instalación (o precio por watt).</li>
          <li>2. Se suma el margen de utilidad.</li>
          <li>3. Se aplica el descuento comercial al subtotal.</li>
          <li>4. Se agrega el impuesto al total con descuento.</li>
        </ol>
      </div>
    </div>
  `;
}

function projectTypesTab(): string {
  return `
    <div class="space-y-4">
      <p class="text-xs leading-relaxed text-muted">
        Cada tipo de proyecto ajusta cobertura, margen de seguridad, equipo preferido y un multiplicador de precio.
      </p>
      ${PROJECT_TYPE_OPTIONS.map((option) => {
        const rule = draft.projectTypes[option.value];
        return `
          <section class="rounded-xl border border-line p-4">
            <div class="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 class="text-sm font-semibold text-charcoal">${escapeHtml(option.label)}</h3>
                <p class="mt-0.5 text-xs text-muted">${escapeHtml(option.description)}</p>
              </div>
              <span class="admin-badge border-line bg-natural text-charcoal">×${formatDecimal(rule.priceMultiplier, 2)}</span>
            </div>
            <div class="mt-3 grid gap-3 sm:grid-cols-2">
              ${numberField({ path: `projectTypes.${option.value}.coverageTarget`, label: 'Cobertura', value: rule.coverageTarget, step: '1', min: '1', max: '150', suffix: '%' })}
              ${numberField({ path: `projectTypes.${option.value}.safetyMargin`, label: 'Margen de seguridad', value: rule.safetyMargin, step: '1', min: '0', max: '100', suffix: '%' })}
              ${selectField({
                path: `projectTypes.${option.value}.preferredPanelId`,
                label: 'Panel preferido',
                value: rule.preferredPanelId,
                options: [{ value: '', label: 'Automático (mayor eficiencia)' }, ...draft.panels.map((panel) => ({
                  value: panel.id,
                  label: `${panel.brand} ${panel.model} · ${panel.watt} W`,
                }))],
              })}
              ${selectField({
                path: `projectTypes.${option.value}.preferredInverterId`,
                label: 'Inversor preferido',
                value: rule.preferredInverterId,
                options: [{ value: '', label: 'Automático (menor capacidad suficiente)' }, ...draft.inverters.map((inverter) => ({
                  value: inverter.id,
                  label: `${inverter.brand} ${inverter.model} · ${inverter.capacityKw} kW`,
                }))],
              })}
              ${numberField({ path: `projectTypes.${option.value}.priceMultiplier`, label: 'Multiplicador de precio', value: rule.priceMultiplier, step: '0.01', min: '0.01', help: '1 = sin ajuste; 1.10 = +10%.' })}
            </div>
          </section>
        `;
      }).join('')}
    </div>
  `;
}

function renderTab(): string {
  if (activeTab === 'general') return generalTab();
  if (activeTab === 'paneles') return catalogTab('panels');
  if (activeTab === 'inversores') return catalogTab('inverters');
  if (activeTab === 'baterias') return catalogTab('batteries');
  if (activeTab === 'instalacion') return installationTab();
  if (activeTab === 'precios') return pricingTab();
  return projectTypesTab();
}

function renderPanel(): void {
  const container = document.getElementById('cotizador-panel');
  if (!container) return;
  container.innerHTML = renderTab();
}

function renderTabs(): void {
  const container = document.getElementById('cotizador-tabs');
  if (!container) return;
  container.innerHTML = TABS.map(
    (tab) => `
      <button
        type="button"
        class="admin-tab ${tab.key === activeTab ? 'admin-tab-active' : ''}"
        data-tab="${tab.key}"
        aria-pressed="${tab.key === activeTab}"
      >
        ${icon(tab.iconName, 'h-4 w-4')}
        ${tab.label}
      </button>
    `,
  ).join('');
}

/* ------------------------------------------------------------------ */
/* Estado de guardado                                                  */
/* ------------------------------------------------------------------ */

function renderStatus(): void {
  const status = document.getElementById('cotizador-status');
  const save = document.getElementById('cotizador-save') as HTMLButtonElement | null;
  const discard = document.getElementById('cotizador-discard') as HTMLButtonElement | null;
  const isDirty = dirty();
  if (status) {
    status.className = `admin-badge ${isDirty ? 'border-warning/25 bg-warning-soft text-warning' : 'border-success/20 bg-success-soft text-success'}`;
    status.innerHTML = `${icon(isDirty ? 'alert' : 'checkCircle', 'h-3.5 w-3.5')} ${isDirty ? 'Cambios sin guardar' : 'Guardado'}`;
  }
  if (save) save.disabled = !isDirty;
  if (discard) discard.disabled = !isDirty;
}

function renderIssues(): void {
  const container = document.getElementById('cotizador-issues');
  if (!container) return;
  const issues = getConfigIssues(draft);
  if (issues.length === 0) {
    container.innerHTML = `
      <div class="flex items-start gap-2.5 rounded-xl border border-success/20 bg-success-soft/60 p-3">
        ${icon('checkCircle', 'mt-0.5 h-4 w-4 shrink-0 text-success')}
        <p class="text-xs leading-relaxed text-charcoal/80">
          La configuración es válida. Puedes guardarla y el cotizador público la usará de inmediato.
        </p>
      </div>
    `;
    return;
  }
  container.innerHTML = `
    <div class="flex items-start gap-2.5 rounded-xl border border-warning/25 bg-warning-soft/60 p-3">
      ${icon('alert', 'mt-0.5 h-4 w-4 shrink-0 text-warning')}
      <div>
        <p class="text-xs font-semibold text-charcoal">${issues.length} punto${issues.length === 1 ? '' : 's'} por revisar antes de guardar</p>
        <ul class="mt-1.5 space-y-1 text-xs leading-relaxed text-charcoal/75">
          ${issues.map((issue) => `<li>• ${escapeHtml(issue)}</li>`).join('')}
        </ul>
      </div>
    </div>
  `;
}

/* ------------------------------------------------------------------ */
/* Vista previa                                                        */
/* ------------------------------------------------------------------ */

function renderPreviewControls(): void {
  const container = document.getElementById('cotizador-preview');
  if (!container) return;
  container.innerHTML = `
    <div class="admin-card">
      <div class="admin-card-header">
        <div>
          <h2 class="admin-section-title">Vista previa</h2>
          <p class="admin-section-subtitle">Simulación con la configuración en edición.</p>
        </div>
        <span class="admin-badge border-line bg-natural text-muted">${icon('chart', 'h-3.5 w-3.5')} Estimación</span>
      </div>
      <div class="admin-card-body space-y-4">
        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <div>
            <label class="admin-label" for="preview-project">Tipo de proyecto</label>
            <select id="preview-project" class="admin-select" data-preview="projectType">
              ${PROJECT_TYPE_OPTIONS.map(
                (option) =>
                  `<option value="${option.value}" ${option.value === preview.projectType ? 'selected' : ''}>${option.label}</option>`,
              ).join('')}
            </select>
          </div>
          <div>
            <label class="admin-label" for="preview-system">Sistema</label>
            <select id="preview-system" class="admin-select" data-preview="systemType">
              ${(['interconectado', 'baterias', 'hibrido'] as SystemType[])
                .map(
                  (value) =>
                    `<option value="${value}" ${value === preview.systemType ? 'selected' : ''}>${SYSTEM_TYPE_LABEL[value]}</option>`,
                )
                .join('')}
            </select>
          </div>
          <div>
            <label class="admin-label" for="preview-consumption">Consumo mensual</label>
            <div class="relative">
              <input id="preview-consumption" type="number" min="1" step="10" class="admin-input pr-12" data-preview="monthlyConsumptionKwh" value="${preview.monthlyConsumptionKwh}" />
              <span class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">kWh</span>
            </div>
          </div>
          <div>
            <label class="admin-label" for="preview-tariff">Tarifa personalizada</label>
            <div class="relative">
              <input id="preview-tariff" type="number" min="0" step="0.01" class="admin-input pr-16" data-preview="tariff" value="${preview.tariff}" placeholder="Usar tarifa configurada" />
              <span class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">/kWh</span>
            </div>
          </div>
        </div>
        <div id="preview-result" class="border-t border-line pt-4"></div>
      </div>
    </div>
  `;
  renderPreviewResult();
}

function renderPreviewResult(): void {
  const container = document.getElementById('preview-result');
  if (!container) return;

  let estimate;
  try {
    estimate = calculateSolarEstimate(
      {
        projectType: preview.projectType,
        systemType: preview.systemType,
        monthlyConsumptionKwh: preview.monthlyConsumptionKwh,
        tariff: preview.tariff > 0 ? preview.tariff : undefined,
        backupHours: preview.systemType === 'interconectado' ? undefined : 4,
      },
      draft,
    );
  } catch (error) {
    const message =
      error instanceof SolarCalculationError || error instanceof Error
        ? error.message
        : 'No fue posible calcular la estimación.';
    container.innerHTML = `
      <div class="flex items-start gap-2.5 rounded-xl border border-warning/25 bg-warning-soft/60 p-3">
        ${icon('alert', 'mt-0.5 h-4 w-4 shrink-0 text-warning')}
        <p class="text-xs leading-relaxed text-charcoal/80">${escapeHtml(message)}</p>
      </div>
    `;
    return;
  }

  const currency = draft.general.currency;
  const rows = [
    { label: 'Capacidad instalada', value: `${formatDecimal(estimate.installedCapacityKwp, 2)} kWp` },
    { label: 'Paneles', value: `${estimate.panelCount} × ${estimate.panel.watt} W` },
    { label: 'Generación mensual', value: `${formatNumber(estimate.generationMonthlyKwh)} kWh` },
    { label: 'Cobertura', value: formatPercent(estimate.coveragePercent) },
    { label: 'Ahorro mensual', value: formatCurrency(estimate.savingsMonthly, currency) },
    { label: 'Retorno estimado', value: estimate.paybackYears ? `${formatDecimal(estimate.paybackYears, 1)} años` : '—' },
  ];

  container.innerHTML = `
    <div>
      <p class="text-[11px] font-bold uppercase tracking-wider text-muted">Inversión estimada</p>
      <p class="mt-1 font-display text-2xl font-extrabold tracking-tight text-forest">${formatCurrency(estimate.total, currency)}</p>
      <p class="mt-0.5 text-[11px] text-muted">Incluye margen, descuento e impuestos configurados.</p>
    </div>
    <dl class="mt-4 grid grid-cols-2 gap-2.5">
      ${rows
        .map(
          (row) => `
        <div class="rounded-lg border border-line bg-natural/50 p-2.5">
          <dt class="text-[10px] font-bold uppercase tracking-wider text-muted">${row.label}</dt>
          <dd class="mt-0.5 text-xs font-semibold text-charcoal">${row.value}</dd>
        </div>
      `,
        )
        .join('')}
    </dl>
    <details class="mt-4 rounded-xl border border-line">
      <summary class="cursor-pointer px-3 py-2.5 text-xs font-semibold text-forest">Desglose de conceptos</summary>
      <ul class="space-y-1.5 border-t border-line px-3 py-2.5">
        ${estimate.lines
          .map(
            (line) => `
          <li class="flex items-start justify-between gap-3 text-[11px]">
            <span class="min-w-0 text-charcoal/75">${escapeHtml(line.concept)}${
              line.detail ? `<span class="block text-muted">${escapeHtml(line.detail)}</span>` : ''
            }</span>
            <span class="shrink-0 font-medium text-charcoal">${formatCurrency(line.amount, currency)}</span>
          </li>
        `,
          )
          .join('')}
        <li class="flex items-center justify-between gap-3 border-t border-line/70 pt-1.5 text-[11px]">
          <span class="text-charcoal/75">Margen</span>
          <span class="font-medium text-charcoal">${formatCurrency(estimate.margin, currency)}</span>
        </li>
        <li class="flex items-center justify-between gap-3 text-[11px]">
          <span class="text-charcoal/75">Descuento</span>
          <span class="font-medium text-charcoal">−${formatCurrency(estimate.discount, currency)}</span>
        </li>
        <li class="flex items-center justify-between gap-3 text-[11px]">
          <span class="text-charcoal/75">Impuestos</span>
          <span class="font-medium text-charcoal">${formatCurrency(estimate.tax, currency)}</span>
        </li>
      </ul>
    </details>
    <p class="mt-3 flex items-start gap-2 rounded-lg border border-line bg-natural/60 p-2.5 text-[11px] leading-relaxed text-muted">
      ${icon('info', 'mt-0.5 h-3.5 w-3.5 shrink-0 text-info')}
      ${escapeHtml(estimate.observations[0] ?? 'Estimación preliminar de demostración.')}
    </p>
  `;
}

/* ------------------------------------------------------------------ */
/* Modal de equipo                                                     */
/* ------------------------------------------------------------------ */

function openCatalogModal(kind: CatalogKind, id?: string): void {
  const fields = CATALOG_FIELDS[kind];
  const items = catalogItems(kind) as unknown as Array<Record<string, unknown>>;
  const existing = id ? items.find((item) => item.id === id) : undefined;
  const meta = CATALOG_META[kind];

  const defaults: Record<CatalogKind, Record<string, unknown>> = {
    panels: { brand: '', model: '', watt: 550, price: 4200, efficiency: 21, active: true },
    inverters: { brand: '', model: '', capacityKw: 6, price: 32000, type: 'string', active: true },
    batteries: { brand: '', model: '', capacityKwh: 5, price: 42000, type: 'litio', active: true },
  };

  const values = (existing ?? defaults[kind]) as Record<string, unknown>;

  const modal = openModal({
    title: existing ? 'Editar equipo' : 'Agregar equipo',
    subtitle: meta.title,
    content: `
      <form id="catalog-form" class="space-y-4">
        <div class="grid gap-4 sm:grid-cols-2">
          ${fields
            .map((field) => {
              const inputId = `catalog-${field.prop}`;
              const value = values[field.prop];
              if (field.type === 'select') {
                return `
                  <div>
                    <label class="admin-label" for="${inputId}">${field.label} *</label>
                    <select id="${inputId}" class="admin-select" data-field="${field.prop}">
                      ${(field.options ?? [])
                        .map(
                          (option) =>
                            `<option value="${option.value}" ${option.value === value ? 'selected' : ''}>${option.label}</option>`,
                        )
                        .join('')}
                    </select>
                  </div>
                `;
              }
              return `
                <div>
                  <label class="admin-label" for="${inputId}">${field.label} *</label>
                  <div class="relative">
                    <input
                      id="${inputId}"
                      type="${field.type}"
                      class="admin-input ${field.suffix ? 'pr-12' : ''}"
                      data-field="${field.prop}"
                      value="${escapeHtml(String(value ?? ''))}"
                      ${field.step ? `step="${field.step}"` : ''}
                      ${field.min !== undefined ? `min="${field.min}"` : ''}
                      required
                    />
                    ${field.suffix ? `<span class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">${field.suffix}</span>` : ''}
                  </div>
                </div>
              `;
            })
            .join('')}
        </div>
        <label class="flex cursor-pointer items-center gap-2.5 rounded-lg border border-line bg-natural/50 p-3">
          <input id="catalog-active" type="checkbox" class="admin-checkbox" ${values.active !== false ? 'checked' : ''} />
          <span class="text-sm font-medium text-charcoal">Disponible para cotizar</span>
        </label>
      </form>
    `,
    footer: `
      <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" class="admin-btn admin-btn-secondary" data-overlay-close>Cancelar</button>
        <button type="submit" form="catalog-form" class="admin-btn admin-btn-primary">${existing ? 'Guardar cambios' : 'Agregar al catálogo'}</button>
      </div>
    `,
  });

  modal.panel.querySelector<HTMLFormElement>('#catalog-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const read = (prop: string): string | number => {
      const node = modal.panel.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-field="${prop}"]`);
      if (!node) return '';
      if (fields.find((field) => field.prop === prop)?.type === 'number') {
        const parsed = Number(node.value);
        return Number.isFinite(parsed) ? parsed : 0;
      }
      return node.value.trim();
    };
    const record: Record<string, unknown> = {};
    fields.forEach((field) => {
      record[field.prop] = read(field.prop);
    });
    const textFields = fields.filter((field) => field.type === 'text');
    if (textFields.some((field) => !String(record[field.prop] ?? '').trim())) {
      toast('Completa la marca y el modelo del equipo.', 'warning');
      return;
    }
    record.active = modal.panel.querySelector<HTMLInputElement>('#catalog-active')?.checked ?? true;

    if (existing) {
      const item = items.find((entry) => entry.id === id);
      if (item) Object.assign(item, record);
      toast('Equipo actualizado.', 'success');
    } else {
      const created = { id: newId(kind), ...record } as unknown as SolarPanel | Inverter | Battery;
      if (kind === 'panels') draft.panels.push(created as SolarPanel);
      else if (kind === 'inverters') draft.inverters.push(created as Inverter);
      else draft.batteries.push(created as Battery);
      toast('Equipo agregado al catálogo.', 'success');
    }

    modal.close();
    refreshAll();
  });
}

/* ------------------------------------------------------------------ */
/* Eventos                                                             */
/* ------------------------------------------------------------------ */

function applyConfigValue(path: string, raw: string | boolean): void {
  const keys = path.split('.');
  let target: Record<string, unknown> = draft as unknown as Record<string, unknown>;
  for (let index = 0; index < keys.length - 1; index += 1) {
    const next = target[keys[index]];
    if (typeof next !== 'object' || next === null) return;
    target = next as Record<string, unknown>;
  }
  const last = keys[keys.length - 1];
  if (typeof raw === 'boolean') {
    target[last] = raw;
    return;
  }
  const current = target[last];
  if (typeof current === 'number') {
    const parsed = Number(raw);
    target[last] = Number.isFinite(parsed) ? parsed : 0;
    return;
  }
  target[last] = raw;
}

function refreshAll(): void {
  renderTabs();
  renderPanel();
  renderStatus();
  renderIssues();
  renderPreviewResult();
}

function bindEvents(): void {
  const root = document.getElementById('cotizador-panel');
  const previewCard = document.getElementById('cotizador-preview');

  document.getElementById('cotizador-tabs')?.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLElement>('[data-tab]');
    if (!button) return;
    const tab = button.dataset.tab as TabKey | undefined;
    if (!tab || tab === activeTab) return;
    activeTab = tab;
    renderTabs();
    renderPanel();
  });

  root?.addEventListener('input', (event) => {
    const input = event.target as HTMLInputElement;
    const path = input.dataset.config;
    if (path) {
      applyConfigValue(path, input.type === 'checkbox' ? input.checked : input.value);
      renderStatus();
      renderIssues();
      renderPreviewResult();
      return;
    }
    const kind = input.dataset.catalog as CatalogKind | undefined;
    const id = input.dataset.id;
    const prop = input.dataset.prop;
    if (!kind || !id || !prop) return;
    const value =
      input.type === 'checkbox'
        ? input.checked
        : input.type === 'number'
          ? Number(input.value) || 0
          : input.value;
    setCatalogProp(kind, id, prop, value);
    if (prop === 'brand' || prop === 'model' || prop === 'watt' || prop === 'capacityKw' || prop === 'capacityKwh') {
      const title = document.querySelector<HTMLElement>(`[data-card-title="${kind}-${id}"]`);
      const item = catalogItems(kind).find((entry) => entry.id === id);
      if (title && item) title.textContent = catalogTitle(kind, item);
    }
    renderStatus();
    renderIssues();
    renderPreviewResult();
  });

  root?.addEventListener('change', (event) => {
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    if (target instanceof HTMLSelectElement) {
      const path = target.dataset.config;
      if (path) {
        applyConfigValue(path, target.value);
        renderStatus();
        renderIssues();
        renderPreviewResult();
        return;
      }
      const kind = target.dataset.catalog as CatalogKind | undefined;
      const id = target.dataset.id;
      const prop = target.dataset.prop;
      if (kind && id && prop) {
        setCatalogProp(kind, id, prop, target.value);
        renderStatus();
        renderIssues();
        renderPreviewResult();
      }
    }
    const checkbox = event.target as HTMLInputElement;
    if (checkbox.type === 'checkbox') {
      const kind = checkbox.dataset.catalog as CatalogKind | undefined;
      const id = checkbox.dataset.id;
      const prop = checkbox.dataset.prop;
      if (kind && id && prop) {
        setCatalogProp(kind, id, prop, checkbox.checked);
        renderPanel();
        renderStatus();
        renderIssues();
        renderPreviewResult();
      }
    }
  });

  root?.addEventListener('click', async (event) => {
    const target = event.target as HTMLElement;
    const add = target.closest<HTMLElement>('[data-add-item]');
    if (add) {
      openCatalogModal(add.dataset.addItem as CatalogKind);
      return;
    }
    const edit = target.closest<HTMLElement>('[data-edit-item]');
    if (edit) {
      openCatalogModal(edit.dataset.editItem as CatalogKind, edit.dataset.id);
      return;
    }
    const remove = target.closest<HTMLElement>('[data-delete-item]');
    if (!remove) return;
    const kind = remove.dataset.deleteItem as CatalogKind;
    const id = remove.dataset.id ?? '';
    const item = catalogItems(kind).find((entry) => entry.id === id);
    if (!item) return;
    const confirmed = await confirmDialog({
      title: 'Eliminar del catálogo',
      message: `¿Eliminar "${catalogTitle(kind, item)}"? Las cotizaciones ya guardadas no se recalculan automáticamente.`,
      confirmLabel: 'Eliminar',
      tone: 'danger',
    });
    if (!confirmed) return;
    if (kind === 'panels') draft.panels = draft.panels.filter((entry) => entry.id !== id);
    else if (kind === 'inverters') draft.inverters = draft.inverters.filter((entry) => entry.id !== id);
    else draft.batteries = draft.batteries.filter((entry) => entry.id !== id);
    toast('Equipo eliminado del catálogo.', 'success');
    refreshAll();
  });

  previewCard?.addEventListener('input', (event) => {
    const input = event.target as HTMLInputElement | HTMLSelectElement;
    const key = input.dataset.preview;
    if (!key) return;
    if (key === 'monthlyConsumptionKwh') {
      preview.monthlyConsumptionKwh = Math.max(1, Number(input.value) || 0);
    } else if (key === 'tariff') {
      preview.tariff = Math.max(0, Number(input.value) || 0);
    } else if (key === 'projectType') {
      preview.projectType = input.value as ProjectType;
      if (preview.projectType === 'respaldo' && preview.systemType === 'interconectado') {
        preview.systemType = 'baterias';
        const systemSelect = document.getElementById('preview-system') as HTMLSelectElement | null;
        if (systemSelect) systemSelect.value = 'baterias';
      }
    } else if (key === 'systemType') {
      preview.systemType = input.value as SystemType;
    }
    renderPreviewResult();
  });

  document.getElementById('cotizador-save')?.addEventListener('click', () => {
    try {
      saveConfig(draft);
      saved = JSON.stringify(draft);
      toast('Configuración del cotizador guardada.', 'success');
      renderStatus();
      renderIssues();
    } catch (error) {
      renderIssues();
      toastError(error);
    }
  });

  document.getElementById('cotizador-discard')?.addEventListener('click', async () => {
    if (!dirty()) return;
    const confirmed = await confirmDialog({
      title: 'Descartar cambios',
      message: 'Se perderán los ajustes no guardados y volverás a la última configuración guardada.',
      confirmLabel: 'Descartar',
      tone: 'danger',
    });
    if (!confirmed) return;
    draft = clone(getConfig());
    saved = JSON.stringify(draft);
    toast('Cambios descartados.', 'info');
    refreshAll();
  });

  document.getElementById('cotizador-reset')?.addEventListener('click', async () => {
    const confirmed = await confirmDialog({
      title: 'Restaurar configuración predeterminada',
      message: 'Se reemplazarán catálogos, costos y reglas por los valores iniciales de la demostración.',
      confirmLabel: 'Restaurar',
      tone: 'danger',
    });
    if (!confirmed) return;
    draft = createDefaultConfig();
    try {
      saveConfig(draft);
      saved = JSON.stringify(draft);
      toast('Configuración restaurada a los valores predeterminados.', 'success');
      refreshAll();
    } catch (error) {
      toastError(error);
    }
  });
}

/* ------------------------------------------------------------------ */
/* Arranque                                                            */
/* ------------------------------------------------------------------ */

export function initCotizadorAdmin(): void {
  renderTabs();
  renderPanel();
  renderPreviewControls();
  renderStatus();
  renderIssues();
  bindEvents();
}
