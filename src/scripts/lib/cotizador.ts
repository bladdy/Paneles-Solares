import { addSolicitud, getConfig } from '../../services/store';
import { PROJECT_TYPE_OPTIONS } from '../../data/cotizador-defaults';
import {
  calculateSolarEstimate,
  SolarCalculationError,
} from '../../utils/solar-calculator';
import type { NewSolicitudInput } from '../../types/admin';
import type { ProjectType, SolarEstimate, SystemType } from '../../types/solar';
import {
  formatCurrency,
  formatDecimal,
  formatNumber,
} from '../../utils/format';

const TOTAL_STEPS = 6;

const STEP_CLASSES = {
  done: {
    item: 'flex shrink-0 items-center gap-2 rounded-full border border-forest/20 bg-light-green px-3 py-1.5 text-xs font-semibold text-forest',
    number: 'flex h-5 w-5 items-center justify-center rounded-full bg-forest text-[10px] font-bold text-white',
  },
  active: {
    item: 'flex shrink-0 items-center gap-2 rounded-full border border-forest bg-forest px-3 py-1.5 text-xs font-semibold text-white',
    number: 'flex h-5 w-5 items-center justify-center rounded-full bg-solar text-[10px] font-bold text-forest',
  },
  upcoming: {
    item: 'flex shrink-0 items-center gap-2 rounded-full border border-light-green bg-white px-3 py-1.5 text-xs font-semibold text-muted',
    number: 'flex h-5 w-5 items-center justify-center rounded-full bg-natural text-[10px] font-bold text-muted',
  },
};

const STEP_FIELDS: Record<number, string[]> = {
  1: [],
  2: ['consumption-monthly', 'consumption-bimonthly'],
  3: ['property-type'],
  5: ['contact-name', 'contact-email', 'contact-phone', 'contact-location'],
  6: ['consent'],
};

let step = 1;
let currentEstimate: SolarEstimate | null = null;

const $ = <T extends HTMLElement = HTMLElement>(id: string): T | null =>
  document.getElementById(id) as T | null;

const esc = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const round1 = (value: number): number => Math.round(value * 10) / 10;

function numberValue(id: string): number {
  const input = $(id) as HTMLInputElement | null;
  if (!input) return 0;
  const value = Number(input.value);
  return Number.isFinite(value) ? value : 0;
}

function optionalNumber(id: string): number | undefined {
  const input = $(id) as HTMLInputElement | null;
  if (!input || input.value.trim() === '') return undefined;
  const value = Number(input.value);
  return Number.isFinite(value) ? value : undefined;
}

function textValue(id: string): string {
  return ($(id) as HTMLInputElement | null)?.value.trim() ?? '';
}

function radioValue(name: string): string {
  return document.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`)?.value ?? '';
}

function projectType(): ProjectType {
  return (radioValue('projectType') || 'residencial') as ProjectType;
}

function systemType(): SystemType {
  return (radioValue('systemType') || 'interconectado') as SystemType;
}

function projectTypeLabel(): string {
  return PROJECT_TYPE_OPTIONS.find((option) => option.value === projectType())?.label ?? 'Residencial';
}

function currency(): string {
  return getConfig().general.currency || 'MXN';
}

/* ------------------------------------------------------------------ */
/* Pasos                                                               */
/* ------------------------------------------------------------------ */

function setError(stepNumber: number, message: string): void {
  const node = document.querySelector<HTMLElement>(`[data-step-error="${stepNumber}"]`);
  if (!node) return;
  if (message) {
    node.textContent = message;
    node.classList.remove('hidden');
  } else {
    node.textContent = '';
    node.classList.add('hidden');
  }
}

function clearErrors(): void {
  for (let index = 1; index <= TOTAL_STEPS; index += 1) setError(index, '');
}

function validate(current: number): string | null {
  if (current === 2) {
    const monthly = numberValue('consumption-monthly');
    if (!Number.isFinite(monthly) || monthly <= 0) {
      return 'Ingresa un consumo mensual mayor a cero para continuar.';
    }
    if (monthly > 200000) {
      return 'El consumo mensual parece muy alto. Verifica el dato en kWh de tu recibo.';
    }
  }
  if (current === 3) {
    if (!textValue('property-type')) {
      return 'Selecciona el tipo de propiedad para continuar.';
    }
    if (systemType() !== 'interconectado') {
      const hours = numberValue('backup-hours');
      if (hours < 1 || hours > 72) {
        return 'Indica entre 1 y 72 horas de respaldo.';
      }
    }
  }
  if (current === 5) {
    if (textValue('contact-name').length < 3) {
      return 'Ingresa tu nombre completo.';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(textValue('contact-email'))) {
      return 'Ingresa un correo electrónico válido.';
    }
    if (textValue('contact-phone').replace(/\D/g, '').length < 10) {
      return 'Ingresa un teléfono de al menos 10 dígitos.';
    }
    if (!textValue('contact-location')) {
      return 'Indica la ciudad o zona de la instalación.';
    }
  }
  if (current === 6) {
    const consent = $('consent') as HTMLInputElement | null;
    if (!consent?.checked) {
      return 'Acepta el contacto para poder enviar tu solicitud.';
    }
  }
  return null;
}

function focusField(current: number): void {
  const ids = STEP_FIELDS[current] ?? [];
  ids.forEach((id) => {
    const field = $(id);
    if (field) field.focus({ preventScroll: true });
  });
}

function renderIndicators(): void {
  document.querySelectorAll<HTMLElement>('[data-indicator]').forEach((item) => {
    const index = Number(item.dataset.indicator);
    const state = index < step ? 'done' : index === step ? 'active' : 'upcoming';
    item.className = STEP_CLASSES[state].item;
    item.setAttribute('aria-current', index === step ? 'step' : 'false');
    const number = item.querySelector<HTMLElement>('[data-indicator-number]');
    if (number) number.className = STEP_CLASSES[state].number;
  });
}

function showStep(next: number, scroll = true): void {
  step = Math.min(Math.max(next, 1), TOTAL_STEPS);
  document.querySelectorAll<HTMLElement>('[data-step]').forEach((fieldset) => {
    fieldset.hidden = Number(fieldset.dataset.step) !== step;
  });
  renderIndicators();

  const prev = document.querySelector<HTMLButtonElement>('[data-prev]');
  const nextButton = document.querySelector<HTMLButtonElement>('[data-next]');
  const submit = document.querySelector<HTMLButtonElement>('[data-submit]');
  const label = $('step-label');

  if (prev) prev.disabled = step === 1;
  if (nextButton) nextButton.hidden = step === TOTAL_STEPS;
  if (submit) submit.hidden = step !== TOTAL_STEPS;
  if (label) label.textContent = `Paso ${step} de ${TOTAL_STEPS}`;

  if (step === 4) renderEstimate();
  if (step === 6) renderReview();
  updateSummary();

  if (scroll) {
    const anchor = $('wizard-steps');
    if (anchor) {
      const top = anchor.getBoundingClientRect().top + window.scrollY - 96;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  }

  if (step !== 2) setError(2, '');
  if (step !== 3) setError(3, '');
  if (step !== 5) setError(5, '');
  if (step !== 6) setError(6, '');
}

function goNext(): void {
  const message = validate(step);
  if (message) {
    setError(step, message);
    focusField(step);
    return;
  }
  clearErrors();
  if (step === 3) {
    try {
      computeEstimate();
    } catch (error) {
      setError(
        3,
        error instanceof Error
          ? `No pudimos calcular tu estimación: ${error.message}`
          : 'No pudimos calcular tu estimación con la configuración actual.',
      );
      return;
    }
  }
  showStep(step + 1);
}

/* ------------------------------------------------------------------ */
/* Estimación                                                          */
/* ------------------------------------------------------------------ */

function computeEstimate(): SolarEstimate {
  const config = getConfig();
  const estimate = calculateSolarEstimate(
    {
      projectType: projectType(),
      systemType: systemType(),
      monthlyConsumptionKwh: numberValue('consumption-monthly'),
      monthlyBill: optionalNumber('bill-amount'),
      tariff: optionalNumber('tariff'),
      backupHours: systemType() === 'interconectado' ? undefined : numberValue('backup-hours') || 4,
      backupLoadKw: optionalNumber('backup-load'),
    },
    config,
  );
  currentEstimate = estimate;
  return estimate;
}

function summaryMetric(label: string, value: string): string {
  return `
    <div class="flex items-center justify-between gap-3 border-b border-line/70 py-1.5 last:border-0">
      <dt class="text-[11px] text-muted">${label}</dt>
      <dd class="text-right text-xs font-semibold text-charcoal">${escapeText(value)}</dd>
    </div>
  `;
}

function escapeText(value: string): string {
  return esc(value);
}

function updateSummary(): void {
  const container = $('quote-summary');
  if (!container) return;

  const monthly = numberValue('consumption-monthly');
  let estimate: SolarEstimate | null = null;
  if (monthly > 0) {
    try {
      estimate = calculateSolarEstimate(
        {
          projectType: projectType(),
          systemType: systemType(),
          monthlyConsumptionKwh: monthly,
          monthlyBill: optionalNumber('bill-amount'),
          tariff: optionalNumber('tariff'),
          backupHours: systemType() === 'interconectado' ? undefined : numberValue('backup-hours') || 4,
          backupLoadKw: optionalNumber('backup-load'),
        },
        getConfig(),
      );
    } catch {
      estimate = null;
    }
  }

  const metrics = [
    summaryMetric('Proyecto', projectTypeLabel()),
    summaryMetric('Sistema', systemType() === 'interconectado' ? 'Interconectado' : systemType() === 'baterias' ? 'Con baterías' : 'Híbrido'),
    summaryMetric('Consumo', monthly > 0 ? `${formatNumber(monthly)} kWh/mes` : 'Sin capturar'),
  ];

  if (estimate) {
    metrics.push(summaryMetric('Capacidad', `${formatDecimal(estimate.installedCapacityKwp, 2)} kWp`));
    metrics.push(summaryMetric('Paneles', `${estimate.panelCount} × ${estimate.panel.watt} W`));
  }

  container.innerHTML = `
    <dl>${metrics.join('')}</dl>
    ${
      estimate
        ? `<div class="mt-3 rounded-xl bg-forest p-3.5 text-white">
            <p class="text-[10px] font-bold uppercase tracking-wider text-white/60">Inversión estimada</p>
            <p class="mt-0.5 font-display text-xl font-extrabold text-solar">${escapeText(formatCurrency(estimate.total, currency()))}</p>
            <div class="mt-2 flex items-center justify-between gap-2 border-t border-white/10 pt-2 text-[11px]">
              <span class="text-white/60">Ahorro mensual</span>
              <span class="font-semibold">${escapeText(formatCurrency(estimate.savingsMonthly, currency()))}</span>
            </div>
            <div class="mt-1 flex items-center justify-between gap-2 text-[11px]">
              <span class="text-white/60">Cobertura</span>
              <span class="font-semibold">${formatDecimal(estimate.coveragePercent, 0)}%</span>
            </div>
          </div>`
        : `<div class="mt-3 rounded-xl border border-dashed border-line bg-natural/60 p-3.5 text-center">
            <p class="text-xs leading-relaxed text-muted">Captura tu consumo en kWh para ver la capacidad y la inversión estimada.</p>
          </div>`
    }
  `;
}

function metricCard(label: string, value: string, detail?: string): string {
  return `
    <div class="rounded-xl border border-line bg-natural/50 p-3">
      <p class="text-[10px] font-bold uppercase tracking-wider text-muted">${escapeText(label)}</p>
      <p class="mt-0.5 text-sm font-bold text-charcoal">${escapeText(value)}</p>
      ${detail ? `<p class="mt-0.5 text-[11px] text-muted">${escapeText(detail)}</p>` : ''}
    </div>
  `;
}

function renderEstimate(): void {
  const container = $('estimate-content');
  if (!container) return;

  let estimate: SolarEstimate;
  try {
    estimate = computeEstimate();
  } catch (error) {
    const message =
      error instanceof SolarCalculationError || error instanceof Error
        ? error.message
        : 'Revisa tu consumo e inténtalo de nuevo.';
    container.innerHTML = `
      <div class="rounded-xl border border-danger/20 bg-danger-soft/60 p-4">
        <p class="text-sm font-semibold text-danger">No pudimos generar la estimación</p>
        <p class="mt-1 text-xs leading-relaxed text-charcoal/80">${escapeText(message)}</p>
      </div>
    `;
    return;
  }

  const metrics = [
    metricCard('Capacidad instalada', `${formatDecimal(estimate.installedCapacityKwp, 2)} kWp`, `${estimate.panelCount} paneles de ${estimate.panel.watt} W`),
    metricCard('Generación mensual', `${formatNumber(estimate.generationMonthlyKwh)} kWh`, `Cubre ${formatDecimal(estimate.coveragePercent, 0)}% de tu consumo`),
    metricCard('Ahorro estimado', formatCurrency(estimate.savingsMonthly, currency()), `${formatCurrency(estimate.savingsAnnual, currency())} al año`),
    metricCard('Retorno de inversión', estimate.paybackYears ? `${formatDecimal(estimate.paybackYears, 1)} años` : 'Por calcular', 'Con la tarifa estimada'),
  ];

  container.innerHTML = `
    <div class="rounded-2xl border border-forest/15 bg-forest p-5 text-white">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="text-[10px] font-bold uppercase tracking-[0.16em] text-white/55">Inversión estimada</p>
          <p class="mt-1 font-display text-3xl font-extrabold tracking-tight text-solar">${escapeText(formatCurrency(estimate.total, currency()))}</p>
          <p class="mt-1 text-[11px] text-white/60">Incluye equipos, instalación, margen e impuestos configurados.</p>
        </div>
        <span class="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white/80">
          ${estimate.assumptions.priceMode === 'precio-por-watt' ? 'Precio por watt' : 'Costo desglosado'}
        </span>
      </div>
      <div class="mt-4 grid grid-cols-2 gap-2.5 border-t border-white/10 pt-4 text-xs sm:grid-cols-4">
        <div>
          <p class="text-[10px] uppercase tracking-wider text-white/50">Sistema</p>
          <p class="mt-0.5 font-semibold">${estimate.requiredPowerKw} kW</p>
        </div>
        <div>
          <p class="text-[10px] uppercase tracking-wider text-white/50">Área aprox.</p>
          <p class="mt-0.5 font-semibold">${formatDecimal(estimate.panelAreaM2, 0)} m²</p>
        </div>
        <div>
          <p class="text-[10px] uppercase tracking-wider text-white/50">Tarifa usada</p>
          <p class="mt-0.5 font-semibold">${escapeText(formatCurrency(estimate.assumptions.tariff, currency()))}/kWh</p>
        </div>
        <div>
          <p class="text-[10px] uppercase tracking-wider text-white/50">Baterías</p>
          <p class="mt-0.5 font-semibold">${estimate.battery ? `${estimate.batteryCount} unidad(es)` : 'Sin baterías'}</p>
        </div>
      </div>
    </div>

    <div class="mt-4 grid gap-3 sm:grid-cols-2">
      ${metrics.join('')}
    </div>

    <details class="mt-4 rounded-xl border border-line">
      <summary class="cursor-pointer px-4 py-3 text-xs font-semibold text-forest">Ver desglose de conceptos</summary>
      <ul class="divide-y divide-line/70 border-t border-line px-4">
        ${estimate.lines
          .map(
            (line) => `
          <li class="flex items-start justify-between gap-3 py-2 text-[11px]">
            <span class="min-w-0 text-charcoal/75">
              ${escapeText(line.concept)}
              ${line.detail ? `<span class="block text-muted">${escapeText(line.detail)}</span>` : ''}
            </span>
            <span class="shrink-0 font-semibold text-charcoal">${escapeText(formatCurrency(line.amount, currency()))}</span>
          </li>
        `,
          )
          .join('')}
        <li class="flex items-center justify-between gap-3 py-2 text-[11px]">
          <span class="text-charcoal/75">Margen</span>
          <span class="font-semibold text-charcoal">${escapeText(formatCurrency(estimate.margin, currency()))}</span>
        </li>
        <li class="flex items-center justify-between gap-3 py-2 text-[11px]">
          <span class="text-charcoal/75">Descuento</span>
          <span class="font-semibold text-charcoal">−${escapeText(formatCurrency(estimate.discount, currency()))}</span>
        </li>
        <li class="flex items-center justify-between gap-3 py-2 text-[11px]">
          <span class="text-charcoal/75">Impuestos</span>
          <span class="font-semibold text-charcoal">${escapeText(formatCurrency(estimate.tax, currency()))}</span>
        </li>
        <li class="flex items-center justify-between gap-3 py-2 text-xs">
          <span class="font-semibold text-forest">Total estimado</span>
          <span class="font-bold text-forest">${escapeText(formatCurrency(estimate.total, currency()))}</span>
        </li>
      </ul>
    </details>

    ${
      estimate.observations.length
        ? `<ul class="mt-3 space-y-1.5 rounded-xl border border-solar/25 bg-solar-soft/40 p-3">
            ${estimate.observations
              .slice(0, 3)
              .map(
                (observation) =>
                  `<li class="flex items-start gap-2 text-[11px] leading-relaxed text-charcoal/75"><span class="mt-1 h-1 w-1 shrink-0 rounded-full bg-warning"></span>${escapeText(
                    observation,
                  )}</li>`,
              )
              .join('')}
          </ul>`
        : ''
    }
  `;
}

/* ------------------------------------------------------------------ */
/* Resumen final                                                       */
/* ------------------------------------------------------------------ */

function reviewRow(label: string, value: string): string {
  return `
    <div class="flex items-start justify-between gap-3 py-1.5">
      <dt class="shrink-0 text-xs text-muted">${escapeText(label)}</dt>
      <dd class="text-right text-xs font-medium text-charcoal">${escapeText(value)}</dd>
    </div>
  `;
}

function reviewBlock(title: string, rows: string, goto: number): string {
  return `
    <section class="rounded-xl border border-line">
      <header class="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
        <h3 class="text-xs font-bold uppercase tracking-wider text-charcoal">${title}</h3>
        <button type="button" class="text-[11px] font-semibold text-forest hover:underline" data-goto="${goto}">Editar</button>
      </header>
      <dl class="px-4 py-2">${rows}</dl>
    </section>
  `;
}

function renderReview(): void {
  const container = $('review-content');
  if (!container) return;

  const monthly = numberValue('consumption-monthly');
  const bill = optionalNumber('bill-amount');
  const tariff = optionalNumber('tariff');
  const property = textValue('property-type');
  const roof = textValue('roof-type');
  const area = optionalNumber('roof-area');
  const orientation = textValue('orientation');
  const contactName = textValue('contact-name');
  const company = textValue('contact-company');
  const email = textValue('contact-email');
  const phone = textValue('contact-phone');
  const location = textValue('contact-location');

  let estimate: SolarEstimate | null = currentEstimate;
  try {
    estimate = computeEstimate();
  } catch {
    estimate = null;
  }

  container.innerHTML = `
    <div class="grid gap-3 sm:grid-cols-2">
      ${reviewBlock(
        'Proyecto',
        [
          reviewRow('Tipo', projectTypeLabel()),
          reviewRow('Sistema', systemType() === 'interconectado' ? 'Interconectado a la red' : systemType() === 'baterias' ? 'Con baterías' : 'Híbrido'),
          reviewRow('Consumo', `${formatNumber(monthly)} kWh/mes · ${formatNumber(monthly * 2)} kWh/bimestre`),
        ].join(''),
        1,
      )}
      ${reviewBlock(
        'Consumo y tarifa',
        [
          reviewRow('Recibo', bill !== undefined ? formatCurrency(bill, currency()) : 'No indicado'),
          reviewRow('Tarifa', tariff !== undefined ? `${formatCurrency(tariff, currency())}/kWh` : 'Tarifa de referencia'),
        ].join(''),
        2,
      )}
      ${reviewBlock(
        'Inmueble',
        [
          reviewRow('Propiedad', property || 'No indicado'),
          reviewRow('Techo', roof || 'No indicado'),
          reviewRow('Área', area !== undefined ? `${formatNumber(area)} m²` : 'No indicada'),
          reviewRow('Orientación', orientation || 'No indicada'),
        ].join(''),
        3,
      )}
      ${reviewBlock(
        'Contacto',
        [
          reviewRow('Nombre', contactName),
          reviewRow('Empresa', company || 'No indicada'),
          reviewRow('Correo', email),
          reviewRow('Teléfono', phone),
          reviewRow('Ubicación', location),
        ].join(''),
        5,
      )}
    </div>

    ${
      estimate
        ? `<div class="rounded-xl border border-forest/15 bg-forest p-4 text-white">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p class="text-[10px] font-bold uppercase tracking-[0.16em] text-white/55">Inversión estimada preliminar</p>
                <p class="mt-0.5 font-display text-2xl font-extrabold text-solar">${escapeText(formatCurrency(estimate.total, currency()))}</p>
              </div>
              <div class="text-right text-[11px] text-white/70">
                <p>${formatDecimal(estimate.installedCapacityKwp, 2)} kWp · ${estimate.panelCount} paneles</p>
                <p>${formatNumber(estimate.generationMonthlyKwh)} kWh/mes generados</p>
              </div>
            </div>
            <p class="mt-3 border-t border-white/10 pt-2.5 text-[11px] leading-relaxed text-white/60">
              Estimación informativa. La cotización formal se confirma después de la validación técnica en sitio.
            </p>
          </div>`
        : `<div class="rounded-xl border border-warning/25 bg-warning-soft p-3 text-xs text-charcoal/80">
            No pudimos calcular la estimación con la configuración actual. Puedes enviar tu solicitud y un asesor la revisará.
          </div>`
    }
  `;
}

/* ------------------------------------------------------------------ */
/* Envío                                                               */
/* ------------------------------------------------------------------ */

function buildInput(): NewSolicitudInput {
  const property = textValue('property-type') || 'Otro';
  const system = systemType();
  const monthly = numberValue('consumption-monthly');
  const bill = optionalNumber('bill-amount');
  const tariff = optionalNumber('tariff');
  const area = optionalNumber('roof-area');
  const roof = textValue('roof-type');
  const orientation = textValue('orientation');
  const company = textValue('contact-company');
  const comments = textValue('property-notes');

  return {
    client: {
      name: textValue('contact-name'),
      company: company || undefined,
      email: textValue('contact-email'),
      phone: textValue('contact-phone'),
      location: textValue('contact-location'),
      propertyType: property,
      comments: comments || undefined,
    },
    energy: {
      projectType: projectType(),
      monthlyConsumptionKwh: monthly,
      billAmount: bill,
      tariff,
      propertyType: property,
      roofAreaM2: area,
      roofType: roof || undefined,
      orientation: orientation || undefined,
    },
    systemType: system,
    backup:
      system === 'interconectado'
        ? undefined
        : {
            hours: numberValue('backup-hours') || 4,
            loadKw: optionalNumber('backup-load') ?? 0,
            equipment: ['Refrigeración', 'Iluminación', 'Equipos críticos'],
          },
    source: 'sitio-publico',
  };
}

function renderSuccess(folio: string): void {
  const wizard = $('quote-wizard');
  const success = $('quote-success');
  if (wizard) wizard.classList.add('hidden');
  if (success) success.classList.remove('hidden');

  const folioNode = $('success-folio');
  if (folioNode) folioNode.textContent = folio;

  const summary = $('success-summary');
  if (summary) {
    const email = textValue('contact-email');
    summary.innerHTML = `
      <p><span class="text-muted">Proyecto:</span> <span class="font-semibold text-charcoal">${escapeText(projectTypeLabel())}</span></p>
      <p><span class="text-muted">Consumo:</span> <span class="font-semibold text-charcoal">${formatNumber(numberValue('consumption-monthly'))} kWh/mes</span></p>
      ${
        currentEstimate
          ? `<p><span class="text-muted">Estimación:</span> <span class="font-semibold text-forest">${escapeText(
              formatCurrency(currentEstimate.total, currency()),
            )}</span> <span class="text-muted">(preliminar)</span></p>`
          : ''
      }
      <p><span class="text-muted">Contacto:</span> <span class="font-semibold text-charcoal">${escapeText(email)}</span></p>
    `;
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function submit(): Promise<void> {
  const message = validate(6);
  if (message) {
    setError(6, message);
    return;
  }
  const button = document.querySelector<HTMLButtonElement>('[data-submit]');
  if (!button || button.disabled) return;

  button.disabled = true;
  const original = button.innerHTML;
  button.innerHTML = 'Enviando solicitud…';

  window.setTimeout(() => {
    try {
      const request = addSolicitud(buildInput());
      currentEstimate = request.calculation;
      renderSuccess(request.folio);
      button.disabled = false;
      button.innerHTML = original;
    } catch (error) {
      button.disabled = false;
      button.innerHTML = original;
      setError(
        6,
        error instanceof Error
          ? `No pudimos registrar tu solicitud: ${error.message}`
          : 'No pudimos registrar tu solicitud. Inténtalo de nuevo.',
      );
    }
  }, 900);
}

/* ------------------------------------------------------------------ */
/* Sincronización y eventos                                            */
/* ------------------------------------------------------------------ */

function syncConsumption(source: 'monthly' | 'bimonthly'): void {
  const monthlyInput = $('consumption-monthly') as HTMLInputElement | null;
  const bimonthlyInput = $('consumption-bimonthly') as HTMLInputElement | null;
  if (!monthlyInput || !bimonthlyInput) return;

  if (source === 'monthly') {
    const raw = monthlyInput.value.trim();
    bimonthlyInput.value = raw === '' ? '' : String(round1(Number(raw) * 2));
  } else {
    const raw = bimonthlyInput.value.trim();
    monthlyInput.value = raw === '' ? '' : String(round1(Number(raw) / 2));
  }
  updateTariffHint();
  updateSummary();
  if (step === 4) renderEstimate();
}

function updateTariffHint(): void {
  const hint = $('tariff-hint');
  if (!hint) return;
  const tariff = optionalNumber('tariff');
  const bill = optionalNumber('bill-amount');
  const monthly = numberValue('consumption-monthly');
  if (tariff !== undefined && tariff > 0) {
    hint.textContent = `Usaremos $${formatDecimal(tariff, 2)} por kWh para estimar tu ahorro.`;
    return;
  }
  if (bill !== undefined && bill > 0 && monthly > 0) {
    hint.textContent = `Tarifa implícita de tu recibo: $${formatDecimal(bill / monthly, 2)} por kWh.`;
    return;
  }
  hint.textContent = 'Si la dejas vacía usamos la tarifa de referencia.';
}

function toggleBackup(): void {
  const block = $('backup-fields');
  if (!block) return;
  const needed = systemType() !== 'interconectado';
  block.classList.toggle('hidden', !needed);
  block.setAttribute('aria-hidden', String(!needed));
}

function bindEvents(): void {
  const form = $('quote-form') as HTMLFormElement | null;
  if (!form) return;

  document.querySelector<HTMLButtonElement>('[data-next]')?.addEventListener('click', goNext);
  document.querySelector<HTMLButtonElement>('[data-prev]')?.addEventListener('click', () => {
    clearErrors();
    showStep(step - 1);
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void submit();
  });

  form.addEventListener('click', (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-goto]');
    if (!target) return;
    const targetStep = Number(target.dataset.goto);
    if (Number.isFinite(targetStep)) showStep(targetStep);
  });

  form.addEventListener('input', (event) => {
    const target = event.target as HTMLElement;
    const id = target.id;
    if (id === 'consumption-monthly') syncConsumption('monthly');
    else if (id === 'consumption-bimonthly') syncConsumption('bimonthly');
    else if (id === 'bill-amount' || id === 'tariff') {
      updateTariffHint();
      updateSummary();
      if (step === 4) renderEstimate();
    } else {
      updateSummary();
    }
    if (step >= 1) setError(step, '');
  });

  form.addEventListener('change', (event) => {
    const target = event.target as HTMLInputElement;
    if (target.name === 'projectType') {
      if (target.value === 'respaldo') {
        const battery = document.querySelector<HTMLInputElement>('input[name="systemType"][value="baterias"]');
        if (battery) battery.checked = true;
      }
      toggleBackup();
      updateSummary();
      if (step === 4) renderEstimate();
    }
    if (target.name === 'systemType') {
      toggleBackup();
      updateSummary();
      if (step === 4) renderEstimate();
    }
    if (target.id === 'property-type') {
      updateSummary();
    }
  });

  $('new-quote')?.addEventListener('click', () => {
    window.location.reload();
  });
}

export function initPublicQuote(): void {
  const monthlyInput = $('consumption-monthly') as HTMLInputElement | null;
  const bimonthlyInput = $('consumption-bimonthly') as HTMLInputElement | null;
  if (monthlyInput && !monthlyInput.value) monthlyInput.value = '450';
  if (bimonthlyInput) bimonthlyInput.value = String(round1(Number(monthlyInput?.value || 450) * 2));

  toggleBackup();
  updateTariffHint();
  updateSummary();
  showStep(1, false);
  bindEvents();
}
