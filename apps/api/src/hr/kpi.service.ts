import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';

interface UserLike {
  id: number;
  role: string;
}

export interface KpiResult {
  employee_id: number;
  period: string;
  total_score: number;
  punctuality_score: number;
  task_efficiency_score: number;
  task_timeliness_score: number;
  support_resolution_score: number;
  leadership_score: number;
  documentation_score: number;
  metadata: Record<string, unknown>;
}

@Injectable()
export class KpiService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(period: string, user: UserLike) {
    this.ensureAdminOrManager(user);
    const periodRegex = /^\d{4}-\d{2}$/;
    if (!periodRegex.test(period)) throw new NotFoundException('Invalid period format. Use YYYY-MM');

    const [year, month] = period.split('-').map((v) => parseInt(v, 10));
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);

    const employees = await this.prisma.employees.findMany({
      where: { employment_status: 'active' },
      include: { profiles: { select: { first_name: true, last_name: true, avatar: true, email: true } } },
    });
    const employeeMap = new Map(employees.map((e) => [e.id, e]));

    let stored: any[] = [];
    try {
      stored = await this.prisma.hr_kpi_scores.findMany({ where: { period }, orderBy: { total_score: 'desc' } });
    } catch (e: any) {
      if (e.code !== 'P2021') throw e;
    }

    if (stored.length > 0) {
      return { period, scores: stored.map((s) => this.mapScore(s, employeeMap.get(s.employee_id))) };
    }

    const scores = await Promise.all(
      employees.map((emp) =>
        this.calculateKpiScore(emp.id, start, end)
          .then((res) => this.mapScore(res, emp))
          .catch((err) => {
            console.error(`[KPI] failed for employee ${emp.id}:`, err.message);
            return null;
          }),
      ),
    );

    return { period, scores: scores.filter((s): s is any => s !== null) };
  }

  async employeeHistory(employeeId: number, user: UserLike) {
    await this.ensureAdminOrSelf(user, employeeId);
    let rows: any[] = [];
    try {
      rows = await this.prisma.hr_kpi_scores.findMany({
        where: { employee_id: employeeId },
        orderBy: { period: 'desc' },
      });
    } catch (e: any) {
      if (e.code !== 'P2021') throw e;
    }
    return rows.map((r) => this.mapScore(r));
  }

  async snapshot(period: string, user: UserLike) {
    this.ensureAdminOrManager(user);
    if (!/^\d{4}-\d{2}$/.test(period)) throw new NotFoundException('Invalid period format. Use YYYY-MM');

    const [year, month] = period.split('-').map((v) => parseInt(v, 10));
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);

    const employees = await this.prisma.employees.findMany({ where: { employment_status: 'active' } });
    const results: any[] = [];

    for (const emp of employees) {
      try {
        const scoreData = await this.calculateKpiScore(emp.id, start, end);
        const data: any = {
          employee_id: emp.id,
          period,
          total_score: scoreData.total_score,
          punctuality_score: scoreData.punctuality_score,
          task_efficiency_score: scoreData.task_efficiency_score,
          task_timeliness_score: scoreData.task_timeliness_score,
          support_resolution_score: scoreData.support_resolution_score,
          leadership_score: scoreData.leadership_score,
          documentation_score: scoreData.documentation_score,
          metadata: scoreData.metadata,
        };

        try {
          const record = await this.prisma.hr_kpi_scores.upsert({
            where: { employee_id_period: { employee_id: emp.id, period } },
            update: data,
            create: data,
          });
          results.push(record);
        } catch (e: any) {
          if (e.code !== 'P2021') throw e;
          results.push({ ...data, id: null, created_at: new Date(), updated_at: new Date() });
        }
      } catch (err: any) {
        console.error(`[KPI Snapshot] employee ${emp.id}:`, err.message);
      }
    }

    return {
      success: true,
      message: `Generated ${results.length} KPI snapshots for ${period}`,
      generatedCount: results.length,
    };
  }

  async live(employeeId: number, startDate?: string, endDate?: string) {
    const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = endDate ? new Date(endDate) : new Date();
    return this.calculateKpiScore(employeeId, start, end);
  }

  // ---------------------------------------------------------------------------
  // Calculation engine
  // ---------------------------------------------------------------------------

  private async calculateKpiScore(employeeId: number, start: Date, end: Date): Promise<KpiResult> {
    const employee = await this.prisma.employees.findUnique({
      where: { id: employeeId },
      include: { profiles: true },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    const isManagerUser = employee.profiles?.role === 'manager' || employee.profiles?.role === 'admin';

    // Punctuality
    const timeEntries = await this.prisma.hr_time_entries.findMany({
      where: {
        employee_id: employeeId,
        clock_in_time: { gte: start, lte: end },
      },
      include: { hr_shifts: true },
    });

    let lateMinutes = 0;
    let missingBreaks = 0;
    for (const entry of timeEntries) {
      if (entry.hr_shifts && entry.hr_shifts.start_datetime) {
        const expected = new Date(entry.hr_shifts.start_datetime);
        const actual = new Date(entry.clock_in_time);
        if (actual > expected) {
          const diff = (actual.getTime() - expected.getTime()) / (1000 * 60);
          if (diff > 5) lateMinutes += diff;
        }
        const scheduledBreak = entry.hr_shifts.scheduled_break_minutes || 0;
        if (scheduledBreak > 0) {
          const actualBreak = entry.break_minutes || 0;
          if (scheduledBreak - actualBreak > 10) missingBreaks += 1;
        }
      }
    }
    const punctualityDeductions = lateMinutes / 10 + missingBreaks * 2;
    const punctualityScore = Math.max(0, 30 - punctualityDeductions);

    // Tasks (efficiency & timeliness)
    const tasks = await this.prisma.project_tasks.findMany({
      where: {
        assigned_to: employee.user_id,
        completed_at: { gte: start, lte: end },
        status: 'completed',
      },
    });

    let taskEfficiencyScore = 0;
    let taskTimelinessScore = 0;
    let totalEstimated = 0;
    let totalActual = 0;
    let documentedTasks = 0;
    let daysEarlyLate = 0;
    let tasksWithDeadlines = 0;

    for (const task of tasks) {
      const expected = this.toNumber(task.estimated_hours) || this.toNumber(task.weight) || 2;
      const actual = this.toNumber(task.actual_hours) || expected;
      totalEstimated += expected;
      totalActual += actual;

      if (task.due_date && task.completed_at) {
        tasksWithDeadlines++;
        const due = new Date(task.due_date);
        const completed = new Date(task.completed_at);
        const diffDays = Math.ceil((completed.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
        daysEarlyLate += diffDays;
      }

      if (task.description && task.description.length > 20) documentedTasks += 1;
    }

    if (tasks.length > 0 && totalActual > 0) {
      taskEfficiencyScore = 30 * (totalEstimated / totalActual);
    }
    if (tasksWithDeadlines > 0) {
      const timeDeltaPoints = Math.max(-20, daysEarlyLate * -2);
      taskTimelinessScore = 20 + timeDeltaPoints;
    }

    // Tickets
    const tickets = await this.prisma.tickets.findMany({
      where: {
        assigned_to: employee.user_id,
        resolved_at: { gte: start, lte: end },
        status: { in: ['resolved', 'closed'] },
      },
    });

    let supportResolutionScore = 0;
    let documentedTickets = 0;
    if (tickets.length > 0) {
      supportResolutionScore = 20 * (tickets.length / 25);
      for (const t of tickets) {
        if (t.internal_notes && t.internal_notes.length > 10) documentedTickets += 1;
      }
    }

    // Documentation
    let documentationScore = 0;
    const totalActionable = tasks.length + tickets.length;
    if (totalActionable > 0) {
      documentationScore = 20 * ((documentedTasks + documentedTickets) / totalActionable);
    }

    // Leadership (phases managed)
    let leadershipScore = 0;
    let isManager = isManagerUser;
    let phasesManaged = 0;

    const managedPhases = await this.prisma.project_phases.findMany({
      where: {
        manager_id: employee.user_id,
        completed_date: { gte: start, lte: end },
        status: 'completed',
      },
    });

    if (managedPhases.length > 0) {
      isManager = true;
      phasesManaged = managedPhases.length;
      let latePhases = 0;
      for (const phase of managedPhases) {
        if (phase.due_date && phase.completed_date) {
          if (new Date(phase.completed_date) > new Date(phase.due_date)) latePhases += 1;
        }
      }
      const onTimeRatio = (managedPhases.length - latePhases) / managedPhases.length;
      leadershipScore = 50 * onTimeRatio;
    }

    // Aggregate
    let expectedBase = 30;
    let totalPoints = punctualityScore;
    if (tasks.length > 0) {
      expectedBase += 30;
      totalPoints += taskEfficiencyScore;
      if (tasksWithDeadlines > 0) {
        expectedBase += 20;
        totalPoints += taskTimelinessScore;
      }
    }
    if (tickets.length > 0) {
      expectedBase += 20;
      totalPoints += supportResolutionScore;
    }
    if (totalActionable > 0) {
      expectedBase += 20;
      totalPoints += documentationScore;
    }
    if (isManager && managedPhases.length > 0) {
      expectedBase += 50;
      totalPoints += leadershipScore;
    }

    const finalScore = expectedBase > 0 ? (totalPoints / expectedBase) * 100 : 0;
    const period = `${start.toISOString().substring(0, 7)}`;

    return {
      employee_id: employeeId,
      period,
      total_score: Math.round(finalScore * 100) / 100,
      punctuality_score: Math.round(punctualityScore * 100) / 100,
      task_efficiency_score: Math.round(taskEfficiencyScore * 100) / 100,
      task_timeliness_score: Math.round(taskTimelinessScore * 100) / 100,
      support_resolution_score: Math.round(supportResolutionScore * 100) / 100,
      documentation_score: Math.round(documentationScore * 100) / 100,
      leadership_score: Math.round(leadershipScore * 100) / 100,
      metadata: {
        lateMinutes,
        missingBreaks,
        taskCount: tasks.length,
        taskEstimatedHours: Math.round(totalEstimated * 100) / 100,
        taskActualHours: Math.round(totalActual * 100) / 100,
        taskTimelinessBase: tasksWithDeadlines,
        averageDaysDelta: tasksWithDeadlines > 0 ? (daysEarlyLate / tasksWithDeadlines).toFixed(1) : 0,
        ticketCount: tickets.length,
        documentedItemsRatio: `${documentedTasks + documentedTickets}/${totalActionable}`,
        managedPhasesCount: phasesManaged,
        scalingBase: expectedBase,
      },
    };
  }

  private mapScore(s: any, employee?: any) {
    return {
      id: s.id,
      employee_id: s.employee_id,
      employee,
      period: s.period,
      total_score: this.toNumber(s.total_score),
      punctuality_score: this.toNumber(s.punctuality_score),
      task_efficiency_score: this.toNumber(s.task_efficiency_score),
      task_timeliness_score: this.toNumber(s.task_timeliness_score),
      support_resolution_score: this.toNumber(s.support_resolution_score),
      leadership_score: this.toNumber(s.leadership_score),
      documentation_score: this.toNumber(s.documentation_score),
      metadata: s.metadata,
      created_at: s.created_at,
      updated_at: s.updated_at,
    };
  }

  private async ensureAdminOrSelf(user: UserLike, employeeId: number) {
    if (['admin', 'manager', 'hr'].includes(user.role.toLowerCase())) return;
    const emp = await this.prisma.employees.findFirst({ where: { id: employeeId, user_id: user.id } });
    if (!emp) throw new ForbiddenException('Not authorized to view this KPI history');
  }

  private ensureAdminOrManager(user: UserLike) {
    if (!['admin', 'manager', 'hr'].includes(user.role.toLowerCase())) {
      throw new ForbiddenException('Not authorized');
    }
  }

  private toNumber(value: unknown): number {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return value;
    if (value instanceof Decimal) return value.toNumber();
    const n = Number(value);
    return Number.isNaN(n) ? 0 : n;
  }
}
