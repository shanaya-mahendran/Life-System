/**
 * Week-scoped task maths.
 *
 * Adherence used to be computed as "every task ever marked done" divided by
 * "every task ever created", which then got labelled "this week". That number
 * barely moves when you tick something off and it drifts as new tasks are
 * added, so Today could sit on the same percentage for days.
 *
 * These helpers scope everything to the week: a task counts if it is due in
 * the week or was completed in it. The same rules feed the Today header, the
 * sidebar and the weekly review, so the three never disagree.
 */

export interface WeekTaskLike {
  status: string;
  dueDate: Date | null;
  /** Not every caller loads it; without it a task still counts as due. */
  completedAt?: Date | null;
}

export interface WeekTaskSummary {
  /** Tasks due in the week plus tasks completed in it. */
  total: number;
  /** Tasks completed inside the week. */
  done: number;
  /** Due in the week, still open, and already past its due date. */
  slipped: number;
  /** 0–100, rounded. Zero when nothing was scheduled. */
  adherence: number;
}

export function summariseWeekTasks(
  tasks: WeekTaskLike[],
  weekStart: Date,
  weekEnd: Date,
  now: Date = new Date(),
): WeekTaskSummary {
  let total = 0;
  let done = 0;
  let slipped = 0;

  for (const task of tasks) {
    const dueInWeek = task.dueDate !== null && task.dueDate >= weekStart && task.dueDate < weekEnd;
    const completedAt = task.completedAt ?? null;
    const completedInWeek = completedAt !== null && completedAt >= weekStart && completedAt < weekEnd;

    if (!dueInWeek && !completedInWeek) continue;
    total += 1;
    if (completedInWeek) {
      done += 1;
    } else if (dueInWeek && task.dueDate !== null && task.dueDate < now) {
      slipped += 1;
    }
  }

  return { total, done, slipped, adherence: total === 0 ? 0 : Math.round((done / total) * 100) };
}

/** Tasks that belong to today: due today, or completed today. */
export function summariseDayTasks(
  tasks: WeekTaskLike[],
  dayStart: Date,
  dayEnd: Date,
): { total: number; done: number; open: number; overdueOpen: number } {
  let total = 0;
  let done = 0;
  let open = 0;
  let overdueOpen = 0;

  for (const task of tasks) {
    const dueToday = task.dueDate !== null && task.dueDate >= dayStart && task.dueDate < dayEnd;
    const completedAt = task.completedAt ?? null;
    const completedToday = completedAt !== null && completedAt >= dayStart && completedAt < dayEnd;
    if (!dueToday && !completedToday) continue;

    total += 1;
    if (completedToday || (dueToday && task.status === "done")) {
      done += 1;
    } else {
      open += 1;
      if (task.dueDate !== null && task.dueDate < dayStart) overdueOpen += 1;
    }
  }

  return { total, done, open, overdueOpen };
}
