import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const bugReportInclude = {
  profiles_bug_reports_reported_byToprofiles: { select: { id: true, first_name: true, last_name: true, email: true } },
  profiles_bug_reports_approved_byToprofiles: { select: { id: true, first_name: true, last_name: true } },
};

function normalize(b: any) {
  return {
    ...b,
    reporter: b.profiles_bug_reports_reported_byToprofiles,
    approver: b.profiles_bug_reports_approved_byToprofiles,
  };
}

@Injectable()
export class BugReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: Record<string, unknown>) {
    const where: any = {};
    if (typeof query.status === 'string') where.status = query.status;
    if (typeof query.category === 'string') where.category = query.category;
    if (typeof query.target_repo === 'string') where.target_repo = query.target_repo;

    const limit = Math.min(Number(query.limit) || 50, 200);
    const offset = Number(query.offset) || 0;

    const [rows, count] = await Promise.all([
      this.prisma.bug_reports.findMany({
        where,
        include: bugReportInclude,
        orderBy: { created_at: 'desc' },
        skip: offset,
        take: limit,
      }),
      this.prisma.bug_reports.count({ where }),
    ]);

    return { success: true, data: rows.map(normalize), total: count, limit, offset };
  }

  async getStats() {
    const statuses = ['pending', 'investigating', 'fixing', 'blocked', 'merged', 'deployed', 'failed'];
    const counts: Record<string, number> = {};
    for (const status of statuses) {
      counts[status] = await this.prisma.bug_reports.count({ where: { status: status as any } });
    }
    const stats: any = { ...counts, total: Object.values(counts).reduce((a, b) => a + b, 0) };
    stats.active = stats.pending + stats.investigating + stats.fixing + stats.blocked;
    return { success: true, data: stats };
  }

  getRepos() {
    return { success: true, data: ['clickbitau/clickbit', 'clickbitau/clickbit-admin', 'clickbitau/click-deploy'] };
  }

  getConfig() {
    return {
      success: true,
      data: {
        devin: { configured: false, status: null },
        github: { configured: false, status: null },
      },
    };
  }

  async findOne(user: any, id: number) {
    const bugReport = await this.prisma.bug_reports.findUnique({ where: { id }, include: bugReportInclude });
    if (!bugReport) throw new NotFoundException('Bug report not found');
    const role = String(user.role).toLowerCase();
    if (!['admin', 'manager'].includes(role) && bugReport.reported_by !== user.id) {
      throw new ForbiddenException('Not authorized to view this bug report');
    }
    return { success: true, data: { ...normalize(bugReport), pipelineStatus: null } };
  }

  async prDetails(id: number) {
    const bugReport = await this.prisma.bug_reports.findUnique({ where: { id } });
    if (!bugReport) throw new NotFoundException('Bug report not found');
    if (!bugReport.pull_request_number) throw new BadRequestException('No pull request associated with this bug report');
    return {
      success: true,
      data: {
        bugReportId: bugReport.id,
        bugTitle: bugReport.title,
        pullRequestUrl: bugReport.pull_request_url,
        pullRequestNumber: bugReport.pull_request_number,
      },
    };
  }

  async create(userId: number, dto: any) {
    const bugReport = await this.prisma.bug_reports.create({
      data: {
        title: dto.title,
        description: dto.description,
        category: dto.category || 'other',
        priority: dto.priority || 'medium',
        screenshot_url: dto.screenshot_url,
        target_repo: dto.target_repo || 'clickbitau/clickbit',
        require_approval: dto.require_approval ?? false,
        reported_by: userId,
        status: 'pending',
      },
      include: bugReportInclude,
    });

    return { success: true, data: normalize(bugReport), pipeline: { started: false, message: 'Pipeline integration not implemented' } };
  }

  async updateStatus(id: number, dto: any) {
    const bugReport = await this.prisma.bug_reports.update({
      where: { id },
      data: { status: dto.status },
      include: bugReportInclude,
    });
    return { success: true, data: normalize(bugReport) };
  }

  async markFixed(userId: number, id: number, dto: any) {
    const prNumber = this.getPRNumberFromUrl(dto.pull_request_url);
    const bugReport = await this.prisma.bug_reports.update({
      where: { id },
      data: {
        pull_request_url: dto.pull_request_url,
        pull_request_number: prNumber,
        fix_summary: dto.fix_summary || 'Fix applied',
        status: 'merged',
        approved_by: userId,
        approved_at: new Date(),
      },
      include: bugReportInclude,
    });
    return { success: true, data: normalize(bugReport) };
  }

  syncAll() {
    return { success: true, data: { synced: 0, message: 'Devin session sync not implemented' } };
  }

  async syncOne(id: number) {
    const bugReport = await this.prisma.bug_reports.findUnique({ where: { id } });
    if (!bugReport) throw new NotFoundException('Bug report not found');
    return { success: true, message: 'Devin session sync not implemented', previousStatus: bugReport.status, newStatus: bugReport.status, data: normalize(bugReport) };
  }

  async retry(id: number) {
    const bugReport = await this.prisma.bug_reports.findUnique({ where: { id } });
    if (!bugReport) throw new NotFoundException('Bug report not found');
    if (!['failed', 'cancelled'].includes(bugReport.status || '')) {
      throw new BadRequestException('Can only retry failed or cancelled bug reports');
    }
    const updated = await this.prisma.bug_reports.update({ where: { id }, data: { status: 'pending' }, include: bugReportInclude });
    return { success: true, data: normalize(updated), pipeline: { retried: false, message: 'Pipeline retry not implemented' } };
  }

  async approve(id: number) {
    const bugReport = await this.prisma.bug_reports.findUnique({ where: { id } });
    if (!bugReport) throw new NotFoundException('Bug report not found');
    if (!bugReport.pull_request_url) throw new BadRequestException('No pull request to approve');
    const updated = await this.prisma.bug_reports.update({ where: { id }, data: { status: 'merged' }, include: bugReportInclude });
    return { success: true, data: normalize(updated), result: { merged: false, message: 'Auto-merge not implemented' } };
  }

  async forceMerge(userId: number, id: number) {
    const bugReport = await this.prisma.bug_reports.findUnique({ where: { id } });
    if (!bugReport) throw new NotFoundException('Bug report not found');
    if (!bugReport.pull_request_url || !bugReport.pull_request_number) {
      throw new BadRequestException('No pull request associated with this bug report');
    }
    const updated = await this.prisma.bug_reports.update({
      where: { id },
      data: { status: 'merged', merged_at: new Date(), approved_by: userId, approved_at: new Date() },
      include: bugReportInclude,
    });
    return { success: true, message: `PR #${bugReport.pull_request_number} marked as merged`, data: normalize(updated) };
  }

  async cancel(id: number) {
    const bugReport = await this.prisma.bug_reports.findUnique({ where: { id } });
    if (!bugReport) throw new NotFoundException('Bug report not found');
    const updated = await this.prisma.bug_reports.update({ where: { id }, data: { status: 'cancelled' }, include: bugReportInclude });
    return { success: true, data: normalize(updated), result: { cancelled: true } };
  }

  async remove(id: number) {
    const bugReport = await this.prisma.bug_reports.findUnique({ where: { id } });
    if (!bugReport) throw new NotFoundException('Bug report not found');
    if (!['pending', 'failed', 'cancelled'].includes(bugReport.status || '')) {
      throw new BadRequestException('Cannot delete bug reports that are in progress or completed');
    }
    await this.prisma.bug_reports.delete({ where: { id } });
    return { success: true, message: 'Bug report deleted' };
  }

  private getPRNumberFromUrl(url: string): number | null {
    const match = url.match(/\/pull\/(\d+)/);
    return match ? Number(match[1]) : null;
  }
}
