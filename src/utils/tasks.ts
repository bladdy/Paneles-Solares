import type { GeneralTask } from '../types/task';
import { toDateInput } from './format';

export function todayIso(): string {
  return toDateInput(new Date());
}

export function taskIsOverdue(task: GeneralTask, today = todayIso()): boolean {
  return task.status !== 'completada' && task.dueDate < today;
}

export function taskDaysUntilDue(task: GeneralTask, today = todayIso()): number {
  const start = new Date(`${today}T00:00:00`).getTime();
  const end = new Date(`${task.dueDate}T00:00:00`).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.round((end - start) / 86_400_000);
}

export function taskIsUpcoming(task: GeneralTask, days = 7, today = todayIso()): boolean {
  if (task.status === 'completada') return false;
  const diff = taskDaysUntilDue(task, today);
  return diff >= 0 && diff <= days;
}

export function taskDueLabel(task: GeneralTask): string {
  if (task.status === 'completada') return 'Completada';
  const diff = taskDaysUntilDue(task);
  if (diff < 0) {
    const days = Math.abs(diff);
    return days === 1 ? 'Vencida hace 1 día' : `Vencida hace ${days} días`;
  }
  if (diff === 0) return 'Vence hoy';
  if (diff === 1) return 'Vence mañana';
  return `Vence en ${diff} días`;
}
