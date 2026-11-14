import type { GeneralTask, GeneralTaskInput } from '../../types/task';
import { loadState } from '../../services/store';

export function addGeneralTask(input: GeneralTaskInput): GeneralTask {
  const state = loadState();
  state.counters.tarea += 1;
  const id = `TAR-2026-${String(state.counters.tarea).padStart(3, '0')}`;
  const timestamp = new Date().toISOString();
  const task: GeneralTask = {
    id,
    folio: id,
    title: input.title.trim(),
    description: input.description.trim(),
    assigneeIds: Array.from(new Set(input.assigneeIds.filter(Boolean))),
    creatorId: 'usr-admin',
    dueDate: input.dueDate,
    priority: input.priority,
    status: input.status,
    startDate: input.startDate || undefined,
    projectId: input.projectId || null,
    notes: input.notes?.trim() || undefined,
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt: input.status === 'completada' ? timestamp : undefined,
    comments: [],
    history: [],
  };
  state.generalTasks.unshift(task);
  return task;
}

export function updateGeneralTask(id: string, input: GeneralTaskInput): GeneralTask {
  const state = loadState();
  const task = state.generalTasks.find((item) => item.id === id);
  if (!task) throw new Error('La tarea no existe.');

  const previousStatus = task.status;
  const previousAssignees = [...task.assigneeIds].sort().join('|');
  const nextAssignees = Array.from(new Set(input.assigneeIds.filter(Boolean)));
  const timestamp = new Date().toISOString();

  const changedContent =
    task.title !== input.title.trim() ||
    task.description !== input.description.trim() ||
    task.dueDate !== input.dueDate ||
    task.priority !== input.priority ||
    (task.startDate ?? '') !== (input.startDate ?? '') ||
    (task.projectId ?? '') !== (input.projectId ?? '') ||
    (task.notes ?? '') !== (input.notes?.trim() ?? '');

  task.title = input.title.trim();
  task.description = input.description.trim();
  task.assigneeIds = nextAssignees;
  task.dueDate = input.dueDate;
  task.priority = input.priority;
  task.status = input.status;
  task.startDate = input.startDate || undefined;
  task.projectId = input.projectId || null;
  task.notes = input.notes?.trim() || undefined;
  task.updatedAt = timestamp;

  if (input.status === 'completada') {
    task.completedAt = task.completedAt ?? timestamp;
  } else {
    task.completedAt = undefined;
  }

  if (previousStatus !== task.status) {
    task.history.unshift({
      id: 'th-001',
      actorId: 'usr-admin',
      timestamp,
      kind: 'estado',
      title: task.status === 'completada' ? 'Tarea completada' : `Estado actualizado: ${task.status}`,
      description: task.status === 'completada' ? 'La tarea se marcó como completada.' : `Estado anterior: ${previousStatus}.`,
    });
  }
  if (previousAssignees !== [...nextAssignees].sort().join('|')) {
    task.history.unshift({
      id: 'th-002',
      actorId: 'usr-admin',
      timestamp,
      kind: 'asignacion',
      title: 'Responsables actualizados',
      description: nextAssignees.map((userId) => userName(state, userId)).join(', ') || 'Sin responsables.',
    });
  }
  if (changedContent) {
    task.history.unshift({
      id: 'th-003',
      actorId: 'usr-admin',
      timestamp,
      kind: 'edicion',
      title: 'Tarea actualizada',
      description: 'Se modificó la información general.',
    });
  }

  return task;
}

export function setGeneralTaskStatus(id: string, status: TaskStatus): void {
  const state = loadState();
  const task = state.generalTasks.find((item) => item.id === id);
  if (!task) throw new Error('La tarea no existe.');
  if (task.status === status) return;
  const previous = task.status;
  task.status = status;
  task.updatedAt = new Date().toISOString();
  task.completedAt = status === 'completada' ? new Date().toISOString() : undefined;
}

export function assignGeneralTask(id: string, userIds: string[]): void {
  const state = loadState();
  const task = state.generalTasks.find((item) => item.id === id);
  if (!task) throw new Error('La tarea no existe.');
  const next = Array.from(new Set(userIds.filter(Boolean)));
  if (next.length === 0) throw new Error('La tarea debe tener al menos un responsable.');
  task.assigneeIds = next;
  task.updatedAt = new Date().toISOString();
}

export function addGeneralTaskComment(id: string, text: string): void {
  const state = loadState();
  const task = state.generalTasks.find((item) => item.id === id);
  if (!task) throw new Error('La tarea no existe.');
  const clean = text.trim();
  if (!clean) throw new Error('Escribe un comentario antes de guardarlo.');
  task.comments.unshift({
    id: 'cmt-001',
    authorId: 'usr-admin',
    timestamp: new Date().toISOString(),
    text: clean,
  });
}

export function deleteGeneralTask(id: string): void {
  const state = loadState();
  const task = state.generalTasks.find((item) => item.id === id);
  if (!task) throw new Error('La tarea no existe.');
  state.generalTasks = state.generalTasks.filter((item) => item.id !== id);
}

export function getGeneralTask(id: string): GeneralTask | undefined {
  return loadState().generalTasks.find((item) => item.id === id);
}