import type {
  ActivityEntry,
  ClientInfo,
  Priority,
  Project,
  ProjectFile,
  ProjectStatus,
  ProjectTask,
  TaskStatus,
} from '../../types/admin';
import type { ProjectType, SystemType } from '../../types/solar';
import { seedSolicitudes } from './solicitudes';
import { projectProgress } from '../../utils/project';

interface SeedTaskInput {
  id: string;
  title: string;
  description: string;
  assigneeId: string;
  priority: Priority;
  startDate: string;
  dueDate: string;
  status: TaskStatus;
}

function task(projectId: string, input: SeedTaskInput): ProjectTask {
  return {
    ...input,
    createdAt: input.startDate,
  };
}

function file(
  id: string,
  name: string,
  kind: ProjectFile['kind'],
  sizeKb: number,
  uploadedById: string,
  uploadedAt: string,
): ProjectFile {
  return { id, name, kind, sizeKb, uploadedById, uploadedAt };
}

function activity(
  id: string,
  timestamp: string,
  actorId: string,
  projectId: string,
  type: ActivityEntry['type'],
  title: string,
  description?: string,
): ActivityEntry {
  return { id, timestamp, actorId, projectId, type, title, description };
}

const requestById = new Map(seedSolicitudes.map((item) => [item.id, item]));

const linked = (requestId: string) => {
  const request = requestById.get(requestId);
  if (!request) throw new Error(`No existe la solicitud semilla ${requestId}`);
  return request;
};

interface ProjectSeed {
  id: string;
  folio: string;
  name: string;
  requestId: string | null;
  client: ClientInfo;
  projectType: ProjectType;
  systemType: SystemType;
  location: string;
  capacityKwp: number;
  amount: number;
  responsibleUserId: string;
  startDate: string;
  estimatedEndDate: string;
  status: ProjectStatus;
  description: string;
  tasks: ProjectTask[];
  teamIds: string[];
  files: ProjectFile[];
  activities: ActivityEntry[];
  createdAt: string;
}

const p1 = linked('SOL-2026-005');
const p2 = linked('SOL-2026-006');
const p3 = linked('SOL-2026-008');
const p4 = linked('SOL-2026-011');

const PROJECTS: ProjectSeed[] = [
  {
    id: 'PRY-2026-001',
    folio: 'PRY-2026-001',
    name: 'Hotel Casa Alameda · Azotea principal',
    requestId: p1.id,
    client: p1.client,
    projectType: 'comercial',
    systemType: 'interconectado',
    location: p1.client.location,
    capacityKwp: p1.calculation.installedCapacityKwp,
    amount: p1.calculation.total,
    responsibleUserId: 'usr-gerente',
    startDate: '2026-10-28',
    estimatedEndDate: '2026-12-05',
    status: 'en-instalacion',
    description:
      'Sistema fotovoltaico para cubrir cargas comunes del hotel y reducir el consumo en horario diurno.',
    tasks: [
      task('PRY-2026-001', {
        id: 'tsk-001',
        title: 'Montaje de estructura en azotea',
        description: 'Nivelación de bases, rieles y anclajes conforme al diseño estructural.',
        assigneeId: 'usr-tecnico',
        priority: 'alta',
        startDate: '2026-11-02',
        dueDate: '2026-11-04',
        status: 'completada',
      }),
      task('PRY-2026-001', {
        id: 'tsk-002',
        title: 'Instalación de paneles',
        description: 'Colocación, alineación y torque de los módulos fotovoltaicos.',
        assigneeId: 'usr-tecnico',
        priority: 'alta',
        startDate: '2026-11-05',
        dueDate: '2026-11-10',
        status: 'en-progreso',
      }),
      task('PRY-2026-001', {
        id: 'tsk-003',
        title: 'Cableado y protecciones',
        description: 'Canalización, string boxes, protecciones y conexión al tablero general.',
        assigneeId: 'usr-tecnico-2',
        priority: 'alta',
        startDate: '2026-11-08',
        dueDate: '2026-11-12',
        status: 'en-progreso',
      }),
      task('PRY-2026-001', {
        id: 'tsk-004',
        title: 'Coordinación con administración del hotel',
        description: 'Horarios de acceso, bloqueo de áreas y aviso a huéspedes.',
        assigneeId: 'usr-gerente',
        priority: 'media',
        startDate: '2026-10-28',
        dueDate: '2026-10-30',
        status: 'completada',
      }),
    ],
    teamIds: ['usr-gerente', 'usr-supervisor', 'usr-tecnico', 'usr-tecnico-2'],
    files: [
      file('fil-001', 'Cotización_Hotel_Casa_Alameda.pdf', 'cotizacion', 842, 'usr-comercial-2', '2026-10-14T12:00:00'),
      file('fil-002', 'Plano_estructural_azotea.dwg', 'plano', 2380, 'usr-gerente', '2026-10-29T09:30:00'),
      file('fil-003', 'Ficha_tecnica_inversor.pdf', 'ficha', 460, 'usr-comercial', '2026-10-30T11:15:00'),
      file('fil-004', 'Foto_azotea_antes.jpg', 'fotografia', 3120, 'usr-supervisor', '2026-10-28T16:45:00'),
    ],
    activities: [
      activity('act-p1-01', '2026-10-14T12:00:00', 'usr-gerente', 'PRY-2026-001', 'proyecto', 'Proyecto creado', 'Se generó el proyecto a partir de la solicitud SOL-2026-005.'),
      activity('act-p1-02', '2026-10-28T09:10:00', 'usr-supervisor', 'PRY-2026-001', 'estado', 'Proyecto en instalación', 'Se inició el montaje en sitio con cuadrilla de cuatro personas.'),
      activity('act-p1-03', '2026-11-04T17:40:00', 'usr-tecnico', 'PRY-2026-001', 'tarea', 'Estructura completada', 'Se concluyó el montaje y se verificaron anclajes.'),
    ],
    createdAt: '2026-10-14T12:00:00',
  },
  {
    id: 'PRY-2026-002',
    folio: 'PRY-2026-002',
    name: 'Clínica Dental Sonrisa · Respaldo crítico',
    requestId: p2.id,
    client: p2.client,
    projectType: 'comercial',
    systemType: 'hibrido',
    location: p2.client.location,
    capacityKwp: p2.calculation.installedCapacityKwp,
    amount: p2.calculation.total,
    responsibleUserId: 'usr-supervisor',
    startDate: '2026-10-20',
    estimatedEndDate: '2026-11-28',
    status: 'instalacion-programada',
    description:
      'Sistema híbrido con baterías para mantener equipos dentales y esterilización durante interrupciones.',
    tasks: [
      task('PRY-2026-002', {
        id: 'tsk-005',
        title: 'Visita técnica y levantamiento',
        description: 'Medición de tablero, ruta de canalización y revisión de azotea.',
        assigneeId: 'usr-supervisor',
        priority: 'alta',
        startDate: '2026-10-20',
        dueDate: '2026-10-21',
        status: 'completada',
      }),
      task('PRY-2026-002', {
        id: 'tsk-006',
        title: 'Revisión de planos eléctricos',
        description: 'Validación de cargas críticas y diagrama unifilar del respaldo.',
        assigneeId: 'usr-gerente-2',
        priority: 'media',
        startDate: '2026-10-24',
        dueDate: '2026-10-26',
        status: 'completada',
      }),
      task('PRY-2026-002', {
        id: 'tsk-007',
        title: 'Confirmar fecha de instalación con cliente',
        description: 'Coordinar cierre temporal del consultorio y acceso al edificio.',
        assigneeId: 'usr-comercial',
        priority: 'media',
        startDate: '2026-11-15',
        dueDate: '2026-11-18',
        status: 'pendiente',
      }),
    ],
    teamIds: ['usr-supervisor', 'usr-tecnico', 'usr-comercial'],
    files: [
      file('fil-005', 'Cotizacion_Clinica_Sonrisa.pdf', 'cotizacion', 790, 'usr-comercial', '2026-09-22T10:00:00'),
      file('fil-006', 'Diagrama_unifilar_respaldo.pdf', 'plano', 1150, 'usr-gerente-2', '2026-10-26T18:00:00'),
    ],
    activities: [
      activity('act-p2-01', '2026-09-22T10:00:00', 'usr-gerente', 'PRY-2026-002', 'proyecto', 'Proyecto creado', 'Conversión de la solicitud SOL-2026-006.'),
      activity('act-p2-02', '2026-10-26T18:05:00', 'usr-gerente-2', 'PRY-2026-002', 'archivo', 'Diagrama unifilar cargado', 'Se adjuntó la versión revisada del respaldo crítico.'),
    ],
    createdAt: '2026-09-22T10:00:00',
  },
  {
    id: 'PRY-2026-003',
    folio: 'PRY-2026-003',
    name: 'Distribuidora Agrícola del Bajío · Cuarto frío',
    requestId: p3.id,
    client: p3.client,
    projectType: 'industrial',
    systemType: 'interconectado',
    location: p3.client.location,
    capacityKwp: p3.calculation.installedCapacityKwp,
    amount: p3.calculation.total,
    responsibleUserId: 'usr-gerente',
    startDate: '2026-09-20',
    estimatedEndDate: '2027-01-30',
    status: 'planificacion',
    description:
      'Proyecto industrial por etapas para reducir el consumo del cuarto frío y las oficinas administrativas.',
    tasks: [
      task('PRY-2026-003', {
        id: 'tsk-008',
        title: 'Estudio de cargas y consumo',
        description: 'Análisis del historial CFE y curvas de demanda del cuarto frío.',
        assigneeId: 'usr-gerente-2',
        priority: 'alta',
        startDate: '2026-10-01',
        dueDate: '2026-10-05',
        status: 'en-revision',
      }),
      task('PRY-2026-003', {
        id: 'tsk-009',
        title: 'Diseño preliminar del sistema',
        description: 'Dimensionamiento, selección de inversores y layout de paneles.',
        assigneeId: 'usr-gerente',
        priority: 'alta',
        startDate: '2026-10-06',
        dueDate: '2026-10-14',
        status: 'en-progreso',
      }),
      task('PRY-2026-003', {
        id: 'tsk-010',
        title: 'Solicitud de permiso de interconexión',
        description: 'Preparar expediente y trámite ante la CFE para la capacidad propuesta.',
        assigneeId: 'usr-supervisor',
        priority: 'media',
        startDate: '2026-10-15',
        dueDate: '2026-10-30',
        status: 'pendiente',
      }),
    ],
    teamIds: ['usr-gerente', 'usr-gerente-2', 'usr-supervisor'],
    files: [
      file('fil-007', 'Propuesta_tecnica_AgroBajio.pdf', 'cotizacion', 1240, 'usr-comercial', '2026-09-08T11:00:00'),
      file('fil-008', 'Layout_paneles_fase1.pdf', 'plano', 2100, 'usr-gerente', '2026-10-10T15:30:00'),
      file('fil-009', 'Ficha_tecnica_inversor_SG125.pdf', 'ficha', 620, 'usr-gerente-2', '2026-10-11T09:20:00'),
    ],
    activities: [
      activity('act-p3-01', '2026-09-08T11:00:00', 'usr-gerente', 'PRY-2026-003', 'proyecto', 'Proyecto creado', 'Conversión de la solicitud SOL-2026-008.'),
      activity('act-p3-02', '2026-10-10T15:30:00', 'usr-gerente', 'PRY-2026-003', 'archivo', 'Layout fase 1 actualizado', 'Se ajustó la distribución de paneles en la nave principal.'),
    ],
    createdAt: '2026-09-08T11:00:00',
  },
  {
    id: 'PRY-2026-004',
    folio: 'PRY-2026-004',
    name: 'Escuela Bilingüe Anáhuac · Edificio principal',
    requestId: p4.id,
    client: p4.client,
    projectType: 'comercial',
    systemType: 'interconectado',
    location: p4.client.location,
    capacityKwp: p4.calculation.installedCapacityKwp,
    amount: p4.calculation.total,
    responsibleUserId: 'usr-gerente-2',
    startDate: '2026-08-03',
    estimatedEndDate: '2026-08-28',
    status: 'finalizado',
    description:
      'Instalación en azotea del edificio principal, ejecutada durante el periodo vacacional.',
    tasks: [
      task('PRY-2026-004', {
        id: 'tsk-011',
        title: 'Inspección final y pruebas',
        description: 'Pruebas de generación, protecciones y medición de aislamiento.',
        assigneeId: 'usr-supervisor',
        priority: 'alta',
        startDate: '2026-08-24',
        dueDate: '2026-08-25',
        status: 'completada',
      }),
      task('PRY-2026-004', {
        id: 'tsk-012',
        title: 'Entrega de documentación al cliente',
        description: 'Manuales, garantías, diagramas y acta de entrega.',
        assigneeId: 'usr-comercial-2',
        priority: 'baja',
        startDate: '2026-08-26',
        dueDate: '2026-08-27',
        status: 'completada',
      }),
    ],
    teamIds: ['usr-gerente-2', 'usr-supervisor', 'usr-tecnico-2'],
    files: [
      file('fil-010', 'Acta_entrega_Anahuac.pdf', 'instalacion', 540, 'usr-supervisor', '2026-08-27T17:00:00'),
      file('fil-011', 'Plano_as_built_Anahuac.pdf', 'plano', 1800, 'usr-gerente-2', '2026-08-26T12:00:00'),
      file('fil-012', 'Fotografia_final_azotea.jpg', 'fotografia', 2760, 'usr-tecnico-2', '2026-08-27T16:20:00'),
    ],
    activities: [
      activity('act-p4-01', '2026-08-03T08:00:00', 'usr-gerente-2', 'PRY-2026-004', 'proyecto', 'Proyecto iniciado', 'Arranque de instalación en periodo vacacional.'),
      activity('act-p4-02', '2026-08-28T18:00:00', 'usr-gerente-2', 'PRY-2026-004', 'estado', 'Proyecto finalizado', 'Entrega completa con documentación y pruebas aprobadas.'),
    ],
    createdAt: '2026-07-28T09:00:00',
  },
  {
    id: 'PRY-2026-005',
    folio: 'PRY-2026-005',
    name: 'Residencial Los Encinos · Casa modelo',
    requestId: null,
    client: {
      name: 'Familia Navarro Solís',
      email: 'navarro.solis@example.com',
      phone: '+52 55 5711 2043',
      location: 'Tlalpan, CDMX',
      propertyType: 'Casa habitación',
    },
    projectType: 'residencial',
    systemType: 'interconectado',
    location: 'Tlalpan, CDMX',
    capacityKwp: 5.5,
    amount: 164900,
    responsibleUserId: 'usr-supervisor',
    startDate: '2026-08-10',
    estimatedEndDate: '2026-08-28',
    status: 'finalizado',
    description: 'Sistema residencial de 5.5 kWp con monitoreo remoto y estructura coplanar.',
    tasks: [
      task('PRY-2026-005', {
        id: 'tsk-013',
        title: 'Instalación y conexión',
        description: 'Montaje de paneles, inversor y conexión al centro de carga.',
        assigneeId: 'usr-tecnico',
        priority: 'alta',
        startDate: '2026-08-12',
        dueDate: '2026-08-14',
        status: 'completada',
      }),
      task('PRY-2026-005', {
        id: 'tsk-014',
        title: 'Capacitación al cliente',
        description: 'Explicación de la aplicación de monitoreo y mantenimiento básico.',
        assigneeId: 'usr-comercial',
        priority: 'media',
        startDate: '2026-08-27',
        dueDate: '2026-08-28',
        status: 'completada',
      }),
    ],
    teamIds: ['usr-supervisor', 'usr-tecnico', 'usr-comercial'],
    files: [
      file('fil-013', 'Garantia_sistema_Navarro.pdf', 'instalacion', 380, 'usr-supervisor', '2026-08-28T11:00:00'),
      file('fil-014', 'Foto_instalacion_terminada.jpg', 'fotografia', 1980, 'usr-tecnico', '2026-08-27T15:00:00'),
    ],
    activities: [
      activity('act-p5-01', '2026-08-10T09:00:00', 'usr-supervisor', 'PRY-2026-005', 'estado', 'Inicio de instalación', 'Se instaló estructura y se preparó el canalizado.'),
      activity('act-p5-02', '2026-08-28T17:30:00', 'usr-comercial', 'PRY-2026-005', 'comentario', 'Cliente capacitado', 'Se entregó aplicación de monitoreo y manual de usuario.'),
    ],
    createdAt: '2026-07-30T10:00:00',
  },
  {
    id: 'PRY-2026-006',
    folio: 'PRY-2026-006',
    name: 'Parque Logístico Norte · Nave 3',
    requestId: null,
    client: {
      name: 'Alejandro Cantú',
      company: 'Grupo Logístico Inter Norte',
      email: 'acantu@inter-norte.mx',
      phone: '+52 81 8342 7760',
      location: 'Apodaca, Nuevo León',
      propertyType: 'Nave industrial',
    },
    projectType: 'industrial',
    systemType: 'interconectado',
    location: 'Apodaca, Nuevo León',
    capacityKwp: 120,
    amount: 2640000,
    responsibleUserId: 'usr-gerente',
    startDate: '2026-10-15',
    estimatedEndDate: '2026-12-20',
    status: 'en-instalacion',
    description: 'Cubierta fotovoltaica de 120 kWp para nave de distribución y oficinas.',
    tasks: [
      task('PRY-2026-006', {
        id: 'tsk-015',
        title: 'Adecuación de cuarto de inversores',
        description: 'Ventilación, base de concreto y canalización principal.',
        assigneeId: 'usr-supervisor',
        priority: 'alta',
        startDate: '2026-10-18',
        dueDate: '2026-10-22',
        status: 'completada',
      }),
      task('PRY-2026-006', {
        id: 'tsk-016',
        title: 'Instalación de paneles en nave',
        description: 'Montaje sobre lámina estructural con líneas de vida.',
        assigneeId: 'usr-tecnico',
        priority: 'alta',
        startDate: '2026-10-25',
        dueDate: '2026-11-16',
        status: 'en-progreso',
      }),
      task('PRY-2026-006', {
        id: 'tsk-017',
        title: 'Supervisión de seguridad en altura',
        description: 'Verificación de arnés, anclajes y permisos de trabajo en caliente.',
        assigneeId: 'usr-supervisor',
        priority: 'alta',
        startDate: '2026-11-18',
        dueDate: '2026-11-22',
        status: 'pendiente',
      }),
    ],
    teamIds: ['usr-gerente', 'usr-supervisor', 'usr-tecnico', 'usr-tecnico-2'],
    files: [
      file('fil-015', 'Plano_cubierta_Nave3.pdf', 'plano', 3100, 'usr-gerente', '2026-10-16T10:00:00'),
      file('fil-016', 'Programa_seguridad.pdf', 'instalacion', 720, 'usr-supervisor', '2026-10-17T08:30:00'),
    ],
    activities: [
      activity('act-p6-01', '2026-10-15T07:30:00', 'usr-gerente', 'PRY-2026-006', 'estado', 'Inicio de obra', 'Arranque de instalación en nave 3.'),
      activity('act-p6-02', '2026-10-22T16:00:00', 'usr-supervisor', 'PRY-2026-006', 'tarea', 'Cuarto de inversores concluido', 'Se liberó el área para montaje eléctrico.'),
    ],
    createdAt: '2026-09-26T09:00:00',
  },
  {
    id: 'PRY-2026-007',
    folio: 'PRY-2026-007',
    name: 'Hotel Boutique Roma · Terraza',
    requestId: null,
    client: {
      name: 'Valeria Fuentes',
      company: 'Casa Roma Hospitality',
      email: 'operaciones@casaroma.mx',
      phone: '+52 55 5525 8401',
      location: 'Cuauhtémoc, CDMX',
      propertyType: 'Hotel',
    },
    projectType: 'comercial',
    systemType: 'interconectado',
    location: 'Cuauhtémoc, CDMX',
    capacityKwp: 12.1,
    amount: 335000,
    responsibleUserId: 'usr-supervisor',
    startDate: '2026-09-22',
    estimatedEndDate: '2026-11-05',
    status: 'inspeccion',
    description: 'Sistema de 12.1 kWp en terraza con integración arquitectónica.',
    tasks: [
      task('PRY-2026-007', {
        id: 'tsk-018',
        title: 'Pruebas de inversores',
        description: 'Verificación de parámetros, comunicación y protecciones.',
        assigneeId: 'usr-tecnico-2',
        priority: 'alta',
        startDate: '2026-10-28',
        dueDate: '2026-10-29',
        status: 'completada',
      }),
      task('PRY-2026-007', {
        id: 'tsk-019',
        title: 'Levantamiento de observaciones',
        description: 'Corrección de canalización y ajuste de penetraciones en azotea.',
        assigneeId: 'usr-supervisor',
        priority: 'media',
        startDate: '2026-11-02',
        dueDate: '2026-11-14',
        status: 'en-progreso',
      }),
    ],
    teamIds: ['usr-supervisor', 'usr-tecnico-2'],
    files: [
      file('fil-017', 'Checklist_inspeccion_Roma.pdf', 'instalacion', 410, 'usr-supervisor', '2026-10-30T10:00:00'),
      file('fil-018', 'Foto_terraza.jpg', 'fotografia', 2240, 'usr-tecnico-2', '2026-10-29T17:00:00'),
    ],
    activities: [
      activity('act-p7-01', '2026-09-22T08:00:00', 'usr-supervisor', 'PRY-2026-007', 'estado', 'Inicio de proyecto', 'Se inició la adecuación de terraza.'),
      activity('act-p7-02', '2026-10-29T17:10:00', 'usr-tecnico-2', 'PRY-2026-007', 'tarea', 'Pruebas de inversores completadas', 'Los equipos operan dentro de parámetros.'),
    ],
    createdAt: '2026-09-05T10:00:00',
  },
  {
    id: 'PRY-2026-008',
    folio: 'PRY-2026-008',
    name: 'Universidad Tecnológica del Valle · Campus Sur',
    requestId: null,
    client: {
      name: 'Rectoría UTV',
      company: 'Universidad Tecnológica del Valle',
      email: 'proyectos@utv.edu.mx',
      phone: '+52 55 5487 3320',
      location: 'Xochimilco, CDMX',
      propertyType: 'Institución educativa',
    },
    projectType: 'industrial',
    systemType: 'interconectado',
    location: 'Xochimilco, CDMX',
    capacityKwp: 85,
    amount: 1890000,
    responsibleUserId: 'usr-gerente-2',
    startDate: '2026-12-01',
    estimatedEndDate: '2027-02-15',
    status: 'por-planificar',
    description:
      'Proyecto institucional de 85 kWp en azoteas de tres edificios del campus sur.',
    tasks: [
      task('PRY-2026-008', {
        id: 'tsk-020',
        title: 'Kickoff con el cliente',
        description: 'Alineación de alcance, accesos, calendario y responsables.',
        assigneeId: 'usr-gerente',
        priority: 'media',
        startDate: '2026-12-01',
        dueDate: '2026-12-03',
        status: 'pendiente',
      }),
    ],
    teamIds: ['usr-gerente', 'usr-gerente-2'],
    files: [
      file('fil-019', 'Propuesta_institucional_UTV.pdf', 'cotizacion', 1460, 'usr-gerente-2', '2026-11-06T12:00:00'),
    ],
    activities: [
      activity('act-p8-01', '2026-11-06T12:00:00', 'usr-gerente-2', 'PRY-2026-008', 'proyecto', 'Proyecto registrado', 'Pendiente de kickoff y visita técnica inicial.'),
    ],
    createdAt: '2026-11-06T12:00:00',
  },
];

export const seedProjects: Project[] = PROJECTS.map((project) => {
  const base: Project = {
    ...project,
    progress: 0,
    updatedAt: project.activities[project.activities.length - 1]?.timestamp ?? project.createdAt,
  };
  base.progress = projectProgress(base);
  return base;
});
