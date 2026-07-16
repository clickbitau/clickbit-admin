export interface ChatProfile {
  id: number;
  first_name: string;
  last_name: string;
  email?: string;
  avatar?: string | null;
  role?: string;
}

export interface Workspace {
  id: number;
  name: string;
  description?: string | null;
  icon_url?: string | null;
  created_by?: number;
  created_at?: string;
  updated_at?: string;
  members?: WorkspaceMember[];
  owner?: ChatProfile;
}

export interface WorkspaceMember {
  id: number;
  workspace_id: number;
  user_id: number;
  role?: string;
  joined_at?: string;
  user?: ChatProfile;
}

export interface Channel {
  id: number;
  workspace_id: number;
  name: string;
  type?: string;
  category?: string | null;
  description?: string | null;
  is_private?: boolean;
  position?: number;
  created_at?: string;
  updated_at?: string;
}

export interface DirectMessage {
  id: number;
  type?: 'dm' | 'group';
  name?: string | null;
  avatar_url?: string | null;
  company_id?: number | null;
  created_at?: string;
  updated_at?: string;
  participants?: DirectMessageParticipant[];
  company?: { id: number; name: string } | null;
}

export interface DirectMessageParticipant {
  id: number;
  direct_message_id: number;
  user_id: number;
  last_read_at?: string | null;
  created_at?: string;
  user?: ChatProfile;
}

export interface ConversationPreferences {
  id?: number;
  user_id: number;
  conversation_type: 'channel' | 'direct_message';
  conversation_id: number;
  is_muted: boolean;
  mute_until?: string | null;
  notification_level: string;
  sound_enabled: boolean;
  mobile_push_enabled: boolean;
  email_enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Message {
  id: number;
  channel_id?: number | null;
  direct_message_id?: number | null;
  user_id: number;
  content: string;
  mentions?: unknown[];
  attachments?: unknown[];
  edited_at?: string | null;
  is_pinned?: boolean;
  reply_to_id?: number | null;
  created_at: string;
  updated_at?: string;
  deleted_at?: string | null;
  author?: ChatProfile;
  reactions?: Reaction[];
  thread?: { reply_count?: number; last_reply_at?: string | null } | null;
}

export interface Reaction {
  id: number;
  message_id: number;
  user_id: number;
  emoji: string;
  created_at?: string;
  user?: ChatProfile;
}

export interface MessageEnvelope<T> {
  success: boolean;
  data: T;
}

export interface MessageListResponse {
  success: boolean;
  messages: Message[];
  pagination: { limit: number; hasMore: boolean; hasPrevious: boolean; nextCursor: number | null; previousCursor: number | null };
}

export interface CursorPagination {
  limit: number;
  hasMore: boolean;
  hasPrevious: boolean;
  nextCursor: number | null;
  previousCursor: number | null;
}

export interface CommunicationLegacyListResponse<T> {
  success: boolean;
  data: T[];
  pagination: { count: number; limit: number; offset: number };
}

export interface CommunicationLegacyDataResponse<T> {
  success: boolean;
  data: T;
}

export interface CommunicationLegacyMessageResponse {
  success: boolean;
  message: string;
}

export interface MailPreset {
  imap_host: string;
  imap_port: number;
  imap_secure: boolean;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
}

export interface MailAccount {
  id: string;
  profile_id: number;
  email: string;
  display_name?: string | null;
  imap_host: string;
  imap_port: number;
  imap_secure: boolean;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  username: string;
  is_active?: boolean;
  last_sync_at?: string | null;
  last_error?: string | null;
  signature_html?: string | null;
  signature_text?: string | null;
  aliases?: unknown[];
  created_at: string;
  updated_at: string;
}

export interface MailFolder {
  path: string;
  name: string;
}

export interface CachedEmail {
  id: string;
  account_id: string;
  folder_path: string;
  uid: number;
  message_id?: string | null;
  subject?: string | null;
  from_address?: string | null;
  from_name?: string | null;
  to_addresses?: unknown[];
  cc_addresses?: unknown[];
  date?: string;
  preview?: string | null;
  html_body?: string | null;
  text_body?: string | null;
  is_read?: boolean;
  is_starred?: boolean;
}

export interface EmailTemplate {
  id: string;
  profile_id: number;
  name: string;
  subject?: string | null;
  body_text?: string | null;
  body_html?: string | null;
  is_shared?: boolean;
  created_at: string;
  updated_at: string;
}
