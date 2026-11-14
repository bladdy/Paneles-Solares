import type {
  ActivityEntry,
  BackupInfo,
  ClientInfo,
  InternalNote,
  RequestStatus,
  Solicitud,
} from '../../types/admin';
import type { ProjectType, SystemType } from '../../types/solar';
import { DEFAULT_CONFIG } from '../../data/cotizador-defaults';
import { calculateSolarEstimate } from '../../utils/solar-calculator';

interface SeedProfile {
  id: string;
  folio: string;
  createdAt: string;
  status: RequestStatus;
  source: 'sitio-publico' | 'manual';
  client: ClientInfo;
  projectType: ProjectType;
  monthlyConsumptionKwh: number;
  billAmount: number;
  tariff: number;
  propertyType: string;
  roofAreaM2: number;
  roofType: string;
  orientation: string;
  systemType: SystemType;
  backup?: BackupInfo;
  responsibleUserId: string | null;
  projectId: string | null;
  rejectionReason?: string;
  notes?: Array<{ authorId: string; text: string; at: string }>;
}

const PROFILES: SeedProfile[] = [
  {
    id: 'SOL-2026-001',
    folio: 'SOL-2026-001',
    createdAt: '2026-11-12T16:40:00',
    status: 'nueva',
    source: 'sitio-publico',
    client: {
      name: 'Laura Gutiérrez',
      email: 'laura.gutierrez@example.com',
      phone: '+52 55 4821 7365',
      location: 'Coyoacán, CDMX',
      propertyType: 'Casa habitación',
      comments: 'Busco reducir el recibo de verano. El techo recibe sol la mayor parte del día.',
    },
    projectType: 'residencial',
    monthlyConsumptionKwh: 620,
    billAmount: 2450,
    tariff: 3.2,
    propertyType: 'Casa habitación',
    roofAreaM2: 48,
    roofType: 'Losa de concreto',
    orientation: 'Sur',
    systemType: 'interconectado',
    responsibleUserId: 'usr-comercial',
    projectId: null,
  },
  {
    id: 'SOL-2026-002',
    folio: 'SOL-2026-002',
    createdAt: '2026-11-10T10:15:00',
    status: 'en-revision',
    source: 'sitio-publico',
    client: {
      name: 'Arturo Beltrán',
      company: 'Grupo Ferretero del Valle',
      email: 'abeltran@ferreterodelvalle.mx',
      phone: '+52 55 5632 8814',
      location: 'Iztapalapa, CDMX',
      propertyType: 'Local comercial',
      comments: 'Sucursal con tres cámaras de refrigeración y área de venta.',
    },
    projectType: 'comercial',
    monthlyConsumptionKwh: 2450,
    billAmount: 9800,
    tariff: 3.45,
    propertyType: 'Local comercial',
    roofAreaM2: 180,
    roofType: 'Lámina galvanizada',
    orientation: 'Poniente',
    systemType: 'interconectado',
    responsibleUserId: 'usr-comercial-2',
    projectId: null,
    notes: [
      {
        authorId: 'usr-comercial-2',
        text: 'Solicité el último recibo CFE y el plano de la azotea para revisar el área útil.',
        at: '2026-11-10T13:20:00',
      },
    ],
  },
  {
    id: 'SOL-2026-003',
    folio: 'SOL-2026-003',
    createdAt: '2026-10-22T09:05:00',
    status: 'cotizacion-enviada',
    source: 'sitio-publico',
    client: {
      name: 'Patricia Solís',
      company: 'Talleres Industriales Nova',
      email: 'psolis@talleresnova.mx',
      phone: '+52 55 5398 4421',
      location: 'Tlalnepantla, Edo. Méx.',
      propertyType: 'Nave industrial',
      comments: 'Operación de dos turnos, interés en reducir el pico de demanda.',
    },
    projectType: 'industrial',
    monthlyConsumptionKwh: 8600,
    billAmount: 38500,
    tariff: 4.1,
    propertyType: 'Nave industrial',
    roofAreaM2: 620,
    roofType: 'Lámina estructural',
    orientation: 'Sur-poniente',
    systemType: 'interconectado',
    responsibleUserId: 'usr-comercial',
    projectId: null,
  },
  {
    id: 'SOL-2026-004',
    folio: 'SOL-2026-004',
    createdAt: '2026-11-05T18:25:00',
    status: 'pendiente-info',
    source: 'sitio-publico',
    client: {
      name: 'Ricardo y Elena Domínguez',
      email: 'ricardo.dominguez@example.com',
      phone: '+52 55 4471 9082',
      location: 'Naucalpan, Edo. Méx.',
      propertyType: 'Casa habitación',
      comments: 'Quieren mantener refrigerador, bomba de agua e internet durante cortes.',
    },
    projectType: 'respaldo',
    monthlyConsumptionKwh: 780,
    billAmount: 3100,
    tariff: 3.2,
    propertyType: 'Casa habitación',
    roofAreaM2: 55,
    roofType: 'Losa de concreto',
    orientation: 'Sur',
    systemType: 'baterias',
    backup: {
      hours: 6,
      equipment: ['Refrigerador', 'Bomba de agua', 'Internet y módem', 'Iluminación'],
      loadKw: 2.2,
    },
    responsibleUserId: 'usr-comercial',
    projectId: null,
    notes: [
      {
        authorId: 'usr-comercial',
        text: 'Falta confirmar si el tablero actual tiene espacio para el inversor híbrido.',
        at: '2026-11-06T10:10:00',
      },
    ],
  },
  {
    id: 'SOL-2026-005',
    folio: 'SOL-2026-005',
    createdAt: '2026-10-12T11:35:00',
    status: 'convertida',
    source: 'sitio-publico',
    client: {
      name: 'Alejandra Ponce',
      company: 'Hotel Casa Alameda',
      email: 'gerencia@hotelcasaalameda.mx',
      phone: '+52 55 5512 7788',
      location: 'Cuauhtémoc, CDMX',
      propertyType: 'Hotel',
      comments: 'Se requiere coordinación con la administración del inmueble.',
    },
    projectType: 'comercial',
    monthlyConsumptionKwh: 4200,
    billAmount: 16800,
    tariff: 3.8,
    propertyType: 'Hotel',
    roofAreaM2: 240,
    roofType: 'Losa de concreto',
    orientation: 'Sur',
    systemType: 'interconectado',
    responsibleUserId: 'usr-comercial-2',
    projectId: 'PRY-2026-001',
  },
  {
    id: 'SOL-2026-006',
    folio: 'SOL-2026-006',
    createdAt: '2026-09-18T15:10:00',
    status: 'convertida',
    source: 'sitio-publico',
    client: {
      name: 'Dr. Emilio Cárdenas',
      company: 'Clínica Dental Sonrisa',
      email: 'contacto@clinicasonrisa.mx',
      phone: '+52 55 5544 2031',
      location: 'Benito Juárez, CDMX',
      propertyType: 'Clínica',
      comments: 'Interesa mantener equipos dentales y esterilización en operación.',
    },
    projectType: 'comercial',
    monthlyConsumptionKwh: 1150,
    billAmount: 4300,
    tariff: 3.55,
    propertyType: 'Clínica',
    roofAreaM2: 70,
    roofType: 'Losa de concreto',
    orientation: 'Oriente',
    systemType: 'hibrido',
    backup: { hours: 4, equipment: ['Equipo dental', 'Esterilizador', 'Iluminación'], loadKw: 3.4 },
    responsibleUserId: 'usr-comercial',
    projectId: 'PRY-2026-002',
  },
  {
    id: 'SOL-2026-007',
    folio: 'SOL-2026-007',
    createdAt: '2026-10-08T12:00:00',
    status: 'rechazada',
    source: 'sitio-publico',
    client: {
      name: 'Jorge Alberto Ruiz',
      email: 'jorge.ruiz@example.com',
      phone: '+52 55 4412 6630',
      location: 'Tlalpan, CDMX',
      propertyType: 'Casa habitación',
      comments: 'Solicitó opciones de financiamiento.',
    },
    projectType: 'residencial',
    monthlyConsumptionKwh: 480,
    billAmount: 1900,
    tariff: 3.2,
    propertyType: 'Casa habitación',
    roofAreaM2: 42,
    roofType: 'Losa de concreto',
    orientation: 'Poniente',
    systemType: 'interconectado',
    responsibleUserId: 'usr-comercial-2',
    projectId: null,
    rejectionReason: 'El cliente eligió financiamiento con otro proveedor.',
  },
  {
    id: 'SOL-2026-008',
    folio: 'SOL-2026-008',
    createdAt: '2026-09-04T08:45:00',
    status: 'convertida',
    source: 'sitio-publico',
    client: {
      name: 'Héctor Villalobos',
      company: 'Distribuidora Agrícola del Bajío',
      email: 'operaciones@agricoladelbajio.mx',
      phone: '+52 477 715 6204',
      location: 'León, Guanajuato',
      propertyType: 'Nave industrial',
      comments: 'Sistema para cuarto frío y oficinas administrativas.',
    },
    projectType: 'industrial',
    monthlyConsumptionKwh: 12400,
    billAmount: 52000,
    tariff: 4.2,
    propertyType: 'Nave industrial',
    roofAreaM2: 980,
    roofType: 'Lámina estructural',
    orientation: 'Sur',
    systemType: 'interconectado',
    responsibleUserId: 'usr-comercial',
    projectId: 'PRY-2026-003',
  },
  {
    id: 'SOL-2026-009',
    folio: 'SOL-2026-009',
    createdAt: '2026-11-09T17:50:00',
    status: 'aceptada',
    source: 'sitio-publico',
    client: {
      name: 'Mariana Ortega',
      email: 'mariana.ortega@example.com',
      phone: '+52 55 4389 5127',
      location: 'Del Valle, CDMX',
      propertyType: 'Casa habitación',
      comments: 'Aprobó la propuesta y solicita programar visita técnica.',
    },
    projectType: 'residencial',
    monthlyConsumptionKwh: 720,
    billAmount: 2700,
    tariff: 3.2,
    propertyType: 'Casa habitación',
    roofAreaM2: 60,
    roofType: 'Losa de concreto',
    orientation: 'Sur-poniente',
    systemType: 'interconectado',
    responsibleUserId: 'usr-comercial-2',
    projectId: null,
  },
  {
    id: 'SOL-2026-010',
    folio: 'SOL-2026-010',
    createdAt: '2026-11-10T20:05:00',
    status: 'cotizacion-calculada',
    source: 'manual',
    client: {
      name: 'Sergio Lozano',
      company: 'Plaza Comercial Lindavista',
      email: 'administracion@plazalindavista.mx',
      phone: '+52 55 5757 1902',
      location: 'Gustavo A. Madero, CDMX',
      propertyType: 'Plaza comercial',
      comments: 'Proyecto por etapas. Área común y locales ancla.',
    },
    projectType: 'comercial',
    monthlyConsumptionKwh: 6800,
    billAmount: 27000,
    tariff: 3.9,
    propertyType: 'Plaza comercial',
    roofAreaM2: 520,
    roofType: 'Losa de concreto',
    orientation: 'Oriente',
    systemType: 'interconectado',
    responsibleUserId: 'usr-comercial',
    projectId: null,
  },
  {
    id: 'SOL-2026-011',
    folio: 'SOL-2026-011',
    createdAt: '2026-08-26T10:30:00',
    status: 'convertida',
    source: 'sitio-publico',
    client: {
      name: 'Mónica Salgado',
      company: 'Escuela Bilingüe Anáhuac',
      email: 'direccion@anahuac.edu.mx',
      phone: '+52 222 245 8810',
      location: 'Puebla, Puebla',
      propertyType: 'Escuela',
      comments: 'Instalación en azotea de edificio principal, sin interferir clases.',
    },
    projectType: 'comercial',
    monthlyConsumptionKwh: 3600,
    billAmount: 14500,
    tariff: 4.0,
    propertyType: 'Escuela',
    roofAreaM2: 310,
    roofType: 'Losa de concreto',
    orientation: 'Sur',
    systemType: 'interconectado',
    responsibleUserId: 'usr-comercial-2',
    projectId: 'PRY-2026-004',
  },
  {
    id: 'SOL-2026-012',
    folio: 'SOL-2026-012',
    createdAt: '2026-11-12T21:15:00',
    status: 'nueva',
    source: 'sitio-publico',
    client: {
      name: 'Fernando Castillo',
      email: 'fernando.castillo@example.com',
      phone: '+52 33 2214 5580',
      location: 'Guadalajara, Jalisco',
      propertyType: 'Casa habitación',
      comments: 'Interesado en respaldo para home office y refrigeración.',
    },
    projectType: 'respaldo',
    monthlyConsumptionKwh: 540,
    billAmount: 2200,
    tariff: 3.2,
    propertyType: 'Casa habitación',
    roofAreaM2: 38,
    roofType: 'Losa de concreto',
    orientation: 'Sur',
    systemType: 'hibrido',
    backup: { hours: 5, equipment: ['Refrigerador', 'Home office', 'Iluminación'], loadKw: 1.8 },
    responsibleUserId: null,
    projectId: null,
  },
];

function addHours(iso: string, hours: number): string {
  const date = new Date(iso);
  date.setHours(date.getHours() + hours);
  return date.toISOString();
}

function buildActivities(profile: SeedProfile): ActivityEntry[] {
  const entries: ActivityEntry[] = [
    {
      id: `act-${profile.id}-00`,
      timestamp: profile.createdAt,
      actorId: 'sistema',
      type: 'solicitud',
      title: 'Solicitud recibida',
      description:
        profile.source === 'sitio-publico'
          ? 'Ingresó desde el cotizador público.'
          : 'Registrada manualmente por el equipo comercial.',
      requestId: profile.id,
    },
  ];

  if (profile.status !== 'nueva') {
    entries.push({
      id: `act-${profile.id}-01`,
      timestamp: addHours(profile.createdAt, 2),
      actorId: profile.responsibleUserId ?? 'usr-comercial',
      type: 'estado',
      title: 'Solicitud en revisión',
      description: 'Se asignó un responsable comercial y se revisó la información inicial.',
      requestId: profile.id,
    });
  }

  if (profile.status === 'pendiente-info') {
    entries.push({
      id: `act-${profile.id}-02`,
      timestamp: addHours(profile.createdAt, 18),
      actorId: profile.responsibleUserId ?? 'usr-comercial',
      type: 'comentario',
      title: 'Información adicional solicitada',
      description: 'Se pidió al cliente confirmar capacidad del tablero y fotos del sitio.',
      requestId: profile.id,
    });
  }

  if (['cotizacion-calculada', 'cotizacion-enviada', 'aceptada', 'convertida'].includes(profile.status)) {
    entries.push({
      id: `act-${profile.id}-02`,
      timestamp: addHours(profile.createdAt, 28),
      actorId: profile.responsibleUserId ?? 'usr-comercial',
      type: 'cotizacion',
      title: 'Cotización preliminar calculada',
      description: 'Se generó el dimensionamiento y el desglose de inversión.',
      requestId: profile.id,
    });
  }

  if (['cotizacion-enviada', 'aceptada', 'convertida'].includes(profile.status)) {
    entries.push({
      id: `act-${profile.id}-03`,
      timestamp: addHours(profile.createdAt, 52),
      actorId: profile.responsibleUserId ?? 'usr-comercial',
      type: 'cotizacion',
      title: 'Cotización enviada al cliente',
      description: 'Se compartió la propuesta económica por correo (simulación).',
      requestId: profile.id,
    });
  }

  if (['aceptada', 'convertida'].includes(profile.status)) {
    entries.push({
      id: `act-${profile.id}-04`,
      timestamp: addHours(profile.createdAt, 96),
      actorId: profile.responsibleUserId ?? 'usr-comercial',
      type: 'estado',
      title: 'Propuesta aceptada',
      description: 'El cliente confirmó la aceptación de la propuesta.',
      requestId: profile.id,
    });
  }

  if (profile.status === 'rechazada') {
    entries.push({
      id: `act-${profile.id}-04`,
      timestamp: addHours(profile.createdAt, 72),
      actorId: profile.responsibleUserId ?? 'usr-comercial',
      type: 'estado',
      title: 'Solicitud rechazada',
      description: profile.rejectionReason,
      requestId: profile.id,
    });
  }

  if (profile.status === 'convertida' && profile.projectId) {
    entries.push({
      id: `act-${profile.id}-05`,
      timestamp: addHours(profile.createdAt, 120),
      actorId: 'usr-gerente',
      type: 'proyecto',
      title: 'Solicitud convertida en proyecto',
      description: `Se creó el proyecto ${profile.projectId} y se asignó responsable de operación.`,
      requestId: profile.id,
      projectId: profile.projectId,
    });
  }

  return entries;
}

function buildNotes(profile: SeedProfile): InternalNote[] {
  return (profile.notes ?? []).map((note, index) => ({
    id: `note-${profile.id}-${index + 1}`,
    authorId: note.authorId,
    timestamp: note.at,
    text: note.text,
  }));
}

export function createSeedSolicitudes(): Solicitud[] {
  return PROFILES.map((profile) => {
    const calculation = calculateSolarEstimate(
      {
        projectType: profile.projectType,
        monthlyConsumptionKwh: profile.monthlyConsumptionKwh,
        monthlyBill: profile.billAmount,
        tariff: profile.tariff,
        systemType: profile.systemType,
        backupHours: profile.backup?.hours,
        backupLoadKw: profile.backup?.loadKw,
      },
      DEFAULT_CONFIG,
    );

    return {
      id: profile.id,
      folio: profile.folio,
      createdAt: profile.createdAt,
      status: profile.status,
      source: profile.source,
      client: profile.client,
      energy: {
        projectType: profile.projectType,
        monthlyConsumptionKwh: profile.monthlyConsumptionKwh,
        bimonthlyConsumptionKwh: profile.monthlyConsumptionKwh * 2,
        billAmount: profile.billAmount,
        tariff: profile.tariff,
        requiredPowerKw: calculation.requiredPowerKw,
        propertyType: profile.propertyType,
        roofAreaM2: profile.roofAreaM2,
        roofType: profile.roofType,
        orientation: profile.orientation,
      },
      systemType: profile.systemType,
      backup: profile.backup,
      calculation,
      responsibleUserId: profile.responsibleUserId,
      internalNotes: buildNotes(profile),
      activities: buildActivities(profile),
      projectId: profile.projectId,
      rejectionReason: profile.rejectionReason,
    };
  });
}

export const seedSolicitudes: Solicitud[] = createSeedSolicitudes();
