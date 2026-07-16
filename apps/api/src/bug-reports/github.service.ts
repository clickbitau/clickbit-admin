import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GithubService {
  private token: string | undefined;
  private owner: string;
  private repo: string;

  constructor(private readonly config: ConfigService) {
    this.token = this.config.get<string>('GITHUB_TOKEN');
    this.owner = this.config.get<string>('GITHUB_OWNER') || 'clickbitau';
    this.repo = this.config.get<string>('GITHUB_REPO') || 'clickbit';
  }

  isConfigured(): boolean {
    return !!(this.token && this.owner && this.repo);
  }

  private headers(): Record<string, string> {
    return {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${this.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    };
  }

  private async request(url: string, options: RequestInit = {}): Promise<any> {
    const response = await fetch(url, {
      ...options,
      headers: { ...this.headers(), ...(options.headers || {}) },
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`GitHub API ${response.status}: ${body}`);
    }
    if (response.status === 204) return null;
    return response.json();
  }

  async testConnection(): Promise<{ success: boolean; repo?: string; defaultBranch?: string; error?: string }> {
    try {
      const data = await this.request(`https://api.github.com/repos/${this.owner}/${this.repo}`);
      return { success: true, repo: data.full_name, defaultBranch: data.default_branch };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async getPullRequest(prNumber: number, owner?: string, repo?: string): Promise<any> {
    const o = owner || this.owner;
    const r = repo || this.repo;
    return this.request(`https://api.github.com/repos/${o}/${r}/pulls/${prNumber}`);
  }

  async listPullRequests(state = 'open'): Promise<any[]> {
    return this.request(`https://api.github.com/repos/${this.owner}/${this.repo}/pulls?state=${state}&sort=created&direction=desc`);
  }

  async getPRFiles(prNumber: number, owner?: string, repo?: string): Promise<any[]> {
    const o = owner || this.owner;
    const r = repo || this.repo;
    const files = await this.request(`https://api.github.com/repos/${o}/${r}/pulls/${prNumber}/files?per_page=100`);
    return files.map((file: any) => ({
      filename: file.filename,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      changes: file.changes,
      patch: file.patch || null,
      previousFilename: file.previous_filename || null,
    }));
  }

  async getPRDetails(prNumber: number, owner?: string, repo?: string): Promise<any> {
    const [pr, files] = await Promise.all([
      this.getPullRequest(prNumber, owner, repo),
      this.getPRFiles(prNumber, owner, repo),
    ]);
    return {
      number: pr.number,
      title: pr.title,
      body: pr.body,
      state: pr.state,
      merged: pr.merged,
      mergedAt: pr.merged_at,
      createdAt: pr.created_at,
      updatedAt: pr.updated_at,
      url: pr.html_url,
      headBranch: pr.head?.ref,
      baseBranch: pr.base?.ref,
      author: pr.user?.login,
      additions: pr.additions,
      deletions: pr.deletions,
      changedFiles: pr.changed_files,
      files,
    };
  }

  async mergePullRequest(
    prNumber: number,
    options: { owner?: string; repo?: string; mergeMethod?: string; commitTitle?: string | null; commitMessage?: string | null } = {},
  ): Promise<{ success: boolean; sha?: string; merged?: boolean; message?: string; error?: string }> {
    try {
      const owner = options.owner || this.owner;
      const repo = options.repo || this.repo;
      const payload: any = { merge_method: options.mergeMethod || 'squash' };
      if (options.commitTitle) payload.commit_title = options.commitTitle;
      if (options.commitMessage) payload.commit_message = options.commitMessage;

      const data = await this.request(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/merge`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return { success: true, sha: data.sha, merged: data.merged, message: data.message };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async isPRMergeable(prNumber: number, owner?: string, repo?: string): Promise<{ mergeable: boolean; mergeableState?: string; state?: string; draft?: boolean; checksStatus?: string; error?: string }> {
    try {
      const pr = await this.getPullRequest(prNumber, owner, repo);
      return {
        mergeable: pr.mergeable,
        mergeableState: pr.mergeable_state,
        state: pr.state,
        draft: pr.draft,
        checksStatus: pr.mergeable_state === 'clean' ? 'passing' : pr.mergeable_state,
      };
    } catch (error: any) {
      return { mergeable: false, error: error.message };
    }
  }

  async getCommitStatus(ref: string): Promise<any> {
    return this.request(`https://api.github.com/repos/${this.owner}/${this.repo}/commits/${ref}/status`);
  }

  async getOrgRepos(): Promise<any[]> {
    if (!this.token) return [];
    const headers = this.headers();
    const repos: any[] = [];
    let page = 1;
    let hasMore = true;
    let url = `https://api.github.com/orgs/${this.owner}/repos`;
    let params: Record<string, string> = { per_page: '100', sort: 'updated' };

    const probe = await fetch(`${url}?per_page=1`, { headers });
    if (probe.status === 404) {
      url = 'https://api.github.com/user/repos';
      params = { per_page: '100', affiliation: 'owner' };
    }

    while (hasMore) {
      const query = new URLSearchParams({ ...params, page: String(page) }).toString();
      const response = await fetch(`${url}?${query}`, { headers });
      if (!response.ok) {
        const body = await response.text();
        throw new Error(`GitHub repos fetch failed: ${response.status} ${body}`);
      }
      const data = await response.json();
      for (const repo of data) {
        if (!repo.archived) {
          repos.push({
            id: repo.full_name,
            name: repo.name.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
            description: repo.description || '',
          });
        }
      }
      hasMore = data.length === 100;
      page++;
    }

    return repos;
  }

  getPRNumberFromUrl(prUrl: string): number | null {
    const match = prUrl.match(/\/pull\/(\d+)/);
    return match ? Number(match[1]) : null;
  }

  parseRepoFromUrl(prUrl: string): { owner: string; repo: string } | null {
    if (!prUrl) return null;
    const match = prUrl.match(/github\.com\/([^/]+)\/([^/]+)\/pull/);
    return match ? { owner: match[1], repo: match[2] } : null;
  }
}
