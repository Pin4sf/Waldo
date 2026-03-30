/**
 * Google Tasks JSON parser.
 * Extracts tasks with: title, status, due date, completion time, list name.
 * Computes task metrics: pile-up, velocity, procrastination index.
 */
import * as fs from 'node:fs';

export interface TaskItem {
  title: string;
  status: 'needsAction' | 'completed';
  createdDate: Date;
  completedDate: Date | null;
  scheduledDate: Date | null;
  listName: string;
  notes: string;
  /** Time from creation to completion in hours */
  completionTimeHours: number | null;
}

export interface TaskMetrics {
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  completionRate: number;
  /** Average hours from creation to completion */
  avgCompletionTimeHours: number;
  /** Tasks overdue (scheduled but not completed, past date) */
  overdueTasks: number;
  /** Tasks by day-of-week list */
  tasksByDay: Record<string, { total: number; completed: number; pending: number }>;
  /** Recent task activity (last 7 days) */
  recentVelocity: number;
  /** All tasks for lookup */
  allTasks: TaskItem[];
}

export function parseGoogleTasks(filePath: string): TaskMetrics {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as {
    items: Array<{
      title: string;
      items?: Array<{
        title: string;
        status: string;
        created: string;
        completed?: string;
        scheduled_time?: Array<{ start: string }>;
        notes?: string;
      }>;
    }>;
  };

  const allTasks: TaskItem[] = [];
  const tasksByDay: Record<string, { total: number; completed: number; pending: number }> = {};

  for (const list of raw.items) {
    const listName = list.title;

    // Initialize day tracking
    if (!tasksByDay[listName]) {
      tasksByDay[listName] = { total: 0, completed: 0, pending: 0 };
    }

    if (!list.items) continue;

    for (const task of list.items) {
      const createdDate = new Date(task.created);
      const completedDate = task.completed ? new Date(task.completed) : null;
      const scheduledDate = task.scheduled_time?.[0]?.start ? new Date(task.scheduled_time[0].start) : null;
      const status = task.status === 'completed' ? 'completed' as const : 'needsAction' as const;

      const completionTimeHours = completedDate && createdDate
        ? (completedDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60)
        : null;

      allTasks.push({
        title: task.title,
        status,
        createdDate,
        completedDate,
        scheduledDate,
        listName,
        notes: task.notes ?? '',
        completionTimeHours,
      });

      tasksByDay[listName]!.total++;
      if (status === 'completed') tasksByDay[listName]!.completed++;
      else tasksByDay[listName]!.pending++;
    }
  }

  const completed = allTasks.filter(t => t.status === 'completed');
  const pending = allTasks.filter(t => t.status === 'needsAction');
  const completionTimes = completed
    .map(t => t.completionTimeHours)
    .filter((t): t is number => t !== null && t > 0);

  // Overdue: scheduled before now, not completed
  const now = new Date();
  const overdue = pending.filter(t => t.scheduledDate && t.scheduledDate < now).length;

  // Recent velocity: completed in last 7 days
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const recentCompleted = completed.filter(t => t.completedDate && t.completedDate > weekAgo).length;

  return {
    totalTasks: allTasks.length,
    completedTasks: completed.length,
    pendingTasks: pending.length,
    completionRate: allTasks.length > 0 ? completed.length / allTasks.length : 0,
    avgCompletionTimeHours: completionTimes.length > 0
      ? completionTimes.reduce((s, t) => s + t, 0) / completionTimes.length
      : 0,
    overdueTasks: overdue,
    tasksByDay,
    recentVelocity: recentCompleted / 7,
    allTasks,
  };
}

/** Build a natural language summary of tasks for the prompt */
export function buildTasksSummary(metrics: TaskMetrics): string {
  const parts: string[] = [];

  parts.push(`${metrics.totalTasks} tasks tracked (${metrics.completedTasks} done, ${metrics.pendingTasks} pending).`);

  if (metrics.overdueTasks > 0) {
    parts.push(`${metrics.overdueTasks} overdue.`);
  }

  parts.push(`Completion rate: ${Math.round(metrics.completionRate * 100)}%.`);

  if (metrics.avgCompletionTimeHours > 0) {
    const hours = metrics.avgCompletionTimeHours;
    if (hours < 24) parts.push(`Avg completion: ${Math.round(hours)}h.`);
    else parts.push(`Avg completion: ${(hours / 24).toFixed(1)} days.`);
  }

  parts.push(`Recent velocity: ${metrics.recentVelocity.toFixed(1)} tasks/day.`);

  // Day-of-week breakdown
  const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const dayParts: string[] = [];
  for (const day of dayOrder) {
    const data = metrics.tasksByDay[day];
    if (data && data.total > 0) {
      dayParts.push(`${day}: ${data.total} (${data.completed} done)`);
    }
  }
  if (dayParts.length > 0) {
    parts.push(`By day: ${dayParts.join(', ')}.`);
  }

  // Pending tasks
  const pendingList = metrics.allTasks
    .filter(t => t.status === 'needsAction')
    .slice(0, 5)
    .map(t => t.title.trim());
  if (pendingList.length > 0) {
    parts.push(`Pending: ${pendingList.join('; ')}.`);
  }

  return parts.join(' ');
}
