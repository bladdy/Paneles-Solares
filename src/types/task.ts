import type { Priority, TaskStatus } from './admin';

export const TASK_HISTORY_KIND_VALUES = [
  'creado',
  'estado',
  'edicion',
  'asignacion',
  'comentario',
] as const;
export type TaskHistoryKind = (typeof TASK_HISTORY_KIND_VALUES)[number];

export interface TaskComment {
  id: string;
  authorId: string;
  timestamp: string;
  text: string;
}

export interface TaskHistoryEntry {
  id: string;
  actorId: string;
  timestamp: string;
  kind: TaskHistoryKind;
  title: string;
  description?: string;
}

export interface GeneralTask {
  id: string;
  folio: string;
  title: string;
  description: string;
  assigneeIds: string[];
  creatorId: string;
  dueDate: string;
  priority: Priority;
  status: TaskStatus;
  startDate?: string;
  projectId: string | null;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  comments: TaskComment[];
  history: TaskHistoryEntry[];
}

export interface GeneralTaskInput {
  title: string;
  description: string;
  assigneeIds: string[];
  dueDate: string;
  priority: Priority;
  status: TaskStatus;
  startDate?: string;
  projectId?: string | null;
  notes?: string;
}
