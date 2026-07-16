import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DevinService } from './devin.service';
import { GithubService } from './github.service';
import { BugFixPipelineService } from './bug-fix-pipeline.service';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly devin: DevinService,
    private readonly github: GithubService,
    private readonly pipeline: BugFixPipelineService,
  ) {}

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

  async getRepos() {
    const repos = await this.pipeline.getAvailableRepos();
    return { success: true, data: repos };
  }

  async getConfig() {
    const devinConfigured = this.devin.isConfigured();
    const githubConfigured = this.github.isConfigured();

    const [devinStatus, githubStatus] = await Promise.all([
      devinConfigured ? this.devin.testConnection().catch(() => ({ success: false, error: 'test failed' })) : Promise.resolve(null),
      githubConfigured ? this.github.testConnection().catch(() => ({ success: false, error: 'test failed' })) : Promise.resolve(null),
    ]);

    return {
      success: true,
      data: {
        devin: { configured: devinConfigured, status: devinStatus },
        github: { configured: githubConfigured, status: githubStatus },
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
    return { success: true, data: { ...normalize(bugReport), pipelineStatus: this.pipeline.getPipelineStatus(id) } };
  }

  async prDetails(id: number) {
    const bugReport = await this.prisma.bug_reports.findUnique({ where: { id } });
    if (!bugReport) throw new NotFoundException('Bug report not found');
    if (!bugReport.pull_request_number) throw new BadRequestException('No pull request associated with this bug report');

    let prDetails: any = null;
    if (this.github.isConfigured()) {
      try {
        const repoInfo = this.github.parseRepoFromUrl(bugReport.pull_request_url || '');
        prDetails = await this.github.getPRDetails(bugReport.pull_request_number, repoInfo?.owner, repoInfo?.repo);
      } catch (error: any) {
        prDetails = { error: error.message };
      }
    }

    return {
      success: true,
      data: {
        bugReportId: bugReport.id,
        bugTitle: bugReport.title,
        pullRequestUrl: bugReport.pull_request_url,
        pullRequestNumber: bugReport.pull_request_number,
        ...prDetails,
      },
    };
  }

  async create(user: any, dto: any) {
    const isAdminOrManager = ['admin', 'manager'].includes(String(user.role).toLowerCase());
    const safeRequireApproval = isAdminOrManager ? (dto.require_approval ?? false) : true;

    const bugReport = await this.prisma.bug_reports.create({
      data: {
        title: dto.title,
        description: dto.description,
        category: dto.category || 'other',
        priority: dto.priority || 'medium',
        screenshot_url: dto.screenshot_url,
        target_repo: dto.target_repo || 'clickbitau/clickbit',
        require_approval: safeRequireApproval,
        reported_by: user.id,
        status: 'pending',
      },
      include: bugReportInclude,
    });

    const pipelineResult = await this.pipeline.startPipeline(bugReport, {
      autoMerge: !safeRequireApproval,
      requireApproval: safeRequireApproval,
    });

    const updated = await this.prisma.bug_reports.findUnique({ where: { id: bugReport.id }, include: bugReportInclude });
    return { success: true, data: normalize(updated || bugReport), pipeline: pipelineResult };
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
    const prNumber = this.github.getPRNumberFromUrl(dto.pull_request_url);
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

    if (dto.auto_merge && prNumber) {
      await this.pipeline.approveAndMerge(id, userId).catch((error: any) => {
        console.error(`[BugReportsService] Auto-merge failed for bug #${id}:`, error.message);
      });
    }

    return { success: true, data: normalize(bugReport) };
  }

  async syncAll() {
    const result = await this.pipeline.syncAllActive();
    return { success: true, data: result };
  }

  async syncOne(id: number) {
    const bugReport = await this.prisma.bug_reports.findUnique({ where: { id } });
    if (!bugReport) throw new NotFoundException('Bug report not found');
    const previousStatus = bugReport.status;
    const result = await this.pipeline.syncBugReport(id);
    const updated = await this.prisma.bug_reports.findUnique({ where: { id }, include: bugReportInclude });
    return {
      success: true,
      message: result ? `Status synced: ${previousStatus} → ${updated?.status}` : 'No changes',
      previousStatus,
      newStatus: updated?.status,
      data: normalize(updated || bugReport),
    };
  }

  async retry(id: number) {
    const bugReport = await this.prisma.bug_reports.findUnique({ where: { id } });
    if (!bugReport) throw new NotFoundException('Bug report not found');
    if (!['failed', 'cancelled'].includes(bugReport.status || '')) {
      throw new BadRequestException('Can only retry failed or cancelled bug reports');
    }

    const pipelineResult = await this.pipeline.retryPipeline(id, {
      autoMerge: !bugReport.require_approval,
      requireApproval: bugReport.require_approval,
    });

    const updated = await this.prisma.bug_reports.findUnique({ where: { id }, include: bugReportInclude });
    return { success: true, data: normalize(updated || bugReport), pipeline: pipelineResult };
  }

  async approve(userId: number, id: number) {
    const bugReport = await this.prisma.bug_reports.findUnique({ where: { id } });
    if (!bugReport) throw new NotFoundException('Bug report not found');
    if (!bugReport.pull_request_url) throw new BadRequestException('No pull request to approve');

    const result = await this.pipeline.approveAndMerge(id, userId);
    const updated = await this.prisma.bug_reports.findUnique({ where: { id }, include: bugReportInclude });
    return { success: true, data: normalize(updated || bugReport), result };
  }

  async forceMerge(userId: number, id: number) {
    const bugReport = await this.prisma.bug_reports.findUnique({ where: { id } });
    if (!bugReport) throw new NotFoundException('Bug report not found');
    if (!bugReport.pull_request_url || !bugReport.pull_request_number) {
      throw new BadRequestException('No pull request associated with this bug report');
    }

    const result = await this.pipeline.approveAndMerge(id, userId);
    const updated = await this.prisma.bug_reports.findUnique({ where: { id }, include: bugReportInclude });
    return { success: true, message: `PR #${bugReport.pull_request_number} merge attempted`, data: normalize(updated || bugReport), result };
  }

  async cancel(id: number) {
    await this.pipeline.cancelPipeline(id);
    const bugReport = await this.prisma.bug_reports.findUnique({ where: { id }, include: bugReportInclude });
    return { success: true, data: normalize(bugReport || {}), result: { cancelled: true } };
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
}
