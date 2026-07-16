# Support / Tickets — Legacy Parity Checklist

Source of truth: `clickbit/server/routes/tickets.js`, `ticketsAdvanced.js`, `ticketAutomation.js`, `bugReports.js`.

## Legend
- `[x]` = implemented in `apps/api/src/support`
- `[-]` = partially implemented / stubbed
- `[ ]` = pending

## `server/routes/tickets.js` (public, customer, and admin ticket routes)

| Route | Legacy | New | Notes |
|-------|--------|-----|-------|
| `POST /api/tickets` | `[x]` | `[x]` | Public/guest create |
| `GET /api/tickets/quota` | `[x]` | `[x]` | User ticket quota check |
| `GET /api/tickets/purchase/:sessionId` | `[-]` | `[-]` | Stripe purchase status stub |
| `POST /api/tickets/:id/assign-ai` | `[-]` | `[-]` | AI auto-assign stub (no ticketAutoFixService yet) |
| `GET /api/tickets/track/:ticketNumber` | `[x]` | `[x]` | Public ticket tracking |
| `POST /api/tickets/track/:ticketNumber/reply` | `[x]` | `[x]` | Public reply by ticket number |
| `POST /api/tickets/track/:ticketNumber/feedback` | `[x]` | `[x]` | Satisfaction feedback |
| `GET /api/tickets/my-tickets` | `[x]` | `[x]` | Customer ticket list |
| `GET /api/tickets/my-tickets/:id` | `[x]` | `[x]` | Customer ticket detail |
| `POST /api/tickets/my-tickets/:id/reply` | `[x]` | `[x]` | Customer reply |
| `POST /api/tickets/my-tickets/:id/reopen` | `[x]` | `[x]` | Customer reopen |
| `GET /api/tickets/my-assigned` | `[x]` | `[x]` | Staff assigned ticket list |
| `GET /api/tickets/my-assigned/:id` | `[x]` | `[x]` | Staff assigned ticket detail |
| `POST /api/tickets/my-assigned/:id/reply` | `[x]` | `[x]` | Staff reply |
| `PATCH /api/tickets/my-assigned/:id/status` | `[x]` | `[x]` | Staff status update |
| `POST /api/tickets/:id/upload-attachments` | `[-]` | `[-]` | Endpoint exists; returns empty URLs (no storage yet) |
| `GET /api/tickets/admin` | `[x]` | `[x]` | Admin ticket list/search |
| `GET /api/tickets/admin/stats` | `[x]` | `[x]` | Admin stats aggregation |
| `GET /api/tickets/admin/staff` | `[x]` | `[x]` | Staff list for assignment |
| `GET /api/tickets/admin/canned-responses` | `[x]` | `[x]` | List canned responses |
| `PUT /api/tickets/admin/canned-responses` | `[x]` | `[x]` | Update/create canned response |
| `GET /api/tickets/admin/export` | `[x]` | `[x]` | CSV export |
| `GET /api/tickets/admin/:id` | `[x]` | `[x]` | Admin ticket detail |
| `PUT /api/tickets/admin/:id` | `[x]` | `[x]` | Admin ticket update |
| `POST /api/tickets/admin/:id/reply` | `[x]` | `[x]` | Admin reply |
| `POST /api/tickets/admin/bulk-update` | `[x]` | `[x]` | Bulk status/assign/update |
| `POST /api/tickets/admin/merge` | `[x]` | `[x]` | Merge tickets |
| `DELETE /api/tickets/admin/:id` | `[x]` | `[x]` | Admin delete |

## `server/routes/ticketsAdvanced.js`

| Route | Legacy | New | Notes |
|-------|--------|-----|-------|
| `GET/POST/DELETE /api/tickets/:id/watchers` | `[ ]` | `[ ]` | Watcher management |
| `POST /api/tickets/:id/watch` | `[ ]` | `[ ]` | Watch/unwatch ticket |
| `GET/POST/DELETE /api/tickets/:id/links` | `[ ]` | `[ ]` | Ticket links |
| `GET /api/tickets/link-types` | `[ ]` | `[ ]` | Link type options |
| `GET /api/tickets/:id/audit-log` | `[ ]` | `[ ]` | Ticket audit log |
| `CRUD /api/tickets/admin/sla-policies` | `[ ]` | `[ ]` | SLA policy management |
| `GET /api/tickets/admin/sla-policies/defaults` | `[ ]` | `[ ]` | Default SLA policies |
| `CRUD /api/tickets/admin/assignment-rules` | `[ ]` | `[ ]` | Auto-assignment rules |
| `POST /api/tickets/admin/assignment-rules/test` | `[ ]` | `[ ]` | Test assignment rule |
| `CRUD /api/tickets/admin/webhooks` | `[ ]` | `[ ]` | Ticket webhooks |
| `POST /api/tickets/admin/webhooks/:id/test` | `[ ]` | `[ ]` | Test webhook |
| `GET /api/tickets/admin/webhooks/:id/logs` | `[ ]` | `[ ]` | Webhook logs |
| `GET /api/tickets/:id/sla-status` | `[ ]` | `[ ]` | Ticket SLA status |
| `CRUD /api/tickets/admin/custom-fields` | `[ ]` | `[ ]` | Custom field definitions |
| `GET/PUT /api/tickets/:id/custom-fields` | `[ ]` | `[ ]` | Ticket custom field values |
| `CRUD /api/tickets/admin/boards` | `[ ]` | `[ ]` | Kanban boards |
| `PUT /api/tickets/admin/boards/:id/settings` | `[ ]` | `[ ]` | Board user settings |
| `PUT /api/tickets/admin/boards/move-ticket` | `[ ]` | `[ ]` | Move ticket on board |
| `GET /api/tickets/admin/boards/defaults` | `[ ]` | `[ ]` | Default boards |
| `CRUD /api/tickets/admin/components` | `[ ]` | `[ ]` | Ticket components |
| `GET/PUT /api/tickets/:id/components` | `[ ]` | `[ ]` | Assign components to ticket |
| `GET /api/tickets/:id/time-logs` | `[ ]` | `[ ]` | Time logs |
| `GET /api/tickets/:id/time-summary` | `[ ]` | `[ ]` | Time summary |
| `CRUD /api/tickets/admin/versions` | `[ ]` | `[ ]` | Ticket versions (affected/fix) |
| `GET /api/tickets/admin/filters` | `[ ]` | `[ ]` | Saved filters |
| `GET /api/tickets/stats/public` | `[ ]` | `[ ]` | Public stats |

## `server/routes/ticketAutomation.js`

| Route | Legacy | New | Notes |
|-------|--------|-----|-------|
| `GET /api/ticket-automation/repos` | `[-]` | `[-]` | Git repos stub (returns empty list) |
| `GET /api/ticket-automation/customers` | `[x]` | `[x]` | Customer list for dropdowns |
| `CRUD /api/ticket-automation/customer-repositories` | `[x]` | `[x]` | Customer repository linking |
| `GET/PUT /api/ticket-automation/quotas` | `[x]` | `[x]` | Ticket quotas |
| `GET /api/ticket-automation/manual-review` | `[x]` | `[x]` | Manual review queue |
| `GET /api/ticket-automation/purchases` | `[x]` | `[x]` | Purchases list |

## `server/routes/bugReports.js`

| Route | Legacy | New | Notes |
|-------|--------|-----|-------|
| (all routes) | `[ ]` | `[ ]` | Bug report CRUD and linking to tickets |

## Frontend (`apps/web/src/app/admin/support/*`)

- `/admin/support` — ticket list with filters, stats and pagination `[x]`
- `/admin/support/[id]` — ticket detail with replies, status/priority/assignment updates `[x]`
- `/admin/support/automation` — customer repositories, quotas, manual review `[x]`
