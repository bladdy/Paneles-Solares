import type { ChartPoint } from '../../utils/metrics';
import { escapeHtml, formatNumber } from '../../utils/format';

const DEFAULT_COLORS = ['#123B2A', '#F5B82E', '#175CD3', '#067647', '#B54708', '#9333EA', '#0F766E'];

function normalize(points: ChartPoint[]): ChartPoint[] {
  return points.filter((point) => Number.isFinite(point.value));
}

function niceMax(value: number): number {
  if (value <= 0) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

/* ------------------------------------------------------------------ */
/* Gráfica de área / línea                                             */
/* ------------------------------------------------------------------ */

export function areaChart(
  points: ChartPoint[],
  options: { height?: number; color?: string; valueFormatter?: (value: number) => string } = {},
): string {
  const data = normalize(points);
  if (data.length === 0) {
    return `<div class="flex h-48 items-center justify-center text-sm text-muted">Sin datos disponibles</div>`;
  }
  const width = 640;
  const height = options.height ?? 220;
  const padding = { top: 16, right: 12, bottom: 28, left: 36 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const max = niceMax(Math.max(...data.map((point) => point.value)) * 1.1);
  const color = options.color ?? '#123B2A';
  const formatter = options.valueFormatter ?? ((value: number) => formatNumber(value));

  const stepX = data.length > 1 ? plotWidth / (data.length - 1) : 0;
  const coords = data.map((point, index) => ({
    x: padding.left + index * stepX,
    y: padding.top + plotHeight - (point.value / max) * plotHeight,
    ...point,
  }));

  const linePath = coords
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(' ');
  const areaPath = `${linePath} L${coords[coords.length - 1].x.toFixed(1)},${(padding.top + plotHeight).toFixed(
    1,
  )} L${coords[0].x.toFixed(1)},${(padding.top + plotHeight).toFixed(1)} Z`;

  const gridLines = Array.from({ length: 5 }, (_, index) => {
    const y = padding.top + (plotHeight / 4) * index;
    const value = max - (max / 4) * index;
    return `
      <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="#E4E7EC" stroke-width="1" stroke-dasharray="${
        index === 4 ? '0' : '3 4'
      }" />
      <text x="${padding.left - 8}" y="${y + 4}" text-anchor="end" font-size="10" fill="#98A2B3">${formatter(value)}</text>
    `;
  }).join('');

  const dots = coords
    .map(
      (point) => `
      <circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="3.5" fill="#fff" stroke="${color}" stroke-width="2">
        <title>${escapeHtml(point.label)}: ${formatter(point.value)}</title>
      </circle>
    `,
    )
    .join('');

  const labels = coords
    .map(
      (point) =>
        `<text x="${point.x.toFixed(1)}" y="${height - 8}" text-anchor="middle" font-size="10" fill="#667085">${escapeHtml(
          point.label,
        )}</text>`,
    )
    .join('');

  const gradientId = `area-grad-${Math.random().toString(36).slice(2, 8)}`;

  return `
    <svg viewBox="0 0 ${width} ${height}" class="h-auto w-full" role="img" aria-label="Gráfica de tendencia" preserveAspectRatio="none">
      <defs>
        <linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${color}" stop-opacity="0.22" />
          <stop offset="100%" stop-color="${color}" stop-opacity="0.01" />
        </linearGradient>
      </defs>
      ${gridLines}
      <path d="${areaPath}" fill="url(#${gradientId})" />
      <path d="${linePath}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
      ${dots}
      ${labels}
    </svg>
  `;
}

/* ------------------------------------------------------------------ */
/* Gráfica de barras                                                   */
/* ------------------------------------------------------------------ */

export function barChart(
  points: ChartPoint[],
  options: { height?: number; color?: string; valueFormatter?: (value: number) => string } = {},
): string {
  const data = normalize(points);
  if (data.length === 0) {
    return `<div class="flex h-48 items-center justify-center text-sm text-muted">Sin datos disponibles</div>`;
  }
  const width = 640;
  const height = options.height ?? 220;
  const padding = { top: 16, right: 12, bottom: 30, left: 40 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const max = niceMax(Math.max(...data.map((point) => point.value)) * 1.1);
  const color = options.color ?? '#F5B82E';
  const formatter = options.valueFormatter ?? ((value: number) => formatNumber(value));
  const slot = plotWidth / data.length;
  const barWidth = Math.min(slot * 0.52, 46);

  const gridLines = Array.from({ length: 5 }, (_, index) => {
    const y = padding.top + (plotHeight / 4) * index;
    const value = max - (max / 4) * index;
    return `
      <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="#E4E7EC" stroke-width="1" stroke-dasharray="${
        index === 4 ? '0' : '3 4'
      }" />
      <text x="${padding.left - 8}" y="${y + 4}" text-anchor="end" font-size="10" fill="#98A2B3">${formatter(value)}</text>
    `;
  }).join('');

  const bars = data
    .map((point, index) => {
      const barHeight = max > 0 ? (point.value / max) * plotHeight : 0;
      const x = padding.left + slot * index + (slot - barWidth) / 2;
      const y = padding.top + plotHeight - barHeight;
      return `
        <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${Math.max(
          barHeight,
          2,
        ).toFixed(1)}" rx="5" fill="${point.color ?? color}">
          <title>${escapeHtml(point.label)}: ${formatter(point.value)}</title>
        </rect>
        <text x="${(x + barWidth / 2).toFixed(1)}" y="${height - 9}" text-anchor="middle" font-size="10" fill="#667085">${escapeHtml(
          point.label,
        )}</text>
      `;
    })
    .join('');

  return `
    <svg viewBox="0 0 ${width} ${height}" class="h-auto w-full" role="img" aria-label="Gráfica de barras" preserveAspectRatio="none">
      ${gridLines}
      ${bars}
    </svg>
  `;
}

/* ------------------------------------------------------------------ */
/* Gráfica de dona                                                     */
/* ------------------------------------------------------------------ */

export function donutChart(
  points: ChartPoint[],
  options: { size?: number; thickness?: number; centerLabel?: string; centerValue?: string } = {},
): string {
  const data = normalize(points).filter((point) => point.value > 0);
  if (data.length === 0) {
    return `<div class="flex h-48 items-center justify-center text-sm text-muted">Sin datos disponibles</div>`;
  }
  const size = options.size ?? 200;
  const thickness = options.thickness ?? 22;
  const radius = (size - thickness) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  const total = data.reduce((sum, point) => sum + point.value, 0);
  let offset = 0;

  const segments = data
    .map((point, index) => {
      const fraction = point.value / total;
      const dash = fraction * circumference;
      const gap = 2;
      const segment = `
        <circle
          cx="${center}" cy="${center}" r="${radius}"
          fill="none"
          stroke="${point.color ?? DEFAULT_COLORS[index % DEFAULT_COLORS.length]}"
          stroke-width="${thickness}"
          stroke-dasharray="${Math.max(dash - gap, 0).toFixed(1)} ${(circumference - Math.max(dash - gap, 0)).toFixed(1)}"
          stroke-dashoffset="${(-offset).toFixed(1)}"
          stroke-linecap="round"
          transform="rotate(-90 ${center} ${center})"
        >
          <title>${escapeHtml(point.label)}: ${formatNumber(point.value)}</title>
        </circle>
      `;
      offset += dash;
      return segment;
    })
    .join('');

  const centerValue = options.centerValue ?? formatNumber(total);
  const centerLabel = options.centerLabel ?? 'Total';

  return `
    <div class="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" class="shrink-0" role="img" aria-label="Gráfica de distribución">
        <circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="#F1F3F2" stroke-width="${thickness}" />
        ${segments}
        <text x="${center}" y="${center - 4}" text-anchor="middle" font-size="22" font-weight="700" fill="#123B2A" font-family="Manrope, Inter, sans-serif">${escapeHtml(
          centerValue,
        )}</text>
        <text x="${center}" y="${center + 15}" text-anchor="middle" font-size="11" fill="#667085">${escapeHtml(centerLabel)}</text>
      </svg>
      <ul class="w-full min-w-0 space-y-2">
        ${data
          .map(
            (point, index) => `
          <li class="flex items-center justify-between gap-3 text-sm">
            <span class="flex min-w-0 items-center gap-2">
              <span class="h-2.5 w-2.5 shrink-0 rounded-full" style="background-color:${
                point.color ?? DEFAULT_COLORS[index % DEFAULT_COLORS.length]
              }"></span>
              <span class="truncate text-charcoal/80">${escapeHtml(point.label)}</span>
            </span>
            <span class="shrink-0 font-semibold text-charcoal">${formatNumber(point.value)}</span>
          </li>
        `,
          )
          .join('')}
      </ul>
    </div>
  `;
}

/* ------------------------------------------------------------------ */
/* Barra de progreso vertical para embudo                              */
/* ------------------------------------------------------------------ */

export function funnelRows(
  points: ChartPoint[],
  options: { valueFormatter?: (value: number) => string } = {},
): string {
  const data = normalize(points);
  if (data.length === 0) {
    return `<p class="py-8 text-center text-sm text-muted">Sin datos disponibles</p>`;
  }
  const max = Math.max(...data.map((point) => point.value), 1);
  const formatter = options.valueFormatter ?? ((value: number) => formatNumber(value));
  return `
    <ul class="space-y-3">
      ${data
        .map(
          (point, index) => `
        <li>
          <div class="mb-1 flex items-center justify-between gap-3 text-xs">
            <span class="font-medium text-charcoal/80">${escapeHtml(point.label)}</span>
            <span class="font-semibold text-charcoal">${formatter(point.value)}</span>
          </div>
          <div class="h-2 w-full overflow-hidden rounded-full bg-natural">
            <div class="h-full rounded-full" style="width:${Math.max(
              (point.value / max) * 100,
              point.value > 0 ? 4 : 0,
            ).toFixed(1)}%;background-color:${point.color ?? DEFAULT_COLORS[index % DEFAULT_COLORS.length]}"></div>
          </div>
        </li>
      `,
        )
        .join('')}
    </ul>
  `;
}
