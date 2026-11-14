export type ProjectType = 'residencial' | 'comercial' | 'industrial' | 'respaldo';
export type SystemType = 'interconectado' | 'baterias' | 'hibrido';
export type InverterType = 'string' | 'micro' | 'hibrido';
export type BatteryType = 'litio' | 'gel' | 'agm';

export interface SolarPanel {
  id: string;
  brand: string;
  model: string;
  watt: number;
  price: number;
  efficiency: number;
  active: boolean;
}

export interface Inverter {
  id: string;
  brand: string;
  model: string;
  capacityKw: number;
  price: number;
  type: InverterType;
  active: boolean;
}

export interface Battery {
  id: string;
  brand: string;
  model: string;
  capacityKwh: number;
  price: number;
  type: BatteryType;
  active: boolean;
}

export interface InstallationCosts {
  laborPerKwp: number;
  structurePerKwp: number;
  wiringPerKwp: number;
  protections: number;
  installationBase: number;
  transport: number;
  other: number;
}

export interface PricingRules {
  usePricePerWatt: boolean;
  pricePerWatt: number;
  marginPercent: number;
  discountPercent: number;
  taxPercent: number;
}

export interface ProjectTypeRule {
  coverageTarget: number;
  safetyMargin: number;
  preferredPanelId: string;
  preferredInverterId: string;
  priceMultiplier: number;
}

export interface SolarConfig {
  general: {
    peakSunHours: number;
    performanceRatio: number;
    coverageTarget: number;
    safetyMargin: number;
    currency: string;
    taxPercent: number;
    defaultTariff: number;
  };
  panels: SolarPanel[];
  inverters: Inverter[];
  batteries: Battery[];
  installation: InstallationCosts;
  pricing: PricingRules;
  projectTypes: Record<ProjectType, ProjectTypeRule>;
}

export interface SolarInput {
  projectType: ProjectType;
  monthlyConsumptionKwh: number;
  monthlyBill?: number;
  tariff?: number;
  systemType: SystemType;
  backupHours?: number;
  backupLoadKw?: number;
}

export interface EstimateLine {
  concept: string;
  detail?: string;
  amount: number;
}

export interface EstimateAssumptions {
  peakSunHours: number;
  performanceRatio: number;
  coverageTarget: number;
  safetyMargin: number;
  tariff: number;
  priceMode: 'costo-desglosado' | 'precio-por-watt';
}

export interface SolarEstimate {
  monthlyConsumptionKwh: number;
  dailyConsumptionKwh: number;
  requiredPowerKw: number;
  panel: SolarPanel;
  panelCount: number;
  panelAreaM2: number;
  installedCapacityKwp: number;
  inverter: Inverter;
  battery?: Battery;
  batteryCount: number;
  generationMonthlyKwh: number;
  coveragePercent: number;
  savingsMonthly: number;
  savingsAnnual: number;
  equipmentCost: number;
  installationCost: number;
  baseCost: number;
  margin: number;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paybackYears: number | null;
  lines: EstimateLine[];
  observations: string[];
  assumptions: EstimateAssumptions;
}
