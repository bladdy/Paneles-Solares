import {
  acceptSolicitud,
  addSolicitudNote,
  getSession,
  hasPermission,
  loadState,
  recalculateSolicitud,
  roleById,
  setSolicitudStatus,
  userName,
} from '../../services/store';
import type { RequestStatus, Solicitud } from '../../types/admin';
import {
  escapeHtml,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatDecimal,
  formatKwh,
  formatNumber,
  formatPercent,
  relativeTime,
} from '../../utils/format';
import {
  PROJECT_TYPE_LABEL,
  REQUEST_STATUS_CLASS,
  REQUEST_STATUS_LABEL,
  REQUEST_STATUS_ORDER,
  SYSTEM_TYPE_LABEL,
} from '../../utils/status';
import { icon } from './icons';
import {
  avatarLetter,
  confirmDialog,
  downloadText,
  emptyStateHtml,
  toast,
  toastError,
} from './ui';
import { openAssignModal, openConvertModal, openRejectModal } from './solicitudes';

const STATUS_HINT: Record<RequestStatus, string> = {
  nueva: 'La solicitud acaba de ingresar y requiere revisión inicial.',
  'en-revision': 'El equipo está validando consumo, ubicación y alcance.',
  'pendiente-info': 'Falta información del cliente para continuar.',
  'cotizacion-calculada': 'El dimensionamiento y la inversión ya están calculados.',
  'cotizacion-enviada': 'La propuesta fue compartida con el cliente.',
  aceptada: 'El cliente aceptó la propuesta y puede convertirse en proyecto.',
  rechazada: 'La solicitud fue cerrada sin conversión.',
  convertida: 'La solicitud ya tiene un proyecto asociado.',
};

let currentRequest: Solicitud | null = null;

function requestId(): string {
  const parts = window.location.pathname.split('/').filter(Boolean);
  return decodeURIComponent(parts[parts.length - 1] ?? '');
}

function canEdit(): boolean {
  const session = getSession();
  return session ? hasPermission(session.roleId, 'solicitudes', 'editar') : false;
}

function currentUserLabel(state = loadState()): string {
  return userName(state, getSession()?.userId);
}

function renderHeader(request: Solicitud): void {
  const set = (id: string, value: string) => {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  };
  set('detail-folio', request.folio);
  set('detail-client', request.client.name);
  set('detail-date', formatDate(request.createdAt));
  const status = document.getElementById('detail-status');
  if (status) {
    status.className = `admin-badge ${REQUEST_STATUS_CLASS[request.status]}`;
    status.textContent = REQUEST_STATUS_LABEL[request.status];
  }
  const badge = document.getElementById('detail-priority-wrap');
  badge?.classList.toggle('hidden', !['aceptada', 'cotizacion-enviada'].includes(request.status));

  const title = document.querySelector('title');
  if (title) title.textContent = `${request.folio} · Solicitudes · EnerSol Admin`;
}

function clientCard(request: Solicitud): string {
  return `
    <section class="admin-card" aria-labelledby="client-title">
      <div class="admin-card-header">
        <div>
          <h2 id="client-title" class="admin-section-title">Datos del cliente</h2>
          <p class="admin-section-subtitle">Contacto y contexto de la solicitud.</p>
        </div>
        <span class="admin-badge border-line bg-natural text-muted">${request.source === 'manual' ? 'Captura manual' : 'Sitio público'}</span>
      </div>
      <div class="admin-card-body">
        <dl class="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <div>
            <dt class="text-[11px] font-bold uppercase tracking-wider text-muted">Cliente</dt>
            <dd class="mt-1 text-sm font-semibold text-charcoal">${escapeHtml(request.client.name)}</dd>
            ${request.client.company ? `<dd class="text-xs text-muted">${escapeHtml(request.client.company)}</dd>` : ''}
          </div>
          <div>
            <dt class="text-[11px] font-bold uppercase tracking-wider text-muted">Correo</dt>
            <dd class="mt-1 truncate text-sm"><a class="admin-link" href="mailto:${escapeHtml(request.client.email)}">${escapeHtml(request.client.email)}</a></dd>
          </div>
          <div>
            <dt class="text-[11px] font-bold uppercase tracking-wider text-muted">Teléfono</dt>
            <dd class="mt-1 text-sm"><a class="admin-link" href="tel:${escapeHtml(request.client.phone.replace(/\s+/g, ''))}">${escapeHtml(request.client.phone)}</a></dd>
          </div>
          <div>
            <dt class="text-[11px] font-bold uppercase tracking-wider text-muted">Ubicación</dt>
            <dd class="mt-1 flex items-start gap-1.5 text-sm">
              ${icon('mapPin', 'mt-0.5 h-4 w-4 shrink-0 text-muted')}
              ${escapeHtml(request.client.location)}
            </dd>
          </div>
          <div>
            <dt class="text-[11px] font-bold uppercase tracking-wider text-muted">Tipo de propiedad</dt>
            <dd class="mt-1 text-sm">${escapeHtml(request.client.propertyType || request.energy.propertyType)}</dd>
          </div>
          <div>
            <dt class="text-[11px] font-bold uppercase tracking-wider text-muted">Tipo de proyecto</dt>
            <dd class="mt-1 text-sm">${escapeHtml(PROJECT_TYPE_LABEL[request.energy.projectType])}</dd>
          </div>
        </dl>
        ${
          request.client.comments
            ? `<div class="mt-5 rounded-xl border border-line bg-natural/60 p-3.5">
                <p class="text-[11px] font-bold uppercase tracking-wider text-muted">Comentarios del cliente</p>
                <p class="mt-1.5 text-sm leading-relaxed text-charcoal/80">${escapeHtml(request.client.comments)}</p>
              </div>`
            : ''
        }
      </div>
    </section>
  `;
}

function energyCard(request: Solicitud): string {
  const calc = request.calculation;
  return `
    <section class="admin-card" aria-labelledby="energy-title">
      <div class="admin-card-header">
        <div>
          <h2 id="energy-title" class="admin-section-title">Consumo y dimensionamiento</h2>
          <p class="admin-section-subtitle">Datos capturados y resultado preliminar del motor de cálculo.</p>
        </div>
        <span class="admin-badge border-forest/15 bg-light-green text-forest">
          ${icon('zap', 'h-3.5 w-3.5')} ${formatNumber(calc.installedCapacityKwp)} kWp
        </span>
      </div>
      <div class="admin-card-body space-y-5">
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div class="rounded-xl border border-line bg-natural/50 p-3">
            <p class="text-[11px] font-semibold uppercase tracking-wider text-muted">Consumo mensual</p>
            <p class="mt-1 font-display text-lg font-bold text-forest">${formatKwh(request.energy.monthlyConsumptionKwh)}</p>
          </div>
          <div class="rounded-xl border border-line bg-natural/50 p-3">
            <p class="text-[11px] font-semibold uppercase tracking-wider text-muted">Consumo bimestral</p>
            <p class="mt-1 font-display text-lg font-bold text-forest">${formatKwh(request.energy.bimonthlyConsumptionKwh)}</p>
          </div>
          <div class="rounded-xl border border-line bg-natural/50 p-3">
            <p class="text-[11px] font-semibold uppercase tracking-wider text-muted">Recibo mensual</p>
            <p class="mt-1 font-display text-lg font-bold text-forest">${formatCurrency(request.energy.billAmount || calc.assumptions.tariff * request.energy.monthlyConsumptionKwh)}</p>
          </div>
          <div class="rounded-xl border border-line bg-natural/50 p-3">
            <p class="text-[11px] font-semibold uppercase tracking-wider text-muted">Tarifa</p>
            <p class="mt-1 font-display text-lg font-bold text-forest">${formatCurrency(calc.assumptions.tariff)}<span class="text-xs font-medium text-muted">/kWh</span></p>
          </div>
        </div>

        <div class="overflow-x-auto rounded-xl border border-line">
          <table class="admin-table min-w-[560px]">
            <tbody>
              <tr><td class="text-muted">Tipo de sistema</td><td class="font-medium">${escapeHtml(SYSTEM_TYPE_LABEL[request.systemType])}</td></tr>
              <tr><td class="text-muted">Potencia requerida</td><td class="font-medium">${formatDecimal(calc.requiredPowerKw, 2)} kW</td></tr>
              <tr><td class="text-muted">Paneles</td><td class="font-medium">${calc.panelCount} × ${escapeHtml(calc.panel.brand)} ${escapeHtml(calc.panel.model)} (${calc.panel.watt} W)</td></tr>
              <tr><td class="text-muted">Inversor</td><td class="font-medium">${escapeHtml(calc.inverter.brand)} ${escapeHtml(calc.inverter.model)} · ${calc.inverter.capacityKw} kW</td></tr>
              <tr><td class="text-muted">Generación estimada</td><td class="font-medium">${formatKwh(calc.generationMonthlyKwh)} / mes</td></tr>
              ${request.backup ? `<tr><td class="text-muted">Respaldo solicitado</td><td class="font-medium">${request.backup.hours} h · ${formatDecimal(request.backup.loadKw, 1)} kW ${request.backup.equipment.length ? `· ${escapeHtml(request.backup.equipment.join(', '))}` : ''}</td></tr>` : ''}
              ${request.energy.roofAreaM2 ? `<tr><td class="text-muted">Área de techo</td><td class="font-medium">${formatNumber(request.energy.roofAreaM2)} m² · ${escapeHtml(request.energy.roofType ?? 'Sin definir')} · ${escapeHtml(request.energy.orientation ?? 'Orientación sin definir')}</td></tr>` : ''}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  `;
}

function quoteCard(request: Solicitud): string {
  const calc = request.calculation;
  return `
    <section class="admin-card" aria-labelledby="quote-title">
      <div class="admin-card-header">
        <div>
          <h2 id="quote-title" class="admin-section-title">Cotización preliminar</h2>
          <p class="admin-section-subtitle">Cálculo generado con la configuración vigente del cotizador.</p>
        </div>
        <div class="flex gap-2">
          <button type="button" class="admin-btn admin-btn-secondary admin-btn-sm" data-download-quote>
            ${icon('download', 'h-3.5 w-3.5')} Descargar
          </button>
          ${
            canEdit()
              ? `<button type="button" class="admin-btn admin-btn-secondary admin-btn-sm" data-recalculate>
                  ${icon('refresh', 'h-3.5 w-3.5')} Recalcular
                </button>`
              : ''
          }
        </div>
      </div>
      <div class="admin-card-body">
        <div class="flex items-start gap-2.5 rounded-xl border border-solar/35 bg-solar-soft/70 p-3.5">
          ${icon('alert', 'mt-0.5 h-4 w-4 shrink-0 text-[#9A6700]')}
          <p class="text-xs leading-relaxed text-charcoal/80">
            <strong class="font-semibold">Estimación preliminar.</strong>
            Requiere validación técnica en sitio. No representa una cotización en firme ni un compromiso comercial.
          </p>
        </div>

        <div class="mt-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p class="text-[11px] font-bold uppercase tracking-wider text-muted">Inversión estimada</p>
            <p class="mt-1 font-display text-3xl font-extrabold tracking-tight text-forest">${formatCurrency(calc.total)}</p>
            <p class="text-xs text-muted">IVA incluido · ${calc.assumptions.priceMode === 'precio-por-watt' ? 'Precio por watt' : 'Costo desglosado'}</p>
          </div>
          <div class="grid grid-cols-2 gap-x-5 gap-y-2 text-right text-xs sm:grid-cols-4">
            <div><p class="text-muted">Subtotal</p><p class="font-semibold text-charcoal">${formatCurrency(calc.subtotal)}</p></div>
            <div><p class="text-muted">Descuento</p><p class="font-semibold text-charcoal">-${formatCurrency(calc.discount)}</p></div>
            <div><p class="text-muted">IVA</p><p class="font-semibold text-charcoal">${formatCurrency(calc.tax)}</p></div>
            <div><p class="text-muted">Margen</p><p class="font-semibold text-charcoal">${formatPercent((calc.margin / Math.max(calc.baseCost, 1)) * 100)}</p></div>
          </div>
        </div>

        <div class="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div class="rounded-xl bg-light-green/60 p-3">
            <p class="text-[11px] font-semibold text-forest/70">Ahorro mensual</p>
            <p class="mt-0.5 text-sm font-bold text-forest">${formatCurrency(calc.savingsMonthly)}</p>
          </div>
          <div class="rounded-xl bg-light-green/60 p-3">
            <p class="text-[11px] font-semibold text-forest/70">Ahorro anual</p>
            <p class="mt-0.5 text-sm font-bold text-forest">${formatCurrency(calc.savingsAnnual)}</p>
          </div>
          <div class="rounded-xl bg-light-green/60 p-3">
            <p class="text-[11px] font-semibold text-forest/70">Cobertura</p>
            <p class="mt-0.5 text-sm font-bold text-forest">${formatPercent(calc.coveragePercent)}</p>
          </div>
          <div class="rounded-xl bg-light-green/60 p-3">
            <p class="text-[11px] font-semibold text-forest/70">Retorno</p>
            <p class="mt-0.5 text-sm font-bold text-forest">${calc.paybackYears ? `${formatDecimal(calc.paybackYears, 1)} años` : '—'}</p>
          </div>
        </div>

        <div class="mt-5 overflow-x-auto rounded-xl border border-line">
          <table class="admin-table min-w-[620px]">
            <thead>
              <tr><th>Concepto</th><th>Detalle</th><th class="text-right">Importe</th></tr>
            </thead>
            <tbody>
              ${calc.lines
                .map(
                  (line) => `
                <tr>
                  <td class="font-medium">${escapeHtml(line.concept)}</td>
                  <td class="text-xs text-muted">${escapeHtml(line.detail ?? '—')}</td>
                  <td class="whitespace-nowrap text-right font-medium">${formatCurrency(line.amount)}</td>
                </tr>
              `,
                )
                .join('')}
            </tbody>
          </table>
        </div>

        <div class="mt-5 grid gap-4 lg:grid-cols-2">
          <div>
            <h3 class="text-xs font-bold uppercase tracking-wider text-muted">Supuestos de cálculo</h3>
            <ul class="mt-2 space-y-1.5 text-sm text-charcoal/80">
              <li class="flex justify-between gap-3"><span>Horas solares pico</span><strong>${formatDecimal(calc.assumptions.peakSunHours, 2)} h</strong></li>
              <li class="flex justify-between gap-3"><span>Factor de rendimiento</span><strong>${formatPercent(calc.assumptions.performanceRatio * 100)}</strong></li>
              <li class="flex justify-between gap-3"><span>Cobertura objetivo</span><strong>${formatPercent(calc.assumptions.coverageTarget)}</strong></li>
              <li class="flex justify-between gap-3"><span>Margen de seguridad</span><strong>${formatPercent(calc.assumptions.safetyMargin)}</strong></li>
              <li class="flex justify-between gap-3"><span>Tarifa aplicada</span><strong>${formatCurrency(calc.assumptions.tariff)}/kWh</strong></li>
            </ul>
          </div>
          <div>
            <h3 class="text-xs font-bold uppercase tracking-wider text-muted">Observaciones</h3>
            <ul class="mt-2 space-y-2 text-xs leading-relaxed text-muted">
              ${calc.observations.map((item) => `<li class="flex gap-2">${icon('dot', 'mt-0.5 h-3.5 w-3.5 shrink-0 text-solar')}${escapeHtml(item)}</li>`).join('')}
            </ul>
          </div>
        </div>
      </div>
    </section>
  `;
}

function notesCard(request: Solicitud): string {
  const state = loadState();
  return `
    <section class="admin-card" aria-labelledby="notes-title">
      <div class="admin-card-header">
        <div>
          <h2 id="notes-title" class="admin-section-title">Notas internas</h2>
          <p class="admin-section-subtitle">Visibles solo para el equipo.</p>
        </div>
        <span class="admin-badge border-line bg-natural text-muted">${request.internalNotes.length}</span>
      </div>
      <div class="admin-card-body">
        ${
          canEdit()
            ? `<form id="note-form" class="mb-5">
                <label for="note-text" class="sr-only">Nueva nota interna</label>
                <textarea id="note-text" class="admin-textarea" rows="3" placeholder="Escribe una nota para el equipo…" required></textarea>
                <div class="mt-2 flex justify-end">
                  <button type="submit" class="admin-btn admin-btn-primary admin-btn-sm">
                    ${icon('plus', 'h-3.5 w-3.5')} Agregar nota
                  </button>
                </div>
              </form>`
            : ''
        }
        ${
          request.internalNotes.length
            ? `<ul class="space-y-4">
                ${request.internalNotes
                  .map((note) => {
                    const author = state.users.find((user) => user.id === note.authorId);
                    return `
                    <li class="flex gap-3">
                      <span class="admin-avatar h-8 w-8 text-[11px]" style="background-color:${author?.avatarColor ?? '#667085'}">
                        ${escapeHtml(avatarLetter(author ? `${author.firstName} ${author.lastName}` : 'Sistema'))}
                      </span>
                      <div class="min-w-0 flex-1 rounded-xl rounded-tl-none border border-line bg-natural/50 px-3.5 py-2.5">
                        <div class="flex flex-wrap items-center justify-between gap-2">
                          <p class="text-xs font-semibold text-charcoal">${escapeHtml(author ? `${author.firstName} ${author.lastName}` : 'Sistema')}</p>
                          <p class="text-[11px] text-muted" title="${formatDateTime(note.timestamp)}">${relativeTime(note.timestamp)}</p>
                        </div>
                        <p class="mt-1 whitespace-pre-line text-sm leading-relaxed text-charcoal/80">${escapeHtml(note.text)}</p>
                      </div>
                    </li>
                  `;
                  })
                  .join('')}
              </ul>`
            : emptyStateHtml({
                iconName: 'message',
                title: 'Sin notas internas',
                description: 'Agrega contexto, acuerdos o pendientes para el equipo.',
              })
        }
      </div>
    </section>
  `;
}

function activityCard(request: Solicitud): string {
  const state = loadState();
  const items = request.activities
    .slice()
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return `
    <section class="admin-card" aria-labelledby="activity-title">
      <div class="admin-card-header">
        <div>
          <h2 id="activity-title" class="admin-section-title">Bitácora de la solicitud</h2>
          <p class="admin-section-subtitle">Historial de cambios y comunicaciones.</p>
        </div>
      </div>
      <div class="admin-card-body">
        ${
          items.length
            ? `<ol class="relative space-y-5 border-l border-line pl-5">
                ${items
                  .map(
                    (item) => `
                  <li class="relative">
                    <span class="absolute -left-[27px] top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-white bg-forest"></span>
                    <div class="flex flex-wrap items-center justify-between gap-2">
                      <p class="text-sm font-semibold text-charcoal">${escapeHtml(item.title)}</p>
                      <p class="text-[11px] text-muted" title="${formatDateTime(item.timestamp)}">${relativeTime(item.timestamp)}</p>
                    </div>
                    ${item.description ? `<p class="mt-0.5 text-xs leading-relaxed text-muted">${escapeHtml(item.description)}</p>` : ''}
                    <p class="mt-1 text-[11px] font-medium text-muted">${escapeHtml(userName(state, item.actorId))}</p>
                  </li>
                `,
                  )
                  .join('')}
              </ol>`
            : emptyStateHtml({
                iconName: 'activity',
                title: 'Sin actividad registrada',
                description: 'Los movimientos de esta solicitud aparecerán en esta bitácora.',
              })
        }
      </div>
    </section>
  `;
}

function statusCard(request: Solicitud): string {
  const editable = canEdit();
  return `
    <section class="admin-card" aria-labelledby="status-card-title">
      <div class="admin-card-header">
        <h2 id="status-card-title" class="admin-section-title">Estado</h2>
        <span class="admin-badge ${REQUEST_STATUS_CLASS[request.status]}">${REQUEST_STATUS_LABEL[request.status]}</span>
      </div>
      <div class="admin-card-body space-y-4">
        <p class="text-xs leading-relaxed text-muted">${escapeHtml(STATUS_HINT[request.status])}</p>
        ${
          editable
            ? `<form id="status-form" class="space-y-3">
                <div>
                  <label for="status-select" class="admin-label">Cambiar estado</label>
                  <select id="status-select" class="admin-select">
                    ${REQUEST_STATUS_ORDER.map(
                      (status) =>
                        `<option value="${status}" ${status === request.status ? 'selected' : ''}>${REQUEST_STATUS_LABEL[status]}</option>`,
                    ).join('')}
                  </select>
                </div>
                <div>
                  <label for="status-note" class="admin-label">Nota del cambio (opcional)</label>
                  <textarea id="status-note" class="admin-textarea" rows="2" placeholder="Contexto del cambio de estado…"></textarea>
                </div>
                <button type="submit" class="admin-btn admin-btn-primary admin-btn-sm w-full">Actualizar estado</button>
              </form>`
            : ''
        }
        <dl class="space-y-2.5 border-t border-line pt-4 text-xs">
          <div class="flex justify-between gap-3"><dt class="text-muted">Folio</dt><dd class="font-mono font-semibold text-charcoal">${escapeHtml(request.folio)}</dd></div>
          <div class="flex justify-between gap-3"><dt class="text-muted">Creada</dt><dd class="font-medium text-charcoal">${formatDate(request.createdAt)}</dd></div>
          <div class="flex justify-between gap-3"><dt class="text-muted">Origen</dt><dd class="font-medium text-charcoal">${request.source === 'manual' ? 'Captura manual' : 'Sitio público'}</dd></div>
          ${request.rejectionReason ? `<div><dt class="text-muted">Motivo de rechazo</dt><dd class="mt-1 font-medium text-danger">${escapeHtml(request.rejectionReason)}</dd></div>` : ''}
        </dl>
      </div>
    </section>
  `;
}

function responsibleCard(request: Solicitud): string {
  const state = loadState();
  const responsible = state.users.find((user) => user.id === request.responsibleUserId);
  const role = responsible ? roleById(state, responsible.roleId) : undefined;
  return `
    <section class="admin-card" aria-labelledby="responsible-title">
      <div class="admin-card-header">
        <h2 id="responsible-title" class="admin-section-title">Responsable</h2>
        ${canEdit() ? `<button type="button" class="text-xs font-semibold text-forest hover:underline" data-assign>Cambiar</button>` : ''}
      </div>
      <div class="admin-card-body">
        ${
          responsible
            ? `<div class="flex items-center gap-3">
                <span class="admin-avatar h-11 w-11 text-sm" style="background-color:${responsible.avatarColor}">${escapeHtml(
                  avatarLetter(`${responsible.firstName} ${responsible.lastName}`),
                )}</span>
                <div class="min-w-0">
                  <p class="truncate text-sm font-semibold text-charcoal">${escapeHtml(`${responsible.firstName} ${responsible.lastName}`)}</p>
                  <p class="truncate text-xs text-muted">${escapeHtml(role?.name ?? 'Sin rol')}</p>
                  <a class="mt-0.5 block truncate text-[11px] text-muted hover:text-forest" href="mailto:${escapeHtml(responsible.email)}">${escapeHtml(responsible.email)}</a>
                </div>
              </div>`
            : `<div class="flex items-center gap-3 text-muted">
                <span class="flex h-11 w-11 items-center justify-center rounded-full bg-natural">${icon('userPlus', 'h-5 w-5')}</span>
                <div>
                  <p class="text-sm font-medium text-charcoal">Sin asignar</p>
                  <p class="text-xs">Asigna un asesor comercial.</p>
                </div>
              </div>`
        }
      </div>
    </section>
  `;
}

function actionsCard(request: Solicitud): string {
  if (!canEdit()) return '';
  const accepted = request.status === 'aceptada';
  const closed = ['convertida', 'rechazada'].includes(request.status);
  return `
    <section class="admin-card" aria-labelledby="actions-title">
      <div class="admin-card-header">
        <h2 id="actions-title" class="admin-section-title">Acciones</h2>
      </div>
      <div class="admin-card-body space-y-2">
        ${
          request.projectId
            ? `<a href="/admin/proyectos/${request.projectId}" class="admin-btn admin-btn-primary admin-btn-sm w-full">
                ${icon('kanban', 'h-4 w-4')} Ver proyecto ${escapeHtml(request.projectId)}
              </a>`
            : accepted
              ? `<button type="button" class="admin-btn admin-btn-primary admin-btn-sm w-full" data-convert>
                  ${icon('arrowRight', 'h-4 w-4')} Convertir en proyecto
                </button>`
              : `<button type="button" class="admin-btn admin-btn-success admin-btn-sm w-full" data-accept ${closed ? 'disabled' : ''}>
                  ${icon('checkCircle', 'h-4 w-4')} Marcar como aceptada
                </button>`
        }
        <button type="button" class="admin-btn admin-btn-secondary admin-btn-sm w-full" data-download-quote>
          ${icon('download', 'h-4 w-4')} Descargar cotización
        </button>
        <button type="button" class="admin-btn admin-btn-danger-soft admin-btn-sm w-full" data-reject ${closed ? 'disabled' : ''}>
          ${icon('xCircle', 'h-4 w-4')} Rechazar solicitud
        </button>
      </div>
    </section>
  `;
}

function projectCard(request: Solicitud): string {
  const state = loadState();
  const project = request.projectId ? state.projects.find((item) => item.id === request.projectId) : null;
  return `
    <section class="admin-card" aria-labelledby="project-link-title">
      <div class="admin-card-header">
        <h2 id="project-link-title" class="admin-section-title">Proyecto vinculado</h2>
      </div>
      <div class="admin-card-body">
        ${
          project
            ? `<a href="/admin/proyectos/${project.id}" class="block rounded-xl border border-line p-3 transition-colors hover:border-forest/30 hover:bg-natural/60">
                <p class="font-mono text-xs font-semibold text-forest">${escapeHtml(project.folio)}</p>
                <p class="mt-1 text-sm font-semibold text-charcoal">${escapeHtml(project.name)}</p>
                <p class="mt-0.5 text-xs text-muted">${escapeHtml(project.client.name)}</p>
                <div class="mt-2 flex items-center gap-2">
                  <div class="admin-progress flex-1"><div class="admin-progress-bar" style="width:${project.progress}%"></div></div>
                  <span class="text-[11px] font-semibold text-charcoal">${project.progress}%</span>
                </div>
              </a>`
            : `<div class="rounded-xl border border-dashed border-line p-4 text-center">
                <span class="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-natural text-muted">${icon('kanban', 'h-5 w-5')}</span>
                <p class="mt-2 text-sm font-medium text-charcoal">Sin proyecto vinculado</p>
                <p class="mt-0.5 text-xs text-muted">${request.status === 'aceptada' ? 'Puedes convertirla desde las acciones.' : 'Disponible cuando la solicitud sea aceptada.'}</p>
              </div>`
        }
      </div>
    </section>
  `;
}

function buildQuoteText(request: Solicitud): string {
  const calc = request.calculation;
  return [
    'ENERSOL · COTIZACIÓN PRELIMINAR',
    '================================',
    `Folio: ${request.folio}`,
    `Fecha: ${formatDate(request.createdAt)}`,
    '',
    'CLIENTE',
    `Nombre: ${request.client.name}`,
    request.client.company ? `Empresa: ${request.client.company}` : '',
    `Correo: ${request.client.email}`,
    `Teléfono: ${request.client.phone}`,
    `Ubicación: ${request.client.location}`,
    '',
    'SISTEMA PROPUESTO',
    `Tipo: ${SYSTEM_TYPE_LABEL[request.systemType]}`,
    `Capacidad instalada: ${calc.installedCapacityKwp} kWp`,
    `Paneles: ${calc.panelCount} × ${calc.panel.brand} ${calc.panel.model} (${calc.panel.watt} W)`,
    `Inversor: ${calc.inverter.brand} ${calc.inverter.model} (${calc.inverter.capacityKw} kW)`,
    calc.battery ? `Baterías: ${calc.batteryCount} × ${calc.battery.brand} ${calc.battery.model}` : '',
    '',
    'DESGLOSE',
    ...calc.lines.map((line) => `- ${line.concept}: ${formatCurrency(line.amount)}${line.detail ? ` (${line.detail})` : ''}`),
    '',
    `Subtotal: ${formatCurrency(calc.subtotal)}`,
    `Descuento: -${formatCurrency(calc.discount)}`,
    `IVA: ${formatCurrency(calc.tax)}`,
    `TOTAL ESTIMADO: ${formatCurrency(calc.total)}`,
    '',
    'BENEFICIOS ESTIMADOS',
    `Generación mensual: ${formatKwh(calc.generationMonthlyKwh)}`,
    `Cobertura: ${formatPercent(calc.coveragePercent)}`,
    `Ahorro mensual: ${formatCurrency(calc.savingsMonthly)}`,
    `Ahorro anual: ${formatCurrency(calc.savingsAnnual)}`,
    `Retorno de inversión: ${calc.paybackYears ? `${calc.paybackYears} años` : 'No calculado'}`,
    '',
    'SUPUESTOS',
    `Horas solares pico: ${calc.assumptions.peakSunHours}`,
    `Factor de rendimiento: ${calc.assumptions.performanceRatio}`,
    `Cobertura objetivo: ${calc.assumptions.coverageTarget}%`,
    `Tarifa: ${formatCurrency(calc.assumptions.tariff)}/kWh`,
    '',
    'OBSERVACIONES',
    ...calc.observations.map((item) => `- ${item}`),
    '',
    'ESTIMACIÓN PRELIMINAR. Requiere validación técnica en sitio. No representa una cotización en firme.',
  ]
    .filter(Boolean)
    .join('\n');
}

function bindNoteForm(request: Solicitud): void {
  const form = document.getElementById('note-form') as HTMLFormElement | null;
  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const textarea = document.getElementById('note-text') as HTMLTextAreaElement | null;
    if (!textarea?.value.trim()) return;
    try {
      addSolicitudNote(request.id, textarea.value.trim());
      toast('Nota interna agregada.', 'success');
      renderDetail();
    } catch (error) {
      toastError(error);
    }
  });
}

function bindStatusForm(request: Solicitud): void {
  const form = document.getElementById('status-form') as HTMLFormElement | null;
  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const select = document.getElementById('status-select') as HTMLSelectElement | null;
    const note = document.getElementById('status-note') as HTMLTextAreaElement | null;
    if (!select || select.value === request.status) {
      toast('Selecciona un estado diferente para actualizar.', 'info');
      return;
    }
    try {
      setSolicitudStatus(request.id, select.value as RequestStatus, note?.value.trim());
      toast('Estado de la solicitud actualizado.', 'success');
      renderDetail();
    } catch (error) {
      toastError(error);
    }
  });
}

function bindActions(request: Solicitud): void {
  document.querySelectorAll<HTMLElement>('[data-download-quote]').forEach((button) => {
    button.addEventListener('click', () => {
      downloadText(
        `Cotizacion-${request.folio}.txt`,
        buildQuoteText(request),
        'text/plain;charset=utf-8;',
      );
      toast('Se descargó un resumen de la cotización preliminar.', 'success');
    });
  });

  document.querySelectorAll<HTMLElement>('[data-recalculate]').forEach((button) => {
    button.addEventListener('click', () => {
      try {
        const updated = recalculateSolicitud(request.id);
        toast(`Cotización recalculada: ${formatCurrency(updated.calculation.total)}.`, 'success');
        renderDetail();
      } catch (error) {
        toastError(error);
      }
    });
  });

  document.querySelectorAll<HTMLElement>('[data-assign]').forEach((button) => {
    button.addEventListener('click', () => openAssignModal(request, renderDetail));
  });

  document.querySelectorAll<HTMLElement>('[data-accept]').forEach((button) => {
    button.addEventListener('click', async () => {
      const confirmed = await confirmDialog({
        title: 'Marcar como aceptada',
        message: `Confirma que ${request.client.name} aceptó la propuesta. Después podrás convertir la solicitud en proyecto.`,
        confirmLabel: 'Sí, aceptada',
        tone: 'success',
      });
      if (!confirmed) return;
      try {
        acceptSolicitud(request.id);
        toast('La solicitud se marcó como aceptada.', 'success');
        renderDetail();
      } catch (error) {
        toastError(error);
      }
    });
  });

  document.querySelectorAll<HTMLElement>('[data-reject]').forEach((button) => {
    button.addEventListener('click', () => {
      if (request.status === 'convertida') {
        toast('No puedes rechazar una solicitud ya convertida.', 'warning');
        return;
      }
      openRejectModal(request, renderDetail);
    });
  });

  document.querySelectorAll<HTMLElement>('[data-convert]').forEach((button) => {
    button.addEventListener('click', () => openConvertModal(request));
  });

  document.querySelectorAll<HTMLElement>('[data-copy-folio]').forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(request.folio);
        toast('Folio copiado al portapapeles.', 'success');
      } catch {
        toast('No se pudo copiar el folio.', 'error');
      }
    });
  });
}

export function renderDetail(): void {
  const state = loadState();
  const request = state.solicitudes.find((item) => item.id === requestId());
  if (!request) {
    const main = document.getElementById('detail-main');
    const sidebar = document.getElementById('detail-sidebar');
    if (main) {
      main.innerHTML = emptyStateHtml({
        iconName: 'alert',
        title: 'No encontramos la solicitud',
        description: 'El registro no existe en este navegador o fue eliminado.',
        action: '<a href="/admin/solicitudes" class="admin-btn admin-btn-primary admin-btn-sm">Volver a solicitudes</a>',
      });
    }
    if (sidebar) sidebar.innerHTML = '';
    return;
  }
  currentRequest = request;
  renderHeader(request);
  const main = document.getElementById('detail-main');
  const sidebar = document.getElementById('detail-sidebar');
  if (main) {
    main.innerHTML = [
      clientCard(request),
      energyCard(request),
      quoteCard(request),
      notesCard(request),
      activityCard(request),
    ].join('');
  }
  if (sidebar) {
    sidebar.innerHTML = [
      statusCard(request),
      responsibleCard(request),
      actionsCard(request),
      projectCard(request),
    ].join('');
  }
  bindActions(request);
  bindNoteForm(request);
  bindStatusForm(request);
}

export function initSolicitudDetail(): void {
  renderDetail();
  document.querySelectorAll<HTMLElement>('[data-detail-assign]').forEach((button) => {
    button.addEventListener('click', () => {
      if (currentRequest) openAssignModal(currentRequest, renderDetail);
    });
  });
  document.querySelectorAll<HTMLElement>('[data-detail-convert]').forEach((button) => {
    button.addEventListener('click', () => {
      if (currentRequest) openConvertModal(currentRequest);
    });
  });
}
