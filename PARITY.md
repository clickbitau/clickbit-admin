# CRM Endpoint Parity Audit

Generated from `clickbit/server/routes/crm.js` vs `clickbit-admin/apps/api/src/crm/**`.

## Legend

- **Implemented** — route exists in `apps/api` and returns the legacy envelope.
- **Partial** — route exists but envelope, status codes, or roles differ.
- **Missing** — route not yet ported.

## Endpoint parity table

| Method | Legacy path | New path | Legacy auth roles | Response envelope keys | Success | Errors | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/api/crm/dashboard` | `/api/crm/dashboard` | admin, manager | dealsByStage, overview, period, pipelineValue, recentDeals, topPerformers | 200 | 500 | Missing |
| GET | `/api/crm/contacts` | `/api/crm/contacts` | admin, manager | contacts, pagination | 200 | 500 | Missing |
| GET | `/api/crm/contacts/:id` | `/api/crm/contacts/:id` | admin, manager | data | 200 | 404, 500 | Missing |
| GET | `/api/crm/pipelines` | `/api/crm/pipelines` | admin, manager | (variable / entity) | 200 | 500 | Missing |
| GET | `/api/crm/pipelines/:id` | `/api/crm/pipelines/:id` | admin, manager | (variable / entity) | 200 | 404, 500 | Missing |
| POST | `/api/crm/pipelines` | `/api/crm/pipelines` | admin | (variable / entity) | 201 | 400, 500 | Missing |
| PUT | `/api/crm/pipelines/:id` | `/api/crm/pipelines/:id` | admin | (variable / entity) | 200 | 404, 500 | Missing |
| PUT | `/api/crm/pipelines/:id/stages` | `/api/crm/pipelines/:id/stages` | admin | (variable / entity) | 200 | 400, 404, 500 | Missing |
| GET | `/api/crm/deals` | `/api/crm/deals` | admin, manager | deals, pagination | 200 | 500 | Missing |
| GET | `/api/crm/deals/:id` | `/api/crm/deals/:id` | admin, manager | deal | 200 | 404, 500 | Missing |
| POST | `/api/crm/deals` | `/api/crm/deals` | admin, manager | (variable / entity) | 201 | 400, 500 | Missing |
| PUT | `/api/crm/deals/:id` | `/api/crm/deals/:id` | admin, manager | (variable / entity) | 200 | 400, 404, 500 | Missing |
| PUT | `/api/crm/deals/:id/move` | `/api/crm/deals/:id/move` | admin, manager | (variable / entity) | 200 | 400, 404, 500 | Missing |
| PUT | `/api/crm/deals/:id/won` | `/api/crm/deals/:id/won` | admin, manager | ...updatedDeal.toJSON, portalAccess | 200 | 404, 500 | Missing |
| PUT | `/api/crm/deals/:id/lost` | `/api/crm/deals/:id/lost` | admin, manager | (variable / entity) | 200 | 404, 500 | Missing |
| PUT | `/api/crm/deals/:id/reopen` | `/api/crm/deals/:id/reopen` | admin, manager | (variable / entity) | 200 | 404, 500 | Missing |
| DELETE | `/api/crm/deals/:id` | `/api/crm/deals/:id` | admin, manager | message | 200 | 404, 500 | Missing |
| GET | `/api/crm/companies` | `/api/crm/companies` | admin, manager | companies, pagination | 200 | 500 | Implemented |
| GET | `/api/crm/companies/:id` | `/api/crm/companies/:id` | admin, manager | (variable / entity) | 200 | 404, 500 | Missing |
| GET | `/api/crm/companies/:id/users` | `/api/crm/companies/:id/users` | admin, manager | users | 200 | 404, 500 | Missing |
| GET | `/api/crm/companies/:id/invoices` | `/api/crm/companies/:id/invoices` | admin, manager | invoices, pagination | 200 | 404, 500 | Missing |
| GET | `/api/crm/companies/:id/payments` | `/api/crm/companies/:id/payments` | admin, manager | pagination, payments | 200 | 404, 500 | Missing |
| GET | `/api/crm/companies/:id/value-breakdown` | `/api/crm/companies/:id/value-breakdown` | admin, manager | breakdown, company_id, company_name, counts, currency, total | 200 | 404, 500 | Missing |
| POST | `/api/crm/companies` | `/api/crm/companies` | admin, manager | (variable / entity) | 201 | 400, 500 | Missing |
| PUT | `/api/crm/companies/:id` | `/api/crm/companies/:id` | admin, manager | (variable / entity) | 200 | 404, 500 | Missing |
| DELETE | `/api/crm/companies/:id` | `/api/crm/companies/:id` | admin | message | 200 | 404, 500 | Missing |
| GET | `/api/crm/activities` | `/api/crm/activities` | admin, manager | activities, pagination | 200 | 500 | Missing |
| GET | `/api/crm/activities/:id` | `/api/crm/activities/:id` | admin, manager | (variable / entity) | 200 | 404, 500 | Missing |
| POST | `/api/crm/activities` | `/api/crm/activities` | admin, manager | (variable / entity) | 201 | 400, 500 | Missing |
| PUT | `/api/crm/activities/:id` | `/api/crm/activities/:id` | admin, manager | (variable / entity) | 200 | 404, 500 | Missing |
| PUT | `/api/crm/activities/:id/complete` | `/api/crm/activities/:id/complete` | admin, manager | (variable / entity) | 200 | 404, 500 | Missing |
| DELETE | `/api/crm/activities/:id` | `/api/crm/activities/:id` | admin | message | 200 | 404, 500 | Missing |
| GET | `/api/crm/notes` | `/api/crm/notes` | admin, manager | (variable / entity) | 200 | 500 | Missing |
| POST | `/api/crm/notes` | `/api/crm/notes` | admin, manager | (variable / entity) | 201 | 400, 500 | Missing |
| PUT | `/api/crm/notes/:id` | `/api/crm/notes/:id` | admin, manager | (variable / entity) | 200 | 403, 404, 500 | Missing |
| DELETE | `/api/crm/notes/:id` | `/api/crm/notes/:id` | admin | message | 200 | 404, 500 | Missing |
| POST | `/api/crm/contacts/:contactId/companies` | `/api/crm/contacts/:contactId/companies` | admin, manager | (variable / entity) | 200 | 404, 500 | Missing |
| DELETE | `/api/crm/contacts/:contactId/companies/:companyId` | `/api/crm/contacts/:contactId/companies/:companyId` | admin, manager | message | 200 | 404, 500 | Missing |
| POST | `/api/crm/deals/bulk-update` | `/api/crm/deals/bulk-update` | admin, manager | message, updated_count | 200 | 400, 500 | Missing |
| POST | `/api/crm/deals/bulk-delete` | `/api/crm/deals/bulk-delete` | admin, manager | deleted_count, message | 200 | 400, 500 | Missing |
| GET | `/api/crm/automations` | `/api/crm/automations` | admin, manager | automations, pagination | 200 | 500 | Missing |
| GET | `/api/crm/automations/:id` | `/api/crm/automations/:id` | admin, manager | (variable / entity) | 200 | 404, 500 | Missing |
| POST | `/api/crm/automations` | `/api/crm/automations` | admin | (variable / entity) | 201 | 400, 500 | Missing |
| PUT | `/api/crm/automations/:id` | `/api/crm/automations/:id` | admin | (variable / entity) | 200 | 404, 500 | Missing |
| PUT | `/api/crm/automations/:id/toggle` | `/api/crm/automations/:id/toggle` | admin | automation, message | 200 | 404, 500 | Missing |
| DELETE | `/api/crm/automations/:id` | `/api/crm/automations/:id` | admin | message | 200 | 404, 500 | Missing |
| POST | `/api/crm/automations/:id/test` | `/api/crm/automations/:id/test` | admin | (variable / entity) | 200 | 404, 500 | Missing |
| POST | `/api/crm/integrations/order/:orderId/create-deal` | `/api/crm/integrations/order/:orderId/create-deal` | admin, manager | (variable / entity) | 201 | 404, 500 | Missing |
| POST | `/api/crm/integrations/custom-package/:packageId/create-deal` | `/api/crm/integrations/custom-package/:packageId/create-deal` | admin, manager | (variable / entity) | 201 | 404, 500 | Missing |
| GET | `/api/crm/reports/forecast` | `/api/crm/reports/forecast` | admin, manager | (variable / entity) | 200 | 500 | Missing |
| GET | `/api/crm/reports/velocity` | `/api/crm/reports/velocity` | admin, manager | (variable / entity) | 200 | 500 | Missing |
| POST | `/api/crm/leads/recalculate-scores` | `/api/crm/leads/recalculate-scores` | admin | (variable / entity) | 200 | 500 | Missing |
| POST | `/api/crm/leads/auto-assign` | `/api/crm/leads/auto-assign` | admin | assigned_count, message | 200 | 500 | Missing |
| GET | `/api/crm/leads/hot` | `/api/crm/leads/hot` | admin, manager | (variable / entity) | 200 | 500 | Missing |
| GET | `/api/crm/leads/uncontacted` | `/api/crm/leads/uncontacted` | admin, manager | (variable / entity) | 200 | 500 | Missing |
| GET | `/api/crm/leads/by-stage/:stage` | `/api/crm/leads/by-stage/:stage` | admin, manager | (variable / entity) | 200 | 500 | Missing |
| PUT | `/api/crm/contacts/:id/lead-score` | `/api/crm/contacts/:id/lead-score` | admin, manager | lead_score | 200 | 404, 500 | Missing |
| PUT | `/api/crm/contacts/:id/lifecycle-stage` | `/api/crm/contacts/:id/lifecycle-stage` | admin, manager | (variable / entity) | 200 | 400, 404, 500 | Missing |
| GET | `/api/crm/contacts/stats` | `/api/crm/contacts/stats` | admin, manager | (variable / entity) | 200 | 500 | Missing |
| GET | `/api/crm/customers` | `/api/crm/customers` | admin, manager | data, pagination, success | 200 | 500 | Missing |
| GET | `/api/crm/contacts/:id/invoices` | `/api/crm/contacts/:id/invoices` | admin, manager | invoices, pagination | 200 | 404, 500 | Missing |
| GET | `/api/crm/contacts/:id/payments` | `/api/crm/contacts/:id/payments` | admin, manager | pagination, payments | 200 | 404, 500 | Missing |
| GET | `/api/crm/contacts/:id/portal-access` | `/api/crm/contacts/:id/portal-access` | admin, manager | hasAccess, linkType, user | 200 | 500 | Missing |
| POST | `/api/crm/contacts/:id/portal-access` | `/api/crm/contacts/:id/portal-access` | admin, manager | alreadyExists, linkedExisting, message, success, user | 200 / 201 | 400, 500 | Missing |
| POST | `/api/crm/contacts/:id/portal-access/resend` | `/api/crm/contacts/:id/portal-access/resend` | admin, manager | message, success | 200 | 400, 500 | Missing |
| POST | `/api/crm/contacts/portal-access/batch` | `/api/crm/contacts/portal-access/batch` | admin | (variable / entity) | 200 | 400, 500 | Missing |
| GET | `/api/crm/contacts/with-portal-status` | `/api/crm/contacts/with-portal-status` | admin, manager | contacts, pagination | 200 | 500 | Missing |
| GET | `/api/crm/companies/:id/documents` | `/api/crm/companies/:id/documents` | admin, manager | company, documents, pagination, subprojectDocuments | 200 | 404, 500 | Missing |
| POST | `/api/crm/companies/:id/documents` | `/api/crm/companies/:id/documents` | admin, manager | document, message | 201 | 400, 404, 500 | Missing |
| PUT | `/api/crm/companies/:companyId/documents/:docId` | `/api/crm/companies/:companyId/documents/:docId` | admin, manager | document, message | 200 | 404, 500 | Missing |
| DELETE | `/api/crm/companies/:companyId/documents/:docId` | `/api/crm/companies/:companyId/documents/:docId` | admin, manager | message | 200 | 404, 500 | Missing |
| GET | `/api/crm/companies/:companyId/documents/:docId` | `/api/crm/companies/:companyId/documents/:docId` | admin, manager | (variable / entity) | 200 | 404, 500 | Missing |
| POST | `/api/crm/companies/:companyId/documents/:docId/download` | `/api/crm/companies/:companyId/documents/:docId/download` | any authenticated | download_url, message | 200 | 404, 500 | Missing |
| GET | `/api/crm/projects` | `/api/crm/projects` | admin, manager | pagination, projects, stats | 200 | 500 | Missing |
| PATCH | `/api/crm/projects/:id/status` | `/api/crm/projects/:id/status` | admin, manager | message, project | 200 | 404, 500 | Missing |
| GET | `/api/crm/projects/:id/related` | `/api/crm/projects/:id/related` | admin, manager | project, related, summary | 200 | 404, 500 | Missing |
| POST | `/api/crm/contacts/:id/convert-to-deal` | `/api/crm/contacts/:id/convert-to-deal` | admin, manager | deal, message | 201 | 400, 404, 500 | Missing |
| GET | `/api/crm/leads` | `/api/crm/leads` | admin, manager | leads, pagination | 200 | 500 | Missing |
| GET | `/api/crm/leads/pipeline/:pipelineId` | `/api/crm/leads/pipeline/:pipelineId` | admin, manager | pipeline, stages, stats | 200 | 404, 500 | Missing |
| POST | `/api/crm/leads` | `/api/crm/leads` | admin, manager | lead, message | 201 | 400, 500 | Missing |
| GET | `/api/crm/leads/:id` | `/api/crm/leads/:id` | admin, manager | lead | 200 | 404, 500 | Missing |
| PUT | `/api/crm/leads/:id` | `/api/crm/leads/:id` | admin, manager | lead, message | 200 | 404, 500 | Missing |
| PATCH | `/api/crm/leads/:id/move` | `/api/crm/leads/:id/move` | admin, manager | lead, message | 200 | 404, 500 | Missing |
| POST | `/api/crm/leads/:id/win` | `/api/crm/leads/:id/win` | admin, manager | customer, deal, lead, message | 200 | 404, 500 | Missing |
| POST | `/api/crm/leads/:id/lose` | `/api/crm/leads/:id/lose` | admin, manager | lead, message | 200 | 404, 500 | Missing |
| DELETE | `/api/crm/leads/:id` | `/api/crm/leads/:id` | admin | message | 200 | 404, 500 | Missing |
| GET | `/api/crm/projects-new` | `/api/crm/projects-new` | admin, manager, employee | pagination, projects, stats | 200 | 500 | Missing |
| POST | `/api/crm/projects-new/:id/tasks` | `/api/crm/projects-new/:id/tasks` | admin, manager | (variable / entity) | 201 | 404, 500 | Missing |
| GET | `/api/crm/projects-new/:id/tasks` | `/api/crm/projects-new/:id/tasks` | admin, manager, employee | stats, tasks | 200 | 403, 404, 500 | Missing |
| GET | `/api/crm/projects-new/:id/subprojects` | `/api/crm/projects-new/:id/subprojects` | admin, manager, employee | pagination, subprojects | 200 | 400, 404, 500 | Missing |
| GET | `/api/crm/projects-new/:id/subprojects/:subprojectId` | `/api/crm/projects-new/:id/subprojects/:subprojectId` | admin, manager | subproject | 200 | 400, 404, 500 | Missing |
| POST | `/api/crm/projects-new/:id/subprojects` | `/api/crm/projects-new/:id/subprojects` | admin, manager | message, subproject | 201 | 400, 404, 500 | Missing |
| PUT | `/api/crm/projects-new/:id/subprojects/:subprojectId/support` | `/api/crm/projects-new/:id/subprojects/:subprojectId/support` | admin, manager | message, subproject | 200 | 404, 500 | Missing |
| PUT | `/api/crm/projects-new/:id/subprojects/:subprojectId` | `/api/crm/projects-new/:id/subprojects/:subprojectId` | admin, manager | message, subproject | 200 | 400, 404, 500 | Missing |
| DELETE | `/api/crm/projects-new/:id/subprojects/:subprojectId` | `/api/crm/projects-new/:id/subprojects/:subprojectId` | admin, manager | message | 200 | 400, 404, 500 | Missing |
| DELETE | `/api/crm/projects-new/:id/subprojects/:subprojectId/documents/:documentId` | `/api/crm/projects-new/:id/subprojects/:subprojectId/documents/:documentId` | admin, manager | message | 200 | 400, 404, 500 | Missing |
| POST | `/api/crm/projects-new/:id/subprojects/:subprojectId/send-support-email` | `/api/crm/projects-new/:id/subprojects/:subprojectId/send-support-email` | admin, manager | message, sentTo | 200 | 400, 404, 500 | Missing |
| GET | `/api/crm/projects-new/:id/documents` | `/api/crm/projects-new/:id/documents` | admin, manager | documents | 200 | 400, 404, 500 | Missing |
| GET | `/api/crm/projects-new/:id` | `/api/crm/projects-new/:id` | admin, manager, employee | project | 200 | 400, 403, 404, 500 | Missing |
| POST | `/api/crm/projects-new/:id/documents` | `/api/crm/projects-new/:id/documents` | admin, manager | document, message | 201 | 400, 404, 500 | Missing |
| DELETE | `/api/crm/projects-new/:id/documents/:documentId` | `/api/crm/projects-new/:id/documents/:documentId` | admin, manager | message | 200 | 400, 404, 500 | Missing |
| GET | `/api/crm/projects-new/:id/meetings` | `/api/crm/projects-new/:id/meetings` | admin, manager, employee | (variable / entity) | 200 | 400, 403, 500 | Missing |
| POST | `/api/crm/projects-new/:id/meetings` | `/api/crm/projects-new/:id/meetings` | admin, manager | meeting, message | 201 | 400, 500 | Missing |
| PUT | `/api/crm/projects-new/:id/meetings/:meetingId` | `/api/crm/projects-new/:id/meetings/:meetingId` | admin, manager | meeting, message | 200 | 404, 500 | Missing |
| DELETE | `/api/crm/projects-new/:id/meetings/:meetingId` | `/api/crm/projects-new/:id/meetings/:meetingId` | admin, manager | message | 200 | 404, 500 | Missing |
| POST | `/api/crm/projects-new` | `/api/crm/projects-new` | admin, manager | message, project | 201 | 400, 500 | Missing |
| PUT | `/api/crm/projects-new/:id` | `/api/crm/projects-new/:id` | admin, manager | message, project | 200 | 404, 500 | Missing |
| POST | `/api/crm/projects-new/:id/recalculate-progress` | `/api/crm/projects-new/:id/recalculate-progress` | admin, manager | afterProgress, beforeProgress, message, project | 200 | 404, 500 | Missing |
| PATCH | `/api/crm/projects-new/:id/status` | `/api/crm/projects-new/:id/status` | admin, manager | message, project | 200 | 404, 500 | Missing |
| POST | `/api/crm/projects-new/:id/send-support-email` | `/api/crm/projects-new/:id/send-support-email` | admin, manager | message, sentTo | 200 | 400, 404, 500 | Missing |
| DELETE | `/api/crm/projects-new/:id` | `/api/crm/projects-new/:id` | admin | message | 200 | 404, 500 | Missing |
| POST | `/api/crm/deals/:id/create-project` | `/api/crm/deals/:id/create-project` | admin, manager | message, project | 201 | 400, 404, 500 | Missing |
| PUT | `/api/crm/invoices/:id/link-project` | `/api/crm/invoices/:id/link-project` | admin, manager | invoice, message | 200 | 404, 500 | Missing |
| POST | `/api/crm/invoices/fix-project-links` | `/api/crm/invoices/fix-project-links` | admin | message, skipped_or_error, total_candidates, updated_count | 200 | 500 | Missing |
| PUT | `/api/crm/deals/:id/update-value` | `/api/crm/deals/:id/update-value` | admin, manager | calculated_value, deal, invoice_count, message | 200 | 404, 500 | Missing |

## Existing `GET /api/crm/companies` response envelope

Legacy `GET /api/crm/companies` returns:

```json
{
  "companies": [ /* Company objects */ ],
  "pagination": {
    "currentPage": <number>,
    "totalPages": <number>,
    "totalItems": <number>,
    "itemsPerPage": <number>
  },
  "aggregatedStats": {
    "totalValue": <number>,
    "totalDeals": <number>,
    "customerCount": <number>
  }
}
```

The new `apps/api/src/crm/companies.service.ts` produces the same `{ companies, pagination }`
shape and conditionally adds `aggregatedStats` when `includeStats !== "false"` and `mode !== "simple"`.
The `CompaniesListResponse` type in `packages/shared` matches the legacy envelope.
Pagination keys use `currentPage/totalPages/totalItems/itemsPerPage` in both old and new code.
The new implementation also adds computed per-company fields (`total_deals`, `total_projects`, `total_tasks`, `total_revenue`) which preserve the legacy totals contract.

## Other legacy route files mounted by `clickbit/server/index.js`

`server/index.js` mounts the following route modules under `/api/*` (high-level count: 45 files):

- `server/routes/auth-secure.js`
- `server/routes/users.js`
- `server/routes/payments.js`
- `server/routes/adminPayments.js`
- `server/routes/blog.js`
- `server/routes/portfolio.js`
- `server/routes/settings.js`
- `server/routes/credentials.js`
- `server/routes/clickdeploy.js`
- `server/routes/pdfTemplates.js`
- `server/routes/contact.js`
- `server/routes/analytics.js`
- `server/routes/admin.js`
- `server/routes/services.js`
- `server/routes/team.js`
- `server/routes/reviews.js`
- `server/routes/publicContent.js`
- `server/routes/upload.js`
- `server/routes/notifications.js`
- `server/routes/pushNotificationEndpoints.js`
- `server/routes/invoices.js`
- `server/routes/tickets.js`
- `server/routes/ticketsAdvanced.js`
- `server/routes/crm.js`
- `server/routes/projectLifecycle.js`
- `server/routes/hr.js`
- `server/routes/hr/kpi.js`
- `server/routes/hrPayslips.js`
- `server/routes/hrForms.js`
- `server/routes/departments.js`
- `server/routes/project-tasks.js`
- `server/routes/expenses.js`
- `server/routes/staffAdvances.js`
- `server/routes/customer.js`
- `server/routes/agent.js`
- `server/routes/documents.js`
- `server/routes/mail.js`
- `server/routes/chat.js`
- `server/routes/messages.js`
- `server/routes/auditLogs.js`
- `server/routes/profile.js`
- `server/routes/verify.js`
- `server/routes/bugReports.js`
- `server/routes/ticketAutomation.js`
- `server/routes/serviceTokens.js`

These are listed for migration planning only; no implementation changes were made.