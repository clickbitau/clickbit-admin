# CRM Endpoint Parity Report

Source of truth: `clickbit/server/routes/crm.js`  
New implementation: `clickbit-admin/apps/api/src/crm/`

## Summary

- Existing new NestJS endpoint: `GET /api/crm/companies` (implemented in `companies.controller.ts`)
- All other CRM endpoints are missing in `clickbit-admin` as of this audit.
- Legacy CRM routes are mounted at `/api/crm` in `clickbit/server/index.js`.

## Existing endpoint envelope check

`GET /api/crm/companies` in `apps/api/src/crm/companies.controller.ts` returns the same envelope as the legacy Express route:
```json
{ companies: [...], pagination: { currentPage, totalPages, totalItems, itemsPerPage }, aggregatedStats?: { totalValue, totalDeals, customerCount } }
```
The NestJS service mirrors the legacy filtering (search, industry, lifecycle_stage, owner_id), sorting, pagination, primary-contact lateral join, per-company revenue/deal/project/task totals, and aggregated stats calculation. The envelope shape and `totalItems`/`totalPages` fields match.

## CRM endpoint backlog

| Method | Path | Legacy auth | Status |
|--------|------|-------------|--------|
| PUT | `/api/crm/deals/:id/move` | admin/manager | Missing |
| PUT | `/api/crm/deals/:id/won` | admin/manager | Missing |
| PUT | `/api/crm/deals/:id/lost` | admin/manager | Missing |
| PUT | `/api/crm/deals/:id/reopen` | admin/manager | Missing |
| DELETE | `/api/crm/deals/:id` | admin/manager | Missing |
| GET | `/api/crm/companies` | admin/manager | Implemented |
| GET | `/api/crm/companies/:id` | admin/manager | Missing |
| GET | `/api/crm/companies/:id/users` | admin/manager | Missing |
| GET | `/api/crm/companies/:id/invoices` | admin/manager | Missing |
| GET | `/api/crm/companies/:id/payments` | admin/manager | Missing |
| GET | `/api/crm/companies/:id/value-breakdown` | admin/manager | Missing |
| POST | `/api/crm/companies` | admin/manager | Missing |
| PUT | `/api/crm/companies/:id` | admin/manager | Missing |
| DELETE | `/api/crm/companies/:id` | admin | Missing |
| GET | `/api/crm/activities` | admin/manager | Missing |
| GET | `/api/crm/activities/:id` | admin/manager | Missing |
| POST | `/api/crm/activities` | admin/manager | Missing |
| PUT | `/api/crm/activities/:id` | admin/manager | Missing |
| PUT | `/api/crm/activities/:id/complete` | admin/manager | Missing |
| DELETE | `/api/crm/activities/:id` | admin | Missing |
| GET | `/api/crm/notes` | admin/manager | Missing |
| POST | `/api/crm/notes` | admin/manager | Missing |
| PUT | `/api/crm/notes/:id` | admin/manager | Missing |
| DELETE | `/api/crm/notes/:id` | admin | Missing |
| POST | `/api/crm/contacts/:contactId/companies` | admin/manager | Missing |
| DELETE | `/api/crm/contacts/:contactId/companies/:companyId` | admin/manager | Missing |
| POST | `/api/crm/deals/bulk-update` | admin/manager | Missing |
| POST | `/api/crm/deals/bulk-delete` | admin/manager | Missing |
| GET | `/api/crm/automations` | admin/manager | Missing |
| GET | `/api/crm/automations/:id` | admin/manager | Missing |
| POST | `/api/crm/automations` | admin | Missing |
| PUT | `/api/crm/automations/:id` | admin | Missing |
| PUT | `/api/crm/automations/:id/toggle` | admin | Missing |
| DELETE | `/api/crm/automations/:id` | admin | Missing |
| POST | `/api/crm/automations/:id/test` | admin | Missing |
| POST | `/api/crm/integrations/order/:orderId/create-deal` | admin/manager | Missing |
| POST | `/api/crm/integrations/custom-package/:packageId/create-deal` | admin/manager | Missing |
| GET | `/api/crm/reports/forecast` | admin/manager | Missing |
| GET | `/api/crm/reports/velocity` | admin/manager | Missing |
| POST | `/api/crm/leads/recalculate-scores` | admin | Missing |
| POST | `/api/crm/leads/auto-assign` | admin | Missing |
| GET | `/api/crm/leads/hot` | admin/manager | Missing |
| GET | `/api/crm/leads/uncontacted` | admin/manager | Missing |
| GET | `/api/crm/leads/by-stage/:stage` | admin/manager | Missing |
| PUT | `/api/crm/contacts/:id/lead-score` | admin/manager | Missing |
| PUT | `/api/crm/contacts/:id/lifecycle-stage` | admin/manager | Missing |
| GET | `/api/crm/contacts/stats` | admin/manager | Missing |
| GET | `/api/crm/customers` | admin/manager | Missing |
| GET | `/api/crm/contacts/:id/invoices` | admin/manager | Missing |
| GET | `/api/crm/contacts/:id/payments` | admin/manager | Missing |
| GET | `/api/crm/contacts/:id/portal-access` | admin/manager | Missing |
| POST | `/api/crm/contacts/:id/portal-access` | admin/manager | Missing |
| POST | `/api/crm/contacts/:id/portal-access/resend` | admin/manager | Missing |
| POST | `/api/crm/contacts/portal-access/batch` | admin | Missing |
| GET | `/api/crm/contacts/with-portal-status` | admin/manager | Missing |
| GET | `/api/crm/companies/:id/documents` | admin/manager | Missing |
| POST | `/api/crm/companies/:id/documents` | admin/manager | Missing |
| PUT | `/api/crm/companies/:companyId/documents/:docId` | admin/manager | Missing |
| DELETE | `/api/crm/companies/:companyId/documents/:docId` | admin/manager | Missing |
| GET | `/api/crm/companies/:companyId/documents/:docId` | admin/manager | Missing |
| POST | `/api/crm/companies/:companyId/documents/:docId/download` | admin/manager | Missing |
| GET | `/api/crm/projects` | admin/manager | Missing |
| PATCH | `/api/crm/projects/:id/status` | admin/manager | Missing |
| GET | `/api/crm/projects/:id/related` | admin/manager | Missing |
| POST | `/api/crm/contacts/:id/convert-to-deal` | admin/manager | Missing |
| GET | `/api/crm/leads` | admin/manager | Missing |
| GET | `/api/crm/leads/pipeline/:pipelineId` | admin/manager | Missing |
| POST | `/api/crm/leads` | admin/manager | Missing |
| GET | `/api/crm/leads/:id` | admin/manager | Missing |
| PUT | `/api/crm/leads/:id` | admin/manager | Missing |
| PATCH | `/api/crm/leads/:id/move` | admin/manager | Missing |
| POST | `/api/crm/leads/:id/win` | admin/manager | Missing |
| POST | `/api/crm/leads/:id/lose` | admin/manager | Missing |
| DELETE | `/api/crm/leads/:id` | admin | Missing |
| GET | `/api/crm/projects-new` | admin/manager/employee | Missing |
| POST | `/api/crm/projects-new/:id/tasks` | admin/manager | Missing |
| GET | `/api/crm/projects-new/:id/tasks` | admin/manager/employee | Missing |
| GET | `/api/crm/projects-new/:id/subprojects` | admin/manager/employee | Missing |
| GET | `/api/crm/projects-new/:id/subprojects/:subprojectId` | admin/manager | Missing |
| POST | `/api/crm/projects-new/:id/subprojects` | admin/manager | Missing |
| PUT | `/api/crm/projects-new/:id/subprojects/:subprojectId/support` | admin/manager | Missing |
| PUT | `/api/crm/projects-new/:id/subprojects/:subprojectId` | admin/manager | Missing |
| DELETE | `/api/crm/projects-new/:id/subprojects/:subprojectId` | admin/manager | Missing |
| DELETE | `/api/crm/projects-new/:id/subprojects/:subprojectId/documents/:documentId` | admin/manager | Missing |
| POST | `/api/crm/projects-new/:id/subprojects/:subprojectId/send-support-email` | admin/manager | Missing |
| GET | `/api/crm/projects-new/:id/documents` | admin/manager | Missing |
| GET | `/api/crm/projects-new/:id` | admin/manager/employee | Missing |
| POST | `/api/crm/projects-new/:id/documents` | admin/manager | Missing |
| DELETE | `/api/crm/projects-new/:id/documents/:documentId` | admin/manager | Missing |
| GET | `/api/crm/projects-new/:id/meetings` | admin/manager/employee | Missing |
| POST | `/api/crm/projects-new/:id/meetings` | admin/manager | Missing |
| PUT | `/api/crm/projects-new/:id/meetings/:meetingId` | admin/manager | Missing |
| DELETE | `/api/crm/projects-new/:id/meetings/:meetingId` | admin/manager | Missing |
| POST | `/api/crm/projects-new` | admin/manager | Missing |
| PUT | `/api/crm/projects-new/:id` | admin/manager | Missing |
| POST | `/api/crm/projects-new/:id/recalculate-progress` | admin/manager | Missing |
| PATCH | `/api/crm/projects-new/:id/status` | admin/manager | Missing |
| POST | `/api/crm/projects-new/:id/send-support-email` | admin/manager | Missing |
| DELETE | `/api/crm/projects-new/:id` | admin | Missing |
| POST | `/api/crm/deals/:id/create-project` | admin/manager | Missing |
| PUT | `/api/crm/invoices/:id/link-project` | admin/manager | Missing |
| POST | `/api/crm/invoices/fix-project-links` | admin | Missing |
| PUT | `/api/crm/deals/:id/update-value` | admin/manager | Missing |

## Other legacy route modules (not implemented in this task)

High-level backlog from `clickbit/server/index.js` mount table (do not implement in this task):

`/api/auth`, `/api/users`, `/api/payments`, `/api/blog`, `/api/portfolio`, `/api/settings`, `/api/credentials`, `/api/clickdeploy`, `/api/pdf-templates`, `/api/contact`, `/api/analytics`, `/api/admin`, `/api/services`, `/api/marketing-posts`, `/api/team`, `/api/reviews`, `/api/public`, `/api/upload`, `/api/notifications`, `/api/invoices`, `/api/tickets`, `/api/project-lifecycle`, `/api/hr`, `/api/hr/kpi`, `/api/hr/payslips`, `/api/hr/forms`, `/api/departments`, `/api/projects`, `/api/expenses`, `/api/staff-advances`, `/api/customer`, `/api/agent`, `/api/documents`, `/api/mail`, `/api/chat`, `/api/messages`, `/api/admin/audit-logs`, `/api/profile`, `/api/verify`, `/api/bug-reports`, `/api/ticket-automation`, `/api/service-tokens`.

## Notes

- `/api/crm/deals/:id/won` side effects: legacy updates company/contact revenue stats, creates a customer portal account, and spawns a CrmLead.
- The duplicate `convert-to-deal` handler in the legacy routes should be implemented once only.
