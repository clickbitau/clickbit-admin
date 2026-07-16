import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class DevinService {
  private apiKey: string | undefined;
  private orgId: string | undefined;
  private baseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('DEVIN_API_KEY');
    this.orgId = this.config.get<string>('DEVIN_ORG_ID');
    this.baseUrl = this.config.get<string>('DEVIN_API_URL') || 'https://api.devin.ai/v3';
  }

  isConfigured(): boolean {
    return !!(this.apiKey && this.orgId);
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  private async request(path: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: { ...this.headers(), ...(options.headers || {}) },
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Devin API ${response.status}: ${body}`);
    }
    if (response.status === 204) return null;
    return response.json();
  }

  async testConnection(): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      await this.request(`/organizations/${this.orgId}/sessions?limit=1`);
      return { success: true, message: 'Connected to Devin API' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async createSession(
    prompt: string,
    options: { title?: string; repo?: string; playbook_id?: string | null; tags?: string[] } = {},
  ): Promise<{ id: string; url: string; status: string }> {
    const { title = 'Bug Fix', repo = 'clickbitau/clickbit', playbook_id = null, tags = [] } = options;
    const payload: any = {
      prompt,
      title,
      repos: [repo],
      tags: ['bug-fix', ...tags],
    };
    if (playbook_id) payload.playbook_id = playbook_id;

    const data = await this.request(`/organizations/${this.orgId}/sessions`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    return { id: data.session_id, url: data.url, status: data.status };
  }

  async getSession(sessionId: string): Promise<any> {
    return this.request(`/organizations/${this.orgId}/sessions/${sessionId}`);
  }

  async listSessions(filters: { status?: string; tags?: string[]; limit?: number } = {}): Promise<any> {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.tags) params.append('tags', filters.tags.join(','));
    if (filters.limit) params.append('limit', String(filters.limit));
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/organizations/${this.orgId}/sessions${query}`);
  }

  async pollSessionUntilComplete(
    sessionId: string,
    maxAttempts = 360,
    intervalMs = 10000,
    onProgress: ((progress: { attempt: number; session: any; status: string }) => void) | null = null,
  ): Promise<{ success: boolean; session?: any; error?: string }> {
    let consecutiveFailures = 0;
    const maxConsecutiveFailures = 5;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const session = await this.getSession(sessionId);
        consecutiveFailures = 0;
        const status = session.status;

        if (onProgress) {
          onProgress({ attempt, session, status });
        }

        if (session.status_detail === 'waiting_for_user' || status === 'blocked') {
          return { success: false, error: 'Session blocked - requires manual input', session };
        }

        if (status === 'failed' || status === 'error') {
          return { success: false, error: 'Session failed', session };
        }

        if (['finished', 'stopped', 'suspended', 'exit', 'expired'].includes(status)) {
          return { success: true, session };
        }

        if (attempt % 6 === 0) {
          console.log(`[Devin Poll] Session ${sessionId} still running (attempt ${attempt}, status: ${status})`);
        }
      } catch (apiError: any) {
        consecutiveFailures++;
        console.warn(`[Devin Poll] API error on attempt ${attempt} (${consecutiveFailures}/${maxConsecutiveFailures}):`, apiError.message);
        if (consecutiveFailures >= maxConsecutiveFailures) {
          return { success: false, error: `API polling failed: ${apiError.message}` };
        }
      }

      await sleep(intervalMs);
    }

    return { success: false, error: 'Timeout waiting for session completion' };
  }

  normalizePRs(session: any): { url: string; state: string; title?: string }[] {
    if (Array.isArray(session.pull_requests) && session.pull_requests.length > 0) {
      return session.pull_requests
        .filter((pr: any) => pr && pr.pr_url)
        .map((pr: any) => ({ url: pr.pr_url, state: pr.pr_state || 'open', title: pr.title }));
    }
    if (Array.isArray(session.pull_request_urls)) {
      return session.pull_request_urls.map((url: string) => ({ url, state: 'open' }));
    }
    if (session.structured_output?.pull_request_url) {
      return [{ url: session.structured_output.pull_request_url, state: 'open' }];
    }
    return [];
  }

  selectRelevantPR(prs: { url: string; state: string }[], targetRepo?: string): { url: string; state: string; title?: string } | null {
    if (!prs || prs.length === 0) return null;
    const inRepo = targetRepo ? prs.filter((pr) => pr.url.includes(`github.com/${targetRepo}/`)) : [];
    const pool = inRepo.length > 0 ? inRepo : prs;
    return pool.find((pr) => pr.state === 'open')
      || pool.find((pr) => pr.state === 'merged')
      || pool.find((pr) => pr.state === 'closed')
      || pool[0];
  }

  extractPRFromSession(session: any, targetRepo?: string): { url: string; state: string; title?: string } | null {
    const pr = this.selectRelevantPR(this.normalizePRs(session), targetRepo);
    if (!pr) return null;
    return { url: pr.url, state: pr.state, title: session.title };
  }

  getSessionUrl(sessionId: string): string {
    return `https://app.devin.ai/sessions/${sessionId}`;
  }
}
