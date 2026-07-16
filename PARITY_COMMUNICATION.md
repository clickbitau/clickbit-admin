# Communication — Legacy Parity Checklist

Source of truth: `clickbit/server/routes/chat.js`, `messages.js`, `mail.js`.

## Legend
- `[x]` = implemented in `apps/api/src/communication`
- `[-]` = partially implemented / stubbed
- `[ ]` = pending

## `server/routes/chat.js`

| Route | Legacy | New | Notes |
|-------|--------|-----|-------|
| `GET /api/chat/participants` | `[x]` | `[x]` | Picker list for new conversations |
| `GET/POST /api/chat/workspaces` | `[x]` | `[x]` | Workspace CRUD |
| `GET/POST /api/chat/direct-messages` | `[x]` | `[x]` | DM list/create |
| `PATCH /api/chat/direct-messages/:id` | `[x]` | `[x]` | Rename group DM |
| `POST /api/chat/direct-messages/:id/read` | `[x]` | `[x]` | Mark DM read |
| `GET/POST /api/chat/channels` | `[x]` | `[x]` | Channel list/create |
| `POST /api/chat/channels/:id/read` | `[x]` | `[x]` | Mark channel read |
| `GET/POST /api/chat/preferences` | `[x]` | `[x]` | Conversation preferences |
| `POST /api/chat/presence` | `[-]` | `[-]` | User presence update (pending) |
| `GET /api/chat/presence` | `[-]` | `[-]` | Presence list (pending) |
| `POST/GET/DELETE /api/chat/drafts` | `[-]` | `[-]` | Message drafts (pending) |
| `POST /api/chat/upload` | `[-]` | `[-]` | File upload (pending) |
| `GET /api/chat/ice-servers` | `[-]` | `[-]` | WebRTC ICE servers (pending) |
| `POST/GET/POST/GET /api/chat/calls/*` | `[-]` | `[-]` | Call sessions (pending) |

## `server/routes/messages.js`

| Route | Legacy | New | Notes |
|-------|--------|-----|-------|
| `GET /api/messages/channel/:channelId` | `[x]` | `[x]` | Channel message history |
| `GET /api/messages/direct-message/:dmId` | `[x]` | `[x]` | DM message history |
| `POST /api/messages` | `[x]` | `[x]` | Send message |
| `PUT /api/messages/:messageId` | `[x]` | `[x]` | Edit message |
| `DELETE /api/messages/:messageId` | `[x]` | `[x]` | Soft delete message |
| `POST /api/messages/:messageId/reactions` | `[x]` | `[x]` | Add reaction |
| `GET /api/messages/:messageId/thread` | `[x]` | `[x]` | Thread replies |
| `GET/POST /api/messages/:messageId/receipts` | `[-]` | `[-]` | Read receipts (pending) |
| `GET /api/messages/search` | `[x]` | `[x]` | Message search |

## `server/routes/mail.js`

| Route | Legacy | New | Notes |
|-------|--------|-----|-------|
| `GET /api/mail/presets` | `[x]` | `[x]` | Provider presets |
| `GET/POST /api/mail/accounts` | `[x]` | `[x]` | Email account CRUD |
| `PUT/DELETE /api/mail/accounts/:id` | `[x]` | `[x]` | Email account update/delete/test |
| `GET /api/mail/accounts/:accountId/folders` | `[x]` | `[x]` | Folder list |
| `GET /api/mail/accounts/:accountId/folders/:folderPath/messages` | `[x]` | `[x]` | Cached email list |
| `GET /api/mail/accounts/:accountId/folders/:folderPath/messages/:uid` | `[x]` | `[x]` | Email detail |
| `POST /api/mail/accounts/:accountId/send` | `[-]` | `[-]` | Send email (queues email_logs, no SMTP send) |
| `GET/POST /api/mail/templates` | `[x]` | `[x]` | Email template CRUD |
| `POST /api/mail/accounts/:accountId/drafts` | `[-]` | `[-]` | Drafts (pending) |
| `GET/PUT /api/mail/accounts/:id/signature` | `[x]` | `[x]` | Signature |
| `GET/PUT /api/mail/accounts/:id/aliases` | `[x]` | `[x]` | Aliases |

## Frontend (`apps/web/src/app/admin/communication/*`)

- `/admin/communication` — hub linking to chat and mail `[x]`
- `/admin/communication/chat` — workspace/channel/DM message view `[x]`
- `/admin/communication/mail` — accounts, folders, messages, templates `[x]`
