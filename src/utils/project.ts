import type { Project, ProjectStatus } from '../types/admin';
import { PROJECT_STATUS_LABEL } from './status';

export interface TimelineStage {
  status: ProjectStatus;
  title: string;
  description: string;
  date: string;
  state: 'completado' | 'en-curso' | 'pendiente' | 'cancelado';
}

const STAGES: Array<{ status: ProjectStatus; description: string; offset: number }> = [
  { status: 'por-planificar', description: 'Alta del proyecto y definición del alcance.', offset: 0 },
  { status: 'planificacion', description: 'Revisión de consumo, alcance y calendario.', offset: 3 },
  { status: 'visita-tecnica', description: 'Levantamiento en sitio y mediciones.', offset: 7 },
  { status: 'diseno', description: 'Diseño eléctrico y estructural del sistema.', offset: 12 },
  { status: 'materiales', description: 'Compra, recepción y preparación de materiales.', offset: 18 },
  { status: 'instalacion-programada', description: 'Coordinación de cuadrilla y fecha de instalación.', offset: 24 },
  { status: 'en-instalacion', description: 'Montaje de estructura, paneles y cableado.', offset: 30 },
  { status: 'inspeccion', description: 'Pruebas, verificación y observaciones finales.', offset: 40 },
  { status: 'finalizado', description: 'Entrega, documentación y cierre del proyecto.', offset: 48 },
];

function addDays(value: string, days: number): string {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

export function buildProjectTimeline(project: Project): TimelineStage[] {
  const start = project.startDate || project.createdAt;
  const currentIndex = STAGES.findIndex((stage) => stage.status === project.status);
  const isCancelled = project.status === 'cancelado';

  return STAGES.map((stage, index) => {
    let state: TimelineStage['state'] = 'pendiente';
    if (project.status === 'finalizado') {
      state = 'completado';
    } else if (isCancelled) {
      state = index < Math.max(currentIndex, 0) ? 'completado' : index === Math.max(currentIndex, 0) ? 'cancelado' : 'pendiente';
    } else if (index < currentIndex) {
      state = 'completado';
    } else if (index === currentIndex) {
      state = 'en-curso';
    }

    return {
      status: stage.status,
      title: PROJECT_STATUS_LABEL[stage.status],
      description: stage.description,
      date: addDays(start, stage.offset),
      state,
    };
  });
}

export function projectProgress(project: Project): number {
  if (project.status === 'finalizado') return 100;
  if (!project.tasks.length) return project.progress;
  const completed = project.tasks.filter((task) => task.status === 'completada').length;
  return Math.round((completed / project.tasks.length) * 100);
}

export function isProjectActive(status: ProjectStatus): boolean {
  return status !== 'finalizado' && status !== 'cancelado';
}
