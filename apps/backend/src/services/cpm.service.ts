/**
 * BuildFlow - Critical Path Method (CPM) service.
 *
 * Forward pass: Early Start (ES) + Early Finish (EF).
 * Backward pass: Late Start (LS) + Late Finish (LF).
 * Float = LS - ES. Critical path = tasks where Float = 0.
 *
 * Supports FS / SS / FF / SF dependency types with lag days.
 */
import type { DependencyType } from '@buildflow/shared';
import { ApiError } from '../utils/errors';

export interface CpmTask {
  id: string;
  durationDays: number;
  startDate: Date | null;
  endDate: Date | null;
}

export interface CpmDependency {
  taskId: string;
  predecessorId: string;
  type: DependencyType;
  lagDays: number;
}

export interface CpmResult {
  earlyStart: Map<string, number>; // day offset from project start
  earlyFinish: Map<string, number>;
  lateStart: Map<string, number>;
  lateFinish: Map<string, number>;
  float: Map<string, number>;
  criticalPath: string[];
  projectDurationDays: number;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Topological sort (Kahn's algorithm) respecting predecessor relationships.
 *
 * FIX (FIN-H7): Throws on cycle instead of silently breaking it.
 */
function topoSort(tasks: CpmTask[], deps: CpmDependency[]): string[] {
  const inDegree = new Map<string, number>();
  const graph = new Map<string, string[]>();
  for (const t of tasks) {
    inDegree.set(t.id, 0);
    graph.set(t.id, []);
  }
  for (const d of deps) {
    if (!graph.has(d.predecessorId) || !inDegree.has(d.taskId)) continue;
    graph.get(d.predecessorId)!.push(d.taskId);
    inDegree.set(d.taskId, (inDegree.get(d.taskId) ?? 0) + 1);
  }
  const queue = tasks.filter((t) => (inDegree.get(t.id) ?? 0) === 0).map((t) => t.id);
  const sorted: string[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    sorted.push(node);
    for (const succ of graph.get(node) ?? []) {
      const nd = (inDegree.get(succ) ?? 1) - 1;
      inDegree.set(succ, nd);
      if (nd === 0) queue.push(succ);
    }
  }
  if (sorted.length < tasks.length) {
    const cyclic = tasks.filter((t) => !sorted.includes(t.id)).map((t) => t.id);
    // FIX (NR-19): Throw a clean ApiError so the Express error middleware
    // returns a 400 instead of a 500. Previously this threw a plain Error →
    // generic 500 on the Gantt endpoint.
    throw ApiError.badRequest(
      `Cycle detected in task dependencies. Tasks involved: ${cyclic.join(', ')}.`,
    );
  }
  return sorted;
}

/**
 * Compute CPM. All dates are converted to integer day offsets.
 * Uses start-date-based scheduling; if no dates provided, uses duration only.
 */
export function computeCriticalPath(tasks: CpmTask[], deps: CpmDependency[]): CpmResult {
  const duration = new Map<string, number>();
  for (const t of tasks) duration.set(t.id, Math.max(1, t.durationDays));

  // Predecessors per task
  const predsOf = new Map<string, CpmDependency[]>();
  for (const t of tasks) predsOf.set(t.id, []);
  for (const d of deps) {
    if (predsOf.has(d.taskId)) predsOf.get(d.taskId)!.push(d);
  }

  const order = topoSort(tasks, deps);

  /* ---- Forward pass: ES, EF ---- */
  const earlyStart = new Map<string, number>();
  const earlyFinish = new Map<string, number>();

  for (const id of order) {
    const dur = duration.get(id) ?? 1;
    const preds = predsOf.get(id) ?? [];
    let es = 0;
    for (const p of preds) {
      const pEF = earlyFinish.get(p.predecessorId) ?? 0;
      const pES = earlyStart.get(p.predecessorId) ?? 0;
      switch (p.type) {
        case 'FS':
          // FIX (FIN-H6): successor starts after predecessor finishes + lag.
          es = Math.max(es, pEF + p.lagDays);
          break;
        case 'SS':
          // FIX (FIN-H6): successor starts after predecessor starts + lag.
          es = Math.max(es, pES + p.lagDays);
          break;
        case 'FF':
          // FIX (FIN-H6): successor must finish after predecessor finishes + lag.
          // So: successor_earlyFinish >= pEF + lag → es >= pEF + lag - dur.
          // The old formula incorrectly added `pDur`.
          es = Math.max(es, pEF + p.lagDays - dur);
          break;
        case 'SF':
          // FIX (FIN-H6): successor finishes after predecessor starts + lag.
          // So: successor_earlyFinish >= pES + lag → es >= pES + lag - dur.
          es = Math.max(es, pES + p.lagDays - dur);
          break;
        default:
          es = Math.max(es, pEF + p.lagDays);
      }
    }
    earlyStart.set(id, es);
    earlyFinish.set(id, es + dur);
  }

  const projectEnd = Math.max(0, ...Array.from(earlyFinish.values()));

  /* ---- Backward pass: LS, LF ---- */
  const lateStart = new Map<string, number>();
  const lateFinish = new Map<string, number>();
  const reverseOrder = [...order].reverse();

  for (const id of reverseOrder) {
    const dur = duration.get(id) ?? 1;
    // Find successors of `id`
    const successors = deps.filter((d) => d.predecessorId === id);
    let lf = projectEnd;
    for (const s of successors) {
      const sLS = lateStart.get(s.taskId) ?? projectEnd;
      const sLF = lateFinish.get(s.taskId) ?? projectEnd;
      switch (s.type) {
        case 'FS':
          lf = Math.min(lf, sLS - s.lagDays);
          break;
        case 'SS':
          lf = Math.min(lf, sLS - s.lagDays + dur);
          break;
        case 'FF':
          lf = Math.min(lf, sLF - s.lagDays);
          break;
        case 'SF':
          lf = Math.min(lf, sLF + dur - s.lagDays);
          break;
        default:
          lf = Math.min(lf, sLS - s.lagDays);
      }
    }
    lateFinish.set(id, lf);
    lateStart.set(id, lf - dur);
  }

  /* ---- Float + critical path ---- */
  const float = new Map<string, number>();
  const criticalPath: string[] = [];
  for (const t of tasks) {
    const f = (lateStart.get(t.id) ?? 0) - (earlyStart.get(t.id) ?? 0);
    float.set(t.id, f);
    if (f === 0) criticalPath.push(t.id);
  }

  return {
    earlyStart,
    earlyFinish,
    lateStart,
    lateFinish,
    float,
    criticalPath,
    projectDurationDays: projectEnd,
  };
}

/** Convert a day offset to an ISO date string, given a project start date. */
export function offsetToDate(projectStart: Date, offset: number): string {
  const d = new Date(projectStart.getTime() + offset * MS_PER_DAY);
  return d.toISOString();
}