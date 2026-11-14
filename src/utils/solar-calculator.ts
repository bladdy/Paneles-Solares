import type {
  Battery,
  Inverter,
  ProjectTypeRule,
  SolarConfig,
  SolarEstimate,
  SolarInput,
  SolarPanel,
} from '../types/solar';

export class SolarCalculationError extends Error {
  code: string;

  constructor(message: string, code = 'CALCULO_INVALIDO') {
    super(message);
    this.name = 'SolarCalculationError';
    this.code = code;
  }
}

const round = (value: number, decimals = 0) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const isPositive = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

function activePanels(config: SolarConfig): SolarPanel[] {
  return config.panels.filter((panel) => panel.active && isPositive(panel.watt));
}

function activeInverters(config: SolarConfig): Inverter[] {
  return config.inverters.filter((inverter) => inverter.active && isPositive(inverter.capacityKw));
}

function activeBatteries(config: SolarConfig): Battery[] {
  return config.batteries.filter((battery) => battery.active && isPositive(battery.capacityKwh));
}

function resolveRule(config: SolarConfig, projectType: SolarInput['projectType']): ProjectTypeRule {
  const rule = config.projectTypes?.[projectType];
  if (!rule) {
    throw new SolarCalculationError('El tipo de proyecto no tiene parámetros configurados.', 'TIPO_INVALIDO');
  }
  return rule;
}

export function calculateSolarEstimate(input: SolarInput, config: SolarConfig): SolarEstimate {
  const rule = resolveRule(config, input.projectType);
  const monthly = Number(input.monthlyConsumptionKwh);

  if (!isPositive(monthly)) {
    throw new SolarCalculationError(
      'Ingresa un consumo mensual mayor a cero para calcular el sistema.',
      'CONSUMO_INVALIDO',
    );
  }

  const peakSunHours = config.general.peakSunHours;
  const performanceRatio = config.general.performanceRatio;
  if (!isPositive(peakSunHours) || !isPositive(performanceRatio)) {
    throw new SolarCalculationError(
      'Los parámetros de horas solares o rendimiento no son válidos.',
      'CONFIGURACION_INVALIDA',
    );
  }

  const coverage = Math.min(Math.max(rule.coverageTarget || 100, 1), 150);
  const safety = Math.max(rule.safetyMargin || 0, 0);
  const dailyConsumption = monthly / 30;

  const requiredPowerKw =
    (monthly * (coverage / 100)) / (peakSunHours * 30 * performanceRatio) * (1 + safety / 100);

  const panels = activePanels(config);
  if (panels.length === 0) {
    throw new SolarCalculationError(
      'No hay paneles solares activos en el catálogo. Configura al menos uno para cotizar.',
      'SIN_PANELES',
    );
  }

  const panel =
    panels.find((item) => item.id === rule.preferredPanelId) ??
    panels.slice().sort((a, b) => b.efficiency - a.efficiency)[0];

  const rawPanelCount = (requiredPowerKw * 1000) / panel.watt;
  const panelCount = Math.max(1, Math.ceil(rawPanelCount));
  const installedCapacityKwp = (panelCount * panel.watt) / 1000;
  const generationMonthlyKwh = installedCapacityKwp * peakSunHours * 30 * performanceRatio;

  const inverters = activeInverters(config);
  if (inverters.length === 0) {
    throw new SolarCalculationError(
      'No hay inversores activos en el catálogo. Configura al menos uno para cotizar.',
      'SIN_INVERSORES',
    );
  }

  const hybridPool = inverters.filter((item) => item.type === 'hibrido');
  const inverterPool =
    input.systemType !== 'interconectado' && hybridPool.length > 0
      ? hybridPool
      : inverters;
  const sortedInverters = inverterPool.slice().sort((a, b) => a.capacityKw - b.capacityKw);
  const requiredInverter = installedCapacityKwp * 1.15;
  const exactInverter = sortedInverters.find((item) => item.capacityKw >= requiredInverter);
  const inverter = exactInverter ?? sortedInverters[sortedInverters.length - 1];
  const inverterUndersized = !exactInverter;

  let battery: Battery | undefined;
  let batteryCount = 0;
  const hasBackup = input.systemType !== 'interconectado';
  if (hasBackup) {
    const batteries = activeBatteries(config);
    if (batteries.length > 0) {
      battery = batteries.slice().sort((a, b) => b.capacityKwh - a.capacityKwh)[0];
      const backupLoad = input.backupLoadKw && input.backupLoadKw > 0 ? input.backupLoadKw : dailyConsumption * 0.35;
      const backupHours = input.backupHours && input.backupHours > 0 ? input.backupHours : 4;
      const requiredBatteryEnergy = (backupLoad * backupHours) / (0.85 * 0.9);
      batteryCount = Math.max(1, Math.ceil(requiredBatteryEnergy / battery.capacityKwh));
    }
  }

  const tariff = isPositive(input.tariff)
    ? input.tariff
    : isPositive(input.monthlyBill)
      ? input.monthlyBill / monthly
      : config.general.defaultTariff;

  const panelCost = panelCount * panel.price;
  const inverterCost = inverter.price;
  const batteryCost = battery ? batteryCount * battery.price : 0;
  const equipmentCost = panelCost + inverterCost + batteryCost;

  const installationCost =
    config.installation.laborPerKwp * installedCapacityKwp +
    config.installation.structurePerKwp * installedCapacityKwp +
    config.installation.wiringPerKwp * installedCapacityKwp +
    config.installation.protections +
    config.installation.installationBase +
    config.installation.transport +
    config.installation.other;

  const multiplier = rule.priceMultiplier > 0 ? rule.priceMultiplier : 1;
  const lines = [];
  let baseCost = 0;

  if (config.pricing.usePricePerWatt && isPositive(config.pricing.pricePerWatt)) {
    const pvTurnkey = installedCapacityKwp * 1000 * config.pricing.pricePerWatt * multiplier;
    baseCost = pvTurnkey + batteryCost;
    lines.push({
      concept: 'Sistema fotovoltaico llave en mano',
      detail: `${round(installedCapacityKwp, 2)} kWp × $${config.pricing.pricePerWatt}/W`,
      amount: round(pvTurnkey),
    });
    if (battery) {
      lines.push({
        concept: 'Banco de baterías',
        detail: `${batteryCount} × ${battery.brand} ${battery.model}`,
        amount: round(batteryCost),
      });
    }
  } else {
    baseCost = (panelCost + inverterCost + installationCost) * multiplier + batteryCost;
    lines.push({
      concept: `Paneles solares ${panel.brand} ${panel.model}`,
      detail: `${panelCount} unidades × ${panel.watt} W`,
      amount: round(panelCost),
    });
    lines.push({
      concept: `Inversor ${inverter.brand} ${inverter.model}`,
      detail: `${inverter.capacityKw} kW · ${inverter.type}`,
      amount: round(inverterCost),
    });
    if (battery) {
      lines.push({
        concept: 'Banco de baterías',
        detail: `${batteryCount} × ${battery.brand} ${battery.model} (${battery.capacityKwh} kWh)`,
        amount: round(batteryCost),
      });
    }
    lines.push({
      concept: 'Mano de obra especializada',
      detail: `${round(installedCapacityKwp, 2)} kWp`,
      amount: round(config.installation.laborPerKwp * installedCapacityKwp),
    });
    lines.push({
      concept: 'Estructura de montaje',
      detail: `${round(installedCapacityKwp, 2)} kWp`,
      amount: round(config.installation.structurePerKwp * installedCapacityKwp),
    });
    lines.push({
      concept: 'Cableado y canalización',
      detail: `${round(installedCapacityKwp, 2)} kWp`,
      amount: round(config.installation.wiringPerKwp * installedCapacityKwp),
    });
    lines.push({
      concept: 'Protecciones eléctricas',
      amount: round(config.installation.protections),
    });
    lines.push({
      concept: 'Instalación y puesta en marcha',
      amount: round(config.installation.installationBase),
    });
    lines.push({
      concept: 'Transporte y logística',
      amount: round(config.installation.transport),
    });
    lines.push({
      concept: 'Otros conceptos',
      amount: round(config.installation.other),
    });
    if (multiplier !== 1) {
      lines.push({
        concept: 'Ajuste por tipo de proyecto',
        detail: `${multiplier > 1 ? '+' : ''}${round((multiplier - 1) * 100, 1)}%`,
        amount: round((panelCost + inverterCost + installationCost) * (multiplier - 1)),
      });
    }
  }

  const marginPercent = Math.max(config.pricing.marginPercent, 0);
  const discountPercent = Math.min(Math.max(config.pricing.discountPercent, 0), 100);
  const taxPercent = Math.max(config.pricing.taxPercent, 0);

  const margin = baseCost * (marginPercent / 100);
  const subtotal = baseCost + margin;
  const discount = subtotal * (discountPercent / 100);
  const taxable = subtotal - discount;
  const tax = taxable * (taxPercent / 100);
  const total = taxable + tax;

  const selfConsumed = Math.min(generationMonthlyKwh, monthly);
  let savingsMonthly = selfConsumed * tariff;
  if (isPositive(input.monthlyBill)) {
    savingsMonthly = Math.min(savingsMonthly, input.monthlyBill);
  }
  const savingsAnnual = savingsMonthly * 12;
  const paybackYears = savingsAnnual > 0 ? total / savingsAnnual : null;
  const coveragePercent = Math.min(100, (generationMonthlyKwh / monthly) * 100);
  const panelAreaM2 = panelCount * 2.3;

  const observations: string[] = [
    'Estimación preliminar generada con parámetros de demostración. Requiere validación técnica en sitio antes de cotizar en firme.',
  ];

  if (installedCapacityKwp > 0) {
    observations.push(
      `Se estiman ${panelCount} paneles de ${panel.watt} W, con un área aproximada de ${round(panelAreaM2)} m² en techo.`,
    );
  }
  if (inverterUndersized) {
    observations.push(
      'La capacidad del inversor más grande del catálogo no cubre el 115% del sistema. Revisa el catálogo o divide el sistema en varios inversores.',
    );
  }
  if (hasBackup && !battery) {
    observations.push(
      'No hay baterías activas en la configuración, por lo que el respaldo no se incluyó en el precio.',
    );
  }
  if (hasBackup && battery) {
    observations.push(
      `Respaldo estimado para ${input.backupHours ?? 4} h con ${batteryCount} batería(s) ${battery.brand} ${battery.model}.`,
    );
  }
  if (input.tariff === undefined || !isPositive(input.tariff)) {
    observations.push(
      `El ahorro se calculó con la tarifa configurada de $${round(tariff, 2)} por kWh. Ajusta la tarifa para mayor precisión.`,
    );
  }
  if (coveragePercent < 70) {
    observations.push(
      `La generación estimada cubre el ${round(coveragePercent)}% del consumo mensual. Revisa la cobertura objetivo si necesitas mayor independencia.`,
    );
  }

  return {
    monthlyConsumptionKwh: round(monthly, 1),
    dailyConsumptionKwh: round(dailyConsumption, 1),
    requiredPowerKw: round(requiredPowerKw, 2),
    panel,
    panelCount,
    panelAreaM2: round(panelAreaM2, 1),
    installedCapacityKwp: round(installedCapacityKwp, 2),
    inverter,
    battery,
    batteryCount,
    generationMonthlyKwh: round(generationMonthlyKwh),
    coveragePercent: round(coveragePercent),
    savingsMonthly: round(savingsMonthly),
    savingsAnnual: round(savingsAnnual),
    equipmentCost: round(equipmentCost),
    installationCost: round(installationCost),
    baseCost: round(baseCost),
    margin: round(margin),
    subtotal: round(subtotal),
    discount: round(discount),
    tax: round(tax),
    total: round(total),
    paybackYears: paybackYears ? round(paybackYears, 1) : null,
    lines,
    observations,
    assumptions: {
      peakSunHours,
      performanceRatio,
      coverageTarget: coverage,
      safetyMargin: safety,
      tariff: round(tariff, 2),
      priceMode: config.pricing.usePricePerWatt ? 'precio-por-watt' : 'costo-desglosado',
    },
  };
}

export function validateSolarConfig(config: SolarConfig): string[] {
  const errors: string[] = [];
  const general = config.general;

  if (!isPositive(general.peakSunHours) || general.peakSunHours > 10) {
    errors.push('Las horas solares pico deben estar entre 0 y 10.');
  }
  if (!isPositive(general.performanceRatio) || general.performanceRatio > 1) {
    errors.push('El factor de rendimiento debe estar entre 0.01 y 1.');
  }
  if (!isPositive(general.coverageTarget) || general.coverageTarget > 150) {
    errors.push('La cobertura objetivo debe estar entre 1% y 150%.');
  }
  if (general.safetyMargin < 0 || general.safetyMargin > 100) {
    errors.push('El margen de seguridad debe estar entre 0% y 100%.');
  }
  if (general.taxPercent < 0 || general.taxPercent > 100) {
    errors.push('El impuesto debe estar entre 0% y 100%.');
  }
  if (general.defaultTariff < 0) {
    errors.push('La tarifa de referencia no puede ser negativa.');
  }
  if (activePanels(config).length === 0) {
    errors.push('Debe existir al menos un panel solar activo.');
  }
  if (activeInverters(config).length === 0) {
    errors.push('Debe existir al menos un inversor activo.');
  }
  if (config.panels.some((item) => item.price < 0 || item.watt <= 0)) {
    errors.push('Revisa los precios y potencias del catálogo de paneles.');
  }
  if (config.inverters.some((item) => item.price < 0 || item.capacityKw <= 0)) {
    errors.push('Revisa los precios y capacidades del catálogo de inversores.');
  }
  if (config.batteries.some((item) => item.price < 0 || item.capacityKwh <= 0)) {
    errors.push('Revisa los precios y capacidades del catálogo de baterías.');
  }
  if (config.pricing.marginPercent < 0 || config.pricing.marginPercent > 300) {
    errors.push('El margen de utilidad debe estar entre 0% y 300%.');
  }
  if (config.pricing.discountPercent < 0 || config.pricing.discountPercent > 100) {
    errors.push('El descuento debe estar entre 0% y 100%.');
  }
  if (config.pricing.usePricePerWatt && !isPositive(config.pricing.pricePerWatt)) {
    errors.push('El precio por watt debe ser mayor a cero cuando está activo.');
  }

  (Object.keys(config.projectTypes) as Array<keyof typeof config.projectTypes>).forEach((key) => {
    const rule = config.projectTypes[key];
    if (rule.coverageTarget <= 0 || rule.coverageTarget > 150) {
      errors.push(`La cobertura de ${key} debe estar entre 1% y 150%.`);
    }
    if (rule.safetyMargin < 0 || rule.safetyMargin > 100) {
      errors.push(`El margen de seguridad de ${key} debe estar entre 0% y 100%.`);
    }
    if (rule.priceMultiplier <= 0) {
      errors.push(`El multiplicador de precio de ${key} debe ser mayor a cero.`);
    }
  });

  return errors;
}
