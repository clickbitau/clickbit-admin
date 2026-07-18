import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DevinService } from './devin.service';
import { GithubService } from './github.service';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const ENDED_STATUSES = ['suspended', 'exit', 'expired', 'finished', 'stopped'];

@Injectable()
export class BugFixPipelineService {
  private activePipelines = new Map<
    number,
    { sessionId: string; status: string; startedAt: Date; lastStatus?: string }
  >();
  private repoCache: any[] | null = null;
  private repoCacheExpiry = 0;
  private readonly cacheTtlMs = 5 * 60 * 1000;
  private isSyncing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly devin: DevinService,
    private readonly github: GithubService,
  ) {}

  isDevinConfigured(): boolean {
    return this.devin.isConfigured();
  }

  // -------------------------------------------------------------------------
  // Pipeline lifecycle
  // -------------------------------------------------------------------------

  async startPipeline(bugReport: any, options: { autoMerge?: boolean; requireApproval?: boolean } = {}): Promise<any> {
    const pipelineId = bugReport.id;

    try {
      await this.prisma.bug_reports.update({
        where: { id: pipelineId },
        data: { status: 'investigating', error_message: null },
      });

      const targetRepo = bugReport.target_repo || 'clickbitau/clickbit';
      const prompt = this.buildDevinPrompt(bugReport);

      if (!this.devin.isConfigured()) {
        await this.prisma.bug_reports.update({
          where: { id: pipelineId },
          data: { status: 'failed', error_message: 'Devin API is not configured' },
        });
        return { success: false, error: 'Devin API is not configured' };
      }

      const session = await this.devin.createSession(prompt, {
        title: `Bug Fix: ${bugReport.title}`,
        repo: targetRepo,
        tags: ['bug-fix', `bug-${pipelineId}`, bugReport.category || 'other'],
      });

      await this.prisma.bug_reports.update({
        where: { id: pipelineId },
        data: {
          devin_session_id: session.id,
          devin_session_url: session.url || this.devin.getSessionUrl(session.id),
          status: 'fixing',
        },
      });

      this.activePipelines.set(pipelineId, {
        sessionId: session.id,
        status: 'fixing',
        startedAt: new Date(),
      });

      this.pollAndComplete(pipelineId, session.id, options).catch((error: any) => {
        console.error(`[BugFix Pipeline ${pipelineId}] Pipeline error:`, error);
        this.prisma.bug_reports
          .update({ where: { id: pipelineId }, data: { status: 'failed', error_message: error.message } })
          .catch(() => {});
      });

      return {
        success: true,
        sessionId: session.id,
        sessionUrl: session.url || this.devin.getSessionUrl(session.id),
        message: 'Bug fix pipeline started with Devin',
      };
    } catch (error: any) {
      console.error(`[BugFix Pipeline ${pipelineId}] Failed to start:`, error);
      await this.prisma.bug_reports.update({
        where: { id: pipelineId },
        data: { status: 'failed', error_message: error.message },
      });
      return { success: false, error: error.message };
    }
  }

  private async pollAndComplete(bugReportId: number, sessionId: string, options: { autoMerge?: boolean; requireApproval?: boolean } = {}) {
    const { autoMerge = true, requireApproval = false } = options;

    console.log(`[BugFix Pipeline ${bugReportId}] Starting poll for Devin session ${sessionId}`);

    const result = await this.devin.pollSessionUntilComplete(sessionId, 360, 10000, (progress) => {
      const pipeline = this.activePipelines.get(bugReportId);
      if (pipeline) pipeline.lastStatus = progress.status;
    });

    if (!result.success) {
      console.error(`[BugFix Pipeline ${bugReportId}] Devin session failed:`, result.error);
      await this.prisma.bug_reports.update({
        where: { id: bugReportId },
        data: { status: 'failed', error_message: result.error },
      });
      this.activePipelines.delete(bugReportId);
      return;
    }

    const session = result.session;
    const bugReport = await this.prisma.bug_reports.findUnique({ where: { id: bugReportId } });
    if (!bugReport) {
      this.activePipelines.delete(bugReportId);
      return;
    }

    const targetRepo = bugReport.target_repo || 'clickbitau/clickbit';
    const prInfo = this.devin.extractPRFromSession(session, targetRepo);

    if (!prInfo) {
      await this.prisma.bug_reports.update({
        where: { id: bugReportId },
        data: {
          status: 'failed',
          error_message: 'Devin completed but no PR was detected',
          fix_summary: 'Session completed without creating a pull request',
        },
      });
      this.activePipelines.delete(bugReportId);
      return;
    }

    const prNumber = this.github.getPRNumberFromUrl(prInfo.url);
    await this.prisma.bug_reports.update({
      where: { id: bugReportId },
      data: {
        pull_request_url: prInfo.url,
        pull_request_number: prNumber,
        fix_summary: prInfo.title || 'Fix applied',
      },
    });

    if (autoMerge && !requireApproval && !bugReport.require_approval) {
      await this.attemptAutoMerge(bugReportId);
    } else if (bugReport.require_approval || requireApproval) {
      await this.prisma.bug_reports.update({
        where: { id: bugReportId },
        data: { status: 'blocked', error_message: 'PR is ready and waiting for your approval to merge' },
      });
    }

    this.activePipelines.delete(bugReportId);
  }

  async attemptAutoMerge(bugReportId: number): Promise<any> {
    const bugReport = await this.prisma.bug_reports.findUnique({ where: { id: bugReportId } });
    if (!bugReport || !bugReport.pull_request_number) {
      return { merged: false, reason: 'No PR number found' };
    }

    const repoInfo = this.github.parseRepoFromUrl(bugReport.pull_request_url || '');
    const owner = repoInfo?.owner;
    const repo = repoInfo?.repo;

    try {
      let mergeStatus = await this.github.isPRMergeable(bugReport.pull_request_number, owner, repo);

      if (!mergeStatus.mergeable) {
        await sleep(10000);
        mergeStatus = await this.github.isPRMergeable(bugReport.pull_request_number, owner, repo);
        if (!mergeStatus.mergeable) {
          await this.prisma.bug_reports.update({
            where: { id: bugReportId },
            data: {
              status: 'blocked',
              error_message: `PR not mergeable: ${mergeStatus.mergeableState || mergeStatus.error || 'unknown'}`,
            },
          });
          return { merged: false, reason: mergeStatus.mergeableState || mergeStatus.error || 'not mergeable' };
        }
      }

      const mergeResult = await this.github.mergePullRequest(bugReport.pull_request_number, {
        owner,
        repo,
        mergeMethod: 'squash',
        commitTitle: `fix: ${bugReport.title} (#${bugReport.pull_request_number})`,
        commitMessage: `Automated bug fix from Bug Report #${bugReport.id}\n\n${bugReport.description}`,
      });

      if (mergeResult.success) {
        await this.prisma.bug_reports.update({
          where: { id: bugReportId },
          data: { status: 'merged', merged_at: new Date(), error_message: null },
        });
        setTimeout(() => {
          this.prisma.bug_reports.update({ where: { id: bugReportId }, data: { status: 'deployed', deployed_at: new Date() } }).catch(() => {});
        }, 180000);
        return { merged: true, sha: mergeResult.sha };
      }

      await this.prisma.bug_reports.update({
        where: { id: bugReportId },
        data: { status: 'blocked', error_message: mergeResult.error || 'PR merge failed' },
      });
      return { merged: false, reason: mergeResult.error || 'PR merge failed' };
    } catch (error: any) {
      console.error(`[BugFix Pipeline ${bugReportId}] Auto-merge failed:`, error);
      await this.prisma.bug_reports.update({
        where: { id: bugReportId },
        data: { status: 'blocked', error_message: error.message },
      });
      return { merged: false, reason: error.message };
    }
  }

  async retryPipeline(bugReportId: number, options: any = {}): Promise<any> {
    await this.prisma.bug_reports.update({
      where: { id: bugReportId },
      data: {
        status: 'pending',
        error_message: null,
        devin_session_id: null,
        devin_session_url: null,
        pull_request_url: null,
        pull_request_number: null,
      },
    });

    const bugReport = await this.prisma.bug_reports.findUnique({ where: { id: bugReportId } });
    if (!bugReport) throw new Error('Bug report not found');
    return this.startPipeline(bugReport, options);
  }

  async approveAndMerge(bugReportId: number, approverId: number): Promise<any> {
    const bugReport = await this.prisma.bug_reports.findUnique({ where: { id: bugReportId } });
    if (!bugReport) throw new Error('Bug report not found');
    if (!bugReport.pull_request_url) throw new Error('No pull request to approve');

    await this.prisma.bug_reports.update({
      where: { id: bugReportId },
      data: { approved_by: approverId, approved_at: new Date() },
    });

    return this.attemptAutoMerge(bugReportId);
  }

  async cancelPipeline(bugReportId: number): Promise<{ success: boolean }> {
    this.activePipelines.delete(bugReportId);
    await this.prisma.bug_reports.update({ where: { id: bugReportId }, data: { status: 'cancelled' } });
    return { success: true };
  }

  getPipelineStatus(bugReportId: number): any {
    return this.activePipelines.get(bugReportId) || null;
  }

  // -------------------------------------------------------------------------
  // Session sync
  // -------------------------------------------------------------------------

  async syncAllActive(): Promise<any> {
    if (this.isSyncing) return { skipped: true, reason: 'Sync already in progress' };
    this.isSyncing = true;

    try {
      const activeReports = await this.prisma.bug_reports.findMany({
        where: {
          status: { in: ['investigating', 'fixing', 'blocked'] },
          devin_session_id: { not: null },
        },
      });

      const changes = [];
      for (const report of activeReports) {
        const result = await this.syncBugReport(report.id);
        if (result) changes.push(result);
      }

      return { synced: activeReports.length, changes };
    } catch (error: any) {
      return { error: error.message };
    } finally {
      this.isSyncing = false;
    }
  }

  async syncBugReport(bugReportId: number): Promise<{ id: number; oldStatus: string; newStatus: string } | null> {
    const bugReport = await this.prisma.bug_reports.findUnique({ where: { id: bugReportId } });
    if (!bugReport || !bugReport.devin_session_id) return null;

    let session;
    try {
      session = await this.devin.getSession(bugReport.devin_session_id);
    } catch (err: any) {
      console.warn(`[SessionSync] Failed to fetch session for bug #${bugReport.id}:`, err.message);
      return null;
    }

    const status = session.status;
    const detail = session.status_detail;
    const oldStatus = bugReport.status as string;
    let newStatus = oldStatus;
    const updates: any = {};

    const isWaiting = detail === 'waiting_for_user' || status === 'blocked';
    const isFailed = status === 'failed' || status === 'error';
    const isEnded = ENDED_STATUSES.includes(status);
    const isWorking = status === 'running' && !isWaiting;

    const pr = this.devin.extractPRFromSession(session, bugReport.target_repo || undefined);

    if (pr) {
      const prNumber = this.github.getPRNumberFromUrl(pr.url);
      updates.pull_request_url = pr.url;
      updates.pull_request_number = prNumber;
      if (!bugReport.fix_summary) updates.fix_summary = session.title || 'Fix applied';

      if (pr.state === 'merged') {
        newStatus = 'merged';
        if (!bugReport.merged_at) updates.merged_at = new Date();
        updates.error_message = null;
      } else if (pr.state === 'closed') {
        newStatus = 'failed';
        updates.error_message = 'PR was closed without merging';
      } else {
        let mergeOutcome: { merged: boolean; reason?: string; sha?: string } = { merged: false };
        if (!bugReport.require_approval) {
          mergeOutcome = await this.tryAutoMerge(bugReport, pr.url, prNumber);
        }

        if (mergeOutcome.merged) {
          newStatus = 'merged';
          if (!bugReport.merged_at) updates.merged_at = new Date();
          updates.error_message = null;
        } else if (bugReport.require_approval) {
          newStatus = 'blocked';
          updates.error_message = 'PR is ready and waiting for your approval to merge';
        } else if (isEnded || isWaiting) {
          newStatus = 'blocked';
          updates.error_message = `PR is ready but could not be auto-merged (${mergeOutcome.reason || 'unknown'}) — review and merge it`;
        } else {
          newStatus = 'fixing';
          updates.error_message = `PR open, waiting to be mergeable (${mergeOutcome.reason || 'checks pending'})`;
        }
      }
    } else if (isWaiting) {
      newStatus = 'blocked';
      updates.error_message = 'Devin is waiting for your input — open the session to respond';
    } else if (isFailed) {
      newStatus = 'failed';
      updates.error_message = `Devin session ${status}`;
    } else if (isEnded) {
      newStatus = 'blocked';
      updates.error_message = `Devin session ended (${detail || status}) without creating a PR — open the session to review`;
    } else if (isWorking) {
      newStatus = 'fixing';
      if (oldStatus === 'blocked') updates.error_message = null;
    }

    if (newStatus !== oldStatus || Object.keys(updates).length > 0) {
      updates.status = newStatus;
      await this.prisma.bug_reports.update({ where: { id: bugReport.id }, data: updates });
      console.log(`[SessionSync] Bug #${bugReport.id}: ${oldStatus} → ${newStatus}`);
      return { id: bugReport.id, oldStatus, newStatus };
    }

    return null;
  }

  private async tryAutoMerge(
    bugReport: any,
    prUrl: string,
    prNumber: number | null,
  ): Promise<{ merged: boolean; reason?: string; sha?: string }> {
    const repoInfo = this.github.parseRepoFromUrl(prUrl);
    if (!repoInfo || !prNumber) return { merged: false, reason: 'missing repo/PR info' };
    const { owner, repo } = repoInfo;

    try {
      const mergeable = await this.github.isPRMergeable(prNumber, owner, repo);
      if (mergeable.state === 'closed') return { merged: false, reason: 'PR is closed' };
      if (!mergeable.mergeable) {
        return { merged: false, reason: `not mergeable (${mergeable.mergeableState || 'checks pending'})` };
      }

      const result = await this.github.mergePullRequest(prNumber, {
        owner,
        repo,
        mergeMethod: 'squash',
        commitTitle: `fix: ${bugReport.title} (#${prNumber})`,
        commitMessage: `Automated bug fix from Bug Report #${bugReport.id}\n\n${bugReport.description}`,
      });
      return { merged: !!(result.success || result.merged), sha: result.sha, reason: result.error };
    } catch (err: any) {
      return { merged: false, reason: err.message };
    }
  }

  // -------------------------------------------------------------------------
  // Repo list
  // -------------------------------------------------------------------------

  async getAvailableRepos(): Promise<any[]> {
    const now = Date.now();
    if (this.repoCache && now < this.repoCacheExpiry) return this.repoCache;

    let repos: any[] = [];
    if (this.github.isConfigured()) {
      try {
        repos = await this.github.getOrgRepos();
      } catch (error: any) {
        console.error('[BugFix Pipeline] Failed to fetch repos:', error.message);
      }
    }

    if (repos.length === 0) {
      repos = [
        { id: 'clickbitau/clickbit', name: 'Clickbit', description: '' },
        { id: 'clickbitau/clickbit-admin', name: 'Clickbit Admin', description: '' },
        { id: 'clickbitau/click-deploy', name: 'Click Deploy', description: '' },
      ];
    }

    this.repoCache = repos;
    this.repoCacheExpiry = now + this.cacheTtlMs;
    return repos;
  }

  // -------------------------------------------------------------------------
  // Prompt building
  // -------------------------------------------------------------------------

  private buildDevinPrompt(bugReport: any): string {
    const targetRepo = bugReport.target_repo || 'clickbitau/clickbit';
    const combined = `${bugReport.title} ${bugReport.description}`;
    const intent = this.detectIntent(combined);
    const complexity = this.scoreComplexity(bugReport.description || '');
    const scope = complexity >= 4 ? 'complex' : 'simple';

    const headers: Record<string, (repo: string) => string> = {
      bug: (repo) => `Fix the following issue in the ${repo} repository:`,
      feature: (repo) => `Implement the following in the ${repo} repository:`,
      refactor: (repo) => `Refactor/improve the following in the ${repo} repository:`,
      task: (repo) => `Complete the following task in the ${repo} repository:`,
    };

    const instructions: Record<string, Record<string, string[]>> = {
      bug: {
        simple: [
          'Identify the root cause of the bug',
          'Implement a minimal, focused fix',
          'Ensure no regression issues',
          'Create a PR with the fix',
        ],
        complex: [
          'Investigate thoroughly — this is a significant issue that may span multiple files',
          'Identify and fix the root cause and any connected problems',
          'Refactor surrounding code if it improves reliability',
          'Test that all related code paths work correctly',
          'Create a comprehensive PR with the fix',
        ],
      },
      feature: {
        simple: [
          'Understand the existing codebase patterns and conventions',
          'Implement the feature, including UI and API changes as needed',
          "Follow the repo's coding style and use existing components/utilities",
          'Create a PR with the implementation',
        ],
        complex: [
          'Understand the existing codebase architecture and conventions',
          'Plan the implementation across all necessary layers (UI, API, database, etc.)',
          'Implement the feature completely — do not leave partial work',
          'Follow existing patterns and reuse components/utilities from the codebase',
          'Create a comprehensive PR with all changes',
        ],
      },
      refactor: {
        simple: [
          'Understand the current implementation',
          'Refactor while preserving existing behavior',
          'Ensure no regressions',
          'Create a PR with the changes',
        ],
        complex: [
          'Map out all code that needs to change',
          'Refactor systematically while preserving existing behavior',
          'Update any affected tests, types, or documentation',
          'Ensure no regressions across the codebase',
          'Create a comprehensive PR with the refactor',
        ],
      },
      task: {
        simple: [
          'Understand what is needed and the relevant codebase areas',
          'Complete the task fully',
          'Follow existing code patterns and conventions',
          'Create a PR with all changes',
        ],
        complex: [
          'Understand the full scope of what is needed',
          'Plan your approach before coding — this is a substantial task',
          'Implement completely across all necessary files and layers',
          'Follow existing patterns and conventions in the codebase',
          'Create a comprehensive PR with all changes',
        ],
      },
    };

    let prompt = `${headers[intent](targetRepo)}\n\n`;
    prompt += `**Title:** ${bugReport.title}\n\n`;
    prompt += `**Description:** ${bugReport.description}\n\n`;

    if (bugReport.category && bugReport.category !== 'other') {
      prompt += `**Category:** ${bugReport.category}\n`;
      prompt += this.getCategoryContext(bugReport.category, targetRepo);
    }

    prompt += `\n**Priority:** ${bugReport.priority}\n\n`;

    if (bugReport.screenshot_url) {
      prompt += `**Screenshot:** ${bugReport.screenshot_url}\n\n`;
    }

    const steps = instructions[intent][scope];
    prompt += `Please:\n`;
    steps.forEach((step, i) => {
      prompt += `${i + 1}. ${step}\n`;
    });

    return prompt;
  }

  private detectIntent(text: string): string {
    const lower = text.toLowerCase();
    const intentPatterns: Record<string, RegExp> = {
      feature: /\b(add(s|ed|ing)?|implement\w*|build\w*|creat\w*|new\b|support\s+for|enabl\w*|introduc\w*|design\w*|integrat\w*)/i,
      refactor: /\b(refactor\w*|clean\s*up|optimiz\w*|improv\w*|migrat\w*|upgrad\w*|restructur\w*|moderniz\w*|simplif\w*)/i,
      bug: /\b(bug\w*|fix\w*|broken|not\s+working|errors?|crash\w*|wrong|fail\w*|issue\s+with|doesn.t\s+work|regression|undefined|null\b|exceptions?|typos?|missing)/i,
    };

    const scores: Record<string, number> = { bug: 0, refactor: 0, feature: 0 };
    for (const [intent, regex] of Object.entries(intentPatterns)) {
      const matches = lower.match(new RegExp(regex.source, 'gi'));
      if (matches) scores[intent] += matches.length;
    }

    const priority = { bug: 3, refactor: 2, feature: 1 };
    const best = Object.entries(scores).sort((a, b) => b[1] - a[1] || (priority[b[0] as keyof typeof priority] || 0) - (priority[a[0] as keyof typeof priority] || 0))[0];
    if (best[1] === 0) return 'task';
    return best[0];
  }

  private scoreComplexity(text: string): number {
    let score = 0;
    if (text.length > 500) score += 3;
    else if (text.length > 200) score += 2;
    else if (text.length > 100) score += 1;

    const complexityBoostPatterns = [
      { pattern: /\b(entire|redesign|overhaul|completely|all\s+of|every|full|major|across\s+the)\b/i, weight: 2 },
      { pattern: /\b(multiple|several|many|various|both|and\s+also|additionally|plus)\b/i, weight: 1 },
      { pattern: /(\d+\.\s|\n-\s|\n\*\s)/g, weight: 1 },
      { pattern: /\b(database|migration|api|ui|frontend|backend|mobile|schema)\b/gi, weight: 0.5 },
    ];

    for (const { pattern, weight } of complexityBoostPatterns) {
      const matches = text.match(new RegExp(pattern.source, pattern.flags));
      if (matches) score += matches.length * weight;
    }

    return Math.min(score, 10);
  }

  private getCategoryContext(category: string, targetRepo: string): string {
    if (targetRepo === 'clickbitau/clickbit') {
      const contexts: Record<string, string> = {
        invoice: '\nRelevant files: server/routes/invoices.js, client/src/pages/AdminInvoicesPage.tsx',
        dashboard: '\nRelevant files: server/controllers/adminController.js, client/src/pages/AdminDashboardPage.tsx',
        login: '\nRelevant files: server/routes/auth.js, client/src/pages/LoginPage.tsx',
        crm: '\nRelevant files: server/routes/crm.js, client/src/pages/AdminCrmCustomersPage.tsx',
        hr: '\nRelevant files: server/routes/hr.js, client/src/pages/AdminHrEmployeesPage.tsx',
        payments: '\nRelevant files: server/routes/payments.js, client/src/pages/AdminPaymentsPage.tsx',
        mobile: '\nRelevant files: mobile/app/, mobile/lib/api.ts, mobile/components/',
        deploy: '\nThis is a deployment issue - check click-deploy repo',
      };
      return contexts[category] || '';
    }
    return '';
  }
}
