import * as https from 'https';
import { URL } from 'url';

export interface HostingerMailbox {
  resourceId: string;
  address: string;
}

export interface HostingerMe {
  orderResourceId?: string;
  mailboxes?: HostingerMailbox[];
}

export interface HostingerFolder {
  path: string;
  name: string;
  delimiter?: string;
  specialUse?: string | null;
  messageCount?: number;
  unreadCount?: number;
}

export interface HostingerAddress {
  name?: string;
  address?: string;
}

export interface HostingerAttachmentMeta {
  id: string;
  contentType?: string;
  sizeBytes?: number;
  inline?: boolean;
  filename?: string;
  contentId?: string;
}

export interface HostingerMessage {
  uid: number;
  path?: string;
  date?: string;
  flags?: string[];
  unseen?: boolean;
  size?: number;
  subject?: string;
  from?: HostingerAddress;
  to?: HostingerAddress[];
  cc?: HostingerAddress[];
  bcc?: HostingerAddress[];
  messageId?: string;
  inReplyTo?: string;
  attachments?: HostingerAttachmentMeta[];
}

export interface HostingerMessageText {
  text?: string;
  html?: string;
}

export interface HostingerPagination {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export interface HostingerListResponse<T> {
  data: T[];
  pagination?: HostingerPagination;
}

export interface HostingerSendRequest {
  to: string[];
  displayName?: string;
  cc?: string[];
  bcc?: string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: {
    filename: string;
    content: string;
    contentType?: string;
    cid?: string;
    encoding?: string;
  }[];
  inReplyTo?: { uid: number; folder: string };
  forwardOf?: { uid: number; folder: string };
}

export class HostingerMailClient {
  private readonly baseUrl = 'https://api.mail.hostinger.com';

  private encodeFolder(folder: string): string {
    return encodeURIComponent(folder);
  }

  private request<T>(method: string, path: string, token: string, body?: unknown, query?: Record<string, string | number | boolean>): Promise<T> {
    return new Promise((resolve, reject) => {
      const url = new URL(`${this.baseUrl}${path}`);
      if (query) {
        Object.entries(query).forEach(([key, value]) => {
          if (value !== undefined && value !== null) url.searchParams.append(key, String(value));
        });
      }

      const postData = body ? JSON.stringify(body) : undefined;
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      };
      if (postData) {
        headers['Content-Type'] = 'application/json';
        headers['Content-Length'] = Buffer.byteLength(postData).toString();
      }

      const req = https.request(
        {
          method,
          hostname: url.hostname,
          path: `${url.pathname}${url.search}`,
          port: url.port || 443,
          headers,
          timeout: 30000,
        },
        (res) => {
          let responseData = '';
          res.on('data', (chunk) => { responseData += chunk; });
          res.on('end', () => {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              if (!responseData) return resolve(undefined as T);
              try {
                return resolve(JSON.parse(responseData) as T);
              } catch {
                return resolve(responseData as T);
              }
            }
            let message = `Hostinger API error ${res.statusCode}`;
            try {
              const parsed = JSON.parse(responseData);
              message = parsed.message || parsed.error || message;
            } catch {
              if (responseData) message = `${message}: ${responseData}`;
            }
            reject(new Error(message));
          });
        },
      );

      req.on('error', (err) => reject(err));
      if (postData) req.write(postData);
      req.end();
    });
  }

  getCurrentAccount(token: string): Promise<{ data: HostingerMe }> {
    return this.request<{ data: HostingerMe }>('GET', '/api/v1/me', token);
  }

  listFolders(token: string, resourceId: string, page = 1, perPage = 100): Promise<HostingerListResponse<HostingerFolder>> {
    return this.request<HostingerListResponse<HostingerFolder>>('GET', `/api/v1/mailboxes/${encodeURIComponent(resourceId)}/folders`, token, undefined, { page, perPage });
  }

  createFolder(token: string, resourceId: string, name: string): Promise<{ data: { folder?: HostingerFolder } }> {
    return this.request<{ data: { folder?: HostingerFolder } }>('POST', `/api/v1/mailboxes/${encodeURIComponent(resourceId)}/folders`, token, { name });
  }

  updateFolder(token: string, resourceId: string, folder: string, name: string): Promise<unknown> {
    return this.request<unknown>('PUT', `/api/v1/mailboxes/${encodeURIComponent(resourceId)}/folders/${this.encodeFolder(folder)}`, token, { name });
  }

  deleteFolder(token: string, resourceId: string, folder: string): Promise<unknown> {
    return this.request<unknown>('DELETE', `/api/v1/mailboxes/${encodeURIComponent(resourceId)}/folders/${this.encodeFolder(folder)}`, token);
  }

  listMessages(token: string, resourceId: string, folder: string, page = 1, perPage = 25, sort = '-uid'): Promise<HostingerListResponse<HostingerMessage>> {
    return this.request<HostingerListResponse<HostingerMessage>>('GET', `/api/v1/mailboxes/${encodeURIComponent(resourceId)}/folders/${this.encodeFolder(folder)}/messages`, token, undefined, { page, perPage, sort });
  }

  searchMessages(token: string, resourceId: string, folder: string, filters: Record<string, unknown>, page = 1, perPage = 25, sort = '-uid'): Promise<HostingerListResponse<HostingerMessage>> {
    return this.request<HostingerListResponse<HostingerMessage>>('POST', `/api/v1/mailboxes/${encodeURIComponent(resourceId)}/folders/${this.encodeFolder(folder)}/messages/search`, token, filters, { page, perPage, sort });
  }

  getMessage(token: string, resourceId: string, folder: string, uid: number): Promise<{ data: HostingerMessage }> {
    return this.request<{ data: HostingerMessage }>('GET', `/api/v1/mailboxes/${encodeURIComponent(resourceId)}/folders/${this.encodeFolder(folder)}/messages/${uid}`, token);
  }

  getMessageText(token: string, resourceId: string, folder: string, uid: number): Promise<{ data: HostingerMessageText }> {
    return this.request<{ data: HostingerMessageText }>('GET', `/api/v1/mailboxes/${encodeURIComponent(resourceId)}/folders/${this.encodeFolder(folder)}/messages/${uid}/text`, token);
  }

  getMessageAttachment(token: string, resourceId: string, folder: string, uid: number, attachmentId: string): Promise<unknown> {
    return this.request<unknown>('GET', `/api/v1/mailboxes/${encodeURIComponent(resourceId)}/folders/${this.encodeFolder(folder)}/messages/${uid}/attachments/${encodeURIComponent(attachmentId)}`, token);
  }

  sendEmail(token: string, resourceId: string, payload: HostingerSendRequest): Promise<unknown> {
    return this.request<unknown>('POST', `/api/v1/mailboxes/${encodeURIComponent(resourceId)}/send`, token, payload);
  }

  patchMessage(token: string, resourceId: string, folder: string, uid: number, addFlags?: string[], removeFlags?: string[]): Promise<{ data: HostingerMessage }> {
    return this.request<{ data: HostingerMessage }>('PATCH', `/api/v1/mailboxes/${encodeURIComponent(resourceId)}/folders/${this.encodeFolder(folder)}/messages/${uid}`, token, { addFlags, removeFlags });
  }

  updateMessageFlags(token: string, resourceId: string, folder: string, uids: number[], addFlags?: string[], removeFlags?: string[]): Promise<unknown> {
    return this.request<unknown>('POST', `/api/v1/mailboxes/${encodeURIComponent(resourceId)}/folders/${this.encodeFolder(folder)}/messages/flags`, token, { uids, addFlags, removeFlags });
  }

  moveMessage(token: string, resourceId: string, folder: string, uid: number, targetFolder: string): Promise<unknown> {
    return this.request<unknown>('POST', `/api/v1/mailboxes/${encodeURIComponent(resourceId)}/folders/${this.encodeFolder(folder)}/messages/${uid}/move`, token, { targetFolder });
  }

  moveMessages(token: string, resourceId: string, folder: string, uids: number[], targetFolder: string): Promise<unknown> {
    return this.request<unknown>('POST', `/api/v1/mailboxes/${encodeURIComponent(resourceId)}/folders/${this.encodeFolder(folder)}/messages/move`, token, { uids, targetFolder });
  }

  deleteMessage(token: string, resourceId: string, folder: string, uid: number): Promise<unknown> {
    return this.request<unknown>('DELETE', `/api/v1/mailboxes/${encodeURIComponent(resourceId)}/folders/${this.encodeFolder(folder)}/messages/${uid}`, token);
  }

  deleteMessages(token: string, resourceId: string, folder: string, uids: number[]): Promise<unknown> {
    return this.request<unknown>('POST', `/api/v1/mailboxes/${encodeURIComponent(resourceId)}/folders/${this.encodeFolder(folder)}/messages/delete`, token, { uids });
  }

  getQuota(token: string, resourceId: string): Promise<{ data: unknown }> {
    return this.request<{ data: unknown }>('GET', `/api/v1/mailboxes/${encodeURIComponent(resourceId)}/quota`, token);
  }
}
