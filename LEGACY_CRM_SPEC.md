# Legacy CRM Spec

Reference for porting `clickbit/server/routes/crm.js` into `clickbit-admin/apps/api`.
All legacy paths are mounted under `/api/crm` and the new Nest controllers should preserve the same response envelopes and status codes.

## Dashboard

### Endpoints

| Method | Path | Description | Auth roles | Response envelope | Statuses |
| --- | --- | --- | --- | --- | --- |
| GET | `/dashboard` | Get CRM dashboard stats | admin, manager | `dealsByStage, overview, period, pipelineValue, recentDeals, topPerformers` | 200, 500 |

### Request / response notes

- `GET /` returns `{ overview, pipelineValue, dealsByStage, recentDeals, topPerformers, period }`

## Contacts

### Endpoints

| Method | Path | Description | Auth roles | Response envelope | Statuses |
| --- | --- | --- | --- | --- | --- |
| GET | `/contacts` | Get all contacts with optional filters | admin, manager | `contacts, pagination` | 200, 500 |
| GET | `/contacts/:id` | Get single contact | admin, manager | `data` | 200, 404, 500 |
| POST | `/contacts/:contactId/companies` | Link contact to company | admin, manager | `entity / message` | 200, 404, 500 |
| DELETE | `/contacts/:contactId/companies/:companyId` | Remove contact from company | admin, manager | `message` | 200, 404, 500 |
| PUT | `/contacts/:id/lead-score` | Update contact lead score | admin, manager | `lead_score` | 200, 404, 500 |
| PUT | `/contacts/:id/lifecycle-stage` | Update contact lifecycle stage | admin, manager | `entity / message` | 200, 400, 404, 500 |
| GET | `/contacts/stats` | Get contact CRM stats | admin, manager | `entity / message` | 200, 500 |
| GET | `/contacts/:id/invoices` | Get invoices for a contact | admin, manager | `invoices, pagination` | 200, 404, 500 |
| GET | `/contacts/:id/payments` | Get payments for a contact | admin, manager | `pagination, payments` | 200, 404, 500 |
| GET | `/contacts/:id/portal-access` | Check portal access status for a contact | admin, manager | `hasAccess, linkType, user` | 200, 500 |
| POST | `/contacts/:id/portal-access` | Create portal access for a contact | admin, manager | `alreadyExists, linkedExisting, message, success, user` | ?, 400, 500 |
| POST | `/contacts/:id/portal-access/resend` | Resend portal setup email | admin, manager | `message, success` | 200, 400, 500 |
| POST | `/contacts/portal-access/batch` | Batch create portal access for multiple contacts | admin | `entity / message` | 200, 400, 500 |
| GET | `/contacts/with-portal-status` | Get all contacts with their portal access status | admin, manager | `contacts, pagination` | 200, 500 |
| POST | `/contacts/:id/convert-to-deal` | Convert lead to deal | admin, manager | `deal, message` | 201, 400, 404, 500 |

### Request / response notes

- `GET /` query: `search, company, industry, lifecycle_stage, owner_id, status, lead_status, page, limit, sortBy, sortOrder`
- `GET /` response: `{ contacts, pagination: { total, limit, offset } }`
- `GET /:id` response: `{ data: contactData }`
- `POST /` and `PUT /:id` body use `Contact` model fields plus `company_id` and `primary_company` metadata

## Pipelines

### Endpoints

| Method | Path | Description | Auth roles | Response envelope | Statuses |
| --- | --- | --- | --- | --- | --- |
| GET | `/pipelines` | Get all pipelines | admin, manager | `entity / message` | 200, 500 |
| GET | `/pipelines/:id` | Get single pipeline with stages and deals | admin, manager | `entity / message` | 200, 404, 500 |
| POST | `/pipelines` | Create pipeline | admin | `entity / message` | 201, 400, 500 |
| PUT | `/pipelines/:id` | Update pipeline | admin | `entity / message` | 200, 404, 500 |
| PUT | `/pipelines/:id/stages` | Update pipeline stages (reorder, add, remove) | admin | `entity / message` | 200, 400, 404, 500 |

### Request / response notes

- `GET /` returns an array of pipelines directly (`res.json(pipelines)`)
- `GET /:id` returns the pipeline object with nested `stages` and `deals`
- `POST /`, `PUT /:id`, `PUT /:id/stages` return the created/updated pipeline object

## Deals

### Endpoints

| Method | Path | Description | Auth roles | Response envelope | Statuses |
| --- | --- | --- | --- | --- | --- |
| GET | `/deals` | Get all deals | admin, manager | `deals, pagination` | 200, 500 |
| GET | `/deals/:id` | Get single deal | admin, manager | `deal` | 200, 404, 500 |
| POST | `/deals` | Create deal | admin, manager | `entity / message` | 201, 400, 500 |
| PUT | `/deals/:id` | Update deal | admin, manager | `entity / message` | 200, 400, 404, 500 |
| PUT | `/deals/:id/move` | Move deal to different stage (drag and drop) | admin, manager | `entity / message` | 200, 400, 404, 500 |
| PUT | `/deals/:id/won` | Mark deal as won | admin, manager | `...updatedDeal.toJSON, portalAccess` | 200, 404, 500 |
| PUT | `/deals/:id/lost` | Mark deal as lost | admin, manager | `entity / message` | 200, 404, 500 |
| PUT | `/deals/:id/reopen` | Reopen deal | admin, manager | `entity / message` | 200, 404, 500 |
| DELETE | `/deals/:id` | Delete deal | admin, manager | `message` | 200, 404, 500 |
| POST | `/deals/bulk-update` | Bulk update deals | admin, manager | `message, updated_count` | 200, 400, 500 |
| POST | `/deals/bulk-delete` | Bulk delete deals | admin, manager | `deleted_count, message` | 200, 400, 500 |
| POST | `/deals/:id/create-project` | Create a project from a deal | admin, manager | `message, project` | 201, 400, 404, 500 |
| PUT | `/deals/:id/update-value` | Update deal value from linked invoices/estimates | admin, manager | `calculated_value, deal, invoice_count, message` | 200, 404, 500 |

### Request / response notes

- `GET /` query: `pipeline_id`, `stage_id`, `status`, `owner_id`, `company_id`, `contact_id`, `search`, `priority`, `page`, `limit`, `sortBy`, `sortOrder`
- `GET /` response: `{ deals, pagination: { currentPage, totalPages, totalItems, itemsPerPage } }`
- `GET /:id` response: `{ deal: { id, deal_number, title, ..., pipeline, stage, owner, primaryContact, company, order, invoice, activities, notes, stageHistory, contactAssociations } }`
- `POST /` body: `title, description, value, currency, pipeline_id, stage_id, contact_id, company_id, owner_id, expected_close_date, lead_source, priority, tags, custom_fields`

## Companies

### Endpoints

| Method | Path | Description | Auth roles | Response envelope | Statuses |
| --- | --- | --- | --- | --- | --- |
| GET | `/companies` | Get all companies | admin, manager | `companies, pagination` | 200, 500 |
| GET | `/companies/:id` | Get single company | admin, manager | `entity / message` | 200, 404, 500 |
| GET | `/companies/:id/users` | Get users/profiles linked to a company | admin, manager | `users` | 200, 404, 500 |
| GET | `/companies/:id/invoices` | Get invoices for a company | admin, manager | `invoices, pagination` | 200, 404, 500 |
| GET | `/companies/:id/payments` | Get payments for a company | admin, manager | `pagination, payments` | 200, 404, 500 |
| GET | `/companies/:id/value-breakdown` | Get value breakdown for a company (invoices, deals, projects) | admin, manager | `breakdown, company_id, company_name, counts, currency, total` | 200, 404, 500 |
| POST | `/companies` | Create company | admin, manager | `entity / message` | 201, 400, 500 |
| PUT | `/companies/:id` | Update company | admin, manager | `entity / message` | 200, 404, 500 |
| DELETE | `/companies/:id` | Delete company | admin | `message` | 200, 404, 500 |
| GET | `/companies/:id/documents` | Get all documents for a company (company docs + subproject docs) | admin, manager | `company, documents, pagination, subprojectDocuments` | 200, 404, 500 |
| POST | `/companies/:id/documents` | Upload document for a company | admin, manager | `document, message` | 201, 400, 404, 500 |
| PUT | `/companies/:companyId/documents/:docId` | Update document metadata | admin, manager | `document, message` | 200, 404, 500 |
| DELETE | `/companies/:companyId/documents/:docId` | Delete document | admin, manager | `message` | 200, 404, 500 |
| GET | `/companies/:companyId/documents/:docId` | Get single document | admin, manager | `entity / message` | 200, 404, 500 |
| POST | `/companies/:companyId/documents/:docId/download` | Track document download | any | `download_url, message` | 200, 404, 500 |

### Request / response notes

- `GET /` query: `search`, `industry`, `lifecycle_stage`, `owner_id`, `page`, `limit`, `sortBy`, `sortOrder`, `includeStats`, `mode`
- `GET /` response: `{ companies, pagination: { currentPage, totalPages, totalItems, itemsPerPage }, aggregatedStats? }`
- `aggregatedStats` omitted when `mode=simple` or `includeStats=false`

## Leads

### Endpoints

| Method | Path | Description | Auth roles | Response envelope | Statuses |
| --- | --- | --- | --- | --- | --- |
| POST | `/leads/recalculate-scores` | Recalculate all lead scores | admin | `entity / message` | 200, 500 |
| POST | `/leads/auto-assign` | Auto-assign unassigned leads | admin | `assigned_count, message` | 200, 500 |
| GET | `/leads/hot` | Get hot leads | admin, manager | `entity / message` | 200, 500 |
| GET | `/leads/uncontacted` | Get uncontacted leads | admin, manager | `entity / message` | 200, 500 |
| GET | `/leads/by-stage/:stage` | Get leads by lifecycle stage | admin, manager | `entity / message` | 200, 500 |
| GET | `/leads` | Get all leads (for sales pipeline) | admin, manager | `leads, pagination` | 200, 500 |
| GET | `/leads/pipeline/:pipelineId` | Get leads by pipeline (for pipeline view with stages) | admin, manager | `pipeline, stages, stats` | 200, 404, 500 |
| POST | `/leads` | Create a new lead | admin, manager | `lead, message` | 201, 400, 500 |
| GET | `/leads/:id` | Get a single lead by ID | admin, manager | `lead` | 200, 404, 500 |
| PUT | `/leads/:id` | Update a lead | admin, manager | `lead, message` | 200, 404, 500 |
| PATCH | `/leads/:id/move` | Move lead to different stage | admin, manager | `lead, message` | 200, 404, 500 |
| POST | `/leads/:id/win` | Mark lead as won (convert to customer) | admin, manager | `customer, deal, lead, message` | 200, 404, 500 |
| POST | `/leads/:id/lose` | Mark lead as lost | admin, manager | `lead, message` | 200, 404, 500 |
| DELETE | `/leads/:id` | Delete a lead | admin | `message` | 200, 404, 500 |

### Request / response notes

- Leads use the same pipeline/stage model as deals
- `GET /` and `GET /pipeline/:pipelineId` return `{ leads, pagination }`
- `POST /`, `PUT /:id`, `PATCH /:id/move`, `POST /:id/win`, `POST /:id/lose` return the lead object

## Projects

### Endpoints

| Method | Path | Description | Auth roles | Response envelope | Statuses |
| --- | --- | --- | --- | --- | --- |
| GET | `/projects` | Get all projects (won deals) | admin, manager | `pagination, projects, stats` | 200, 500 |
| PATCH | `/projects/:id/status` | Update project status | admin, manager | `message, project` | 200, 404, 500 |
| GET | `/projects/:id/related` | Get project with all related entities (invoices, expenses, tickets, tasks) | admin, manager | `project, related, summary` | 200, 404, 500 |
| GET | `/projects-new` | Get all CRM projects | admin, manager, employee | `pagination, projects, stats` | 200, 500 |
| POST | `/projects-new/:id/tasks` | Create a task for a CRM project | admin, manager | `entity / message` | 201, 404, 500 |
| GET | `/projects-new/:id/tasks` | Get tasks for a CRM project | admin, manager, employee | `stats, tasks` | 200, 403, 404, 500 |
| GET | `/projects-new/:id/subprojects` | Get all subprojects for a project | admin, manager, employee | `pagination, subprojects` | 200, 400, 404, 500 |
| GET | `/projects-new/:id/subprojects/:subprojectId` | Get a single subproject | admin, manager | `subproject` | 200, 400, 404, 500 |
| POST | `/projects-new/:id/subprojects` | Create a new subproject | admin, manager | `message, subproject` | 201, 400, 404, 500 |
| PUT | `/projects-new/:id/subprojects/:subprojectId/support` | Update support period for a subproject | admin, manager | `message, subproject` | 200, 404, 500 |
| PUT | `/projects-new/:id/subprojects/:subprojectId` | Update a subproject | admin, manager | `message, subproject` | 200, 400, 404, 500 |
| DELETE | `/projects-new/:id/subprojects/:subprojectId` | Delete a subproject (soft delete) | admin, manager | `message` | 200, 400, 404, 500 |
| DELETE | `/projects-new/:id/subprojects/:subprojectId/documents/:documentId` | Delete a subproject document | admin, manager | `message` | 200, 400, 404, 500 |
| POST | `/projects-new/:id/subprojects/:subprojectId/send-support-email` | Send support expiry email to client for a subproject | admin, manager | `message, sentTo` | 200, 400, 404, 500 |
| GET | `/projects-new/:id/documents` | Get project-level documents for a CRM project | admin, manager | `documents` | 200, 400, 404, 500 |
| GET | `/projects-new/:id` | Get a single CRM project with tasks and all related entities | admin, manager, employee | `project` | 200, 400, 403, 404, 500 |
| POST | `/projects-new/:id/documents` | Upload document for a project | admin, manager | `document, message` | 201, 400, 404, 500 |
| DELETE | `/projects-new/:id/documents/:documentId` | Delete a project document | admin, manager | `message` | 200, 400, 404, 500 |
| GET | `/projects-new/:id/meetings` | Get all meetings for a project | admin, manager, employee | `entity / message` | 200, 400, 403, 500 |
| POST | `/projects-new/:id/meetings` | Create a meeting for a project | admin, manager | `meeting, message` | 201, 400, 500 |
| PUT | `/projects-new/:id/meetings/:meetingId` | Update a meeting | admin, manager | `meeting, message` | 200, 404, 500 |
| DELETE | `/projects-new/:id/meetings/:meetingId` | Delete a meeting | admin, manager | `message` | 200, 404, 500 |
| POST | `/projects-new` | Create a new CRM project | admin, manager | `message, project` | 201, 400, 500 |
| PUT | `/projects-new/:id` | Update a CRM project | admin, manager | `message, project` | 200, 404, 500 |
| POST | `/projects-new/:id/recalculate-progress` | Manually recalculate project progress from subprojects | admin, manager | `afterProgress, beforeProgress, message, project` | 200, 404, 500 |
| PATCH | `/projects-new/:id/status` | Update CRM project status | admin, manager | `message, project` | 200, 404, 500 |
| POST | `/projects-new/:id/send-support-email` | Send support expiry email to client for a project | admin, manager | `message, sentTo` | 200, 400, 404, 500 |
| DELETE | `/projects-new/:id` | Delete a CRM project | admin | `message` | 200, 404, 500 |

### Request / response notes

- Project endpoints are under `/projects-new` in the legacy file
- `GET /` response: `{ projects, pagination }`; `GET /:id` returns full project with tasks/subprojects/meetings
- `POST /`, `PUT /:id`, `PATCH /:id/status`, `POST /:id/recalculate-progress` return the project object
- Subprojects nested under `/projects-new/:id/subprojects` with the same core field set as projects minus `customer_id/deal_id`

## Activities

### Endpoints

| Method | Path | Description | Auth roles | Response envelope | Statuses |
| --- | --- | --- | --- | --- | --- |
| GET | `/activities` | Get all activities | admin, manager | `activities, pagination` | 200, 500 |
| GET | `/activities/:id` | Get single activity | admin, manager | `entity / message` | 200, 404, 500 |
| POST | `/activities` | Create activity | admin, manager | `entity / message` | 201, 400, 500 |
| PUT | `/activities/:id` | Update activity | admin, manager | `entity / message` | 200, 404, 500 |
| PUT | `/activities/:id/complete` | Complete activity | admin, manager | `entity / message` | 200, 404, 500 |
| DELETE | `/activities/:id` | Delete activity | admin | `message` | 200, 404, 500 |

### Request / response notes

- `GET /` response: `{ activities, pagination }`
- `POST /`, `PUT /:id`, `GET /:id` return the activity object
- Activity can be linked to `contact_id`, `company_id`, or `deal_id`

## Notes

### Endpoints

| Method | Path | Description | Auth roles | Response envelope | Statuses |
| --- | --- | --- | --- | --- | --- |
| GET | `/notes` | Get notes for an entity | admin, manager | `entity / message` | 200, 500 |
| POST | `/notes` | Create note | admin, manager | `entity / message` | 201, 400, 500 |
| PUT | `/notes/:id` | Update note | admin, manager | `entity / message` | 200, 403, 404, 500 |
| DELETE | `/notes/:id` | Delete note | admin | `message` | 200, 404, 500 |

### Request / response notes

- Notes can attach to `contact_id`, `company_id`, `deal_id`, or `activity_id`
- `GET /` response: `{ notes, pagination }`; `POST /` and `PUT /:id` return the note object

## Meetings

### Endpoints

| Method | Path | Description | Auth roles | Response envelope | Statuses |
| --- | --- | --- | --- | --- | --- |

### Request / response notes

- Meetings are project-scoped: `/projects-new/:id/meetings`
- `GET /` returns an array of meetings; `POST /` and `PUT /:meetingId` return the meeting object

## Automations

### Endpoints

| Method | Path | Description | Auth roles | Response envelope | Statuses |
| --- | --- | --- | --- | --- | --- |
| GET | `/automations` | Get all automations | admin, manager | `automations, pagination` | 200, 500 |
| GET | `/automations/:id` | Get single automation with logs | admin, manager | `entity / message` | 200, 404, 500 |
| POST | `/automations` | Create automation | admin | `entity / message` | 201, 400, 500 |
| PUT | `/automations/:id` | Update automation | admin | `entity / message` | 200, 404, 500 |
| PUT | `/automations/:id/toggle` | Toggle automation active status | admin | `automation, message` | 200, 404, 500 |
| DELETE | `/automations/:id` | Delete automation | admin | `message` | 200, 404, 500 |
| POST | `/automations/:id/test` | Test automation manually | admin | `entity / message` | 200, 404, 500 |

### Request / response notes

- `GET /` returns `{ automations, pagination }`
- `POST /` returns the created automation; `PUT /:id` returns the updated automation
- Logs nested under `/automations/:id/logs` return `{ logs, pagination }`

## Customers

### Endpoints

| Method | Path | Description | Auth roles | Response envelope | Statuses |
| --- | --- | --- | --- | --- | --- |
| GET | `/customers` | Get all customers | admin, manager | `data, pagination, success` | 200, 500 |

### Request / response notes

- See `PARITY.md` for full endpoint list and status codes.

## Integrations

### Endpoints

| Method | Path | Description | Auth roles | Response envelope | Statuses |
| --- | --- | --- | --- | --- | --- |
| POST | `/integrations/order/:orderId/create-deal` | Create deal from order | admin, manager | `entity / message` | 201, 404, 500 |
| POST | `/integrations/custom-package/:packageId/create-deal` | Create deal from custom package | admin, manager | `entity / message` | 201, 404, 500 |

### Request / response notes

- See `PARITY.md` for full endpoint list and status codes.

## Invoices

### Endpoints

| Method | Path | Description | Auth roles | Response envelope | Statuses |
| --- | --- | --- | --- | --- | --- |
| PUT | `/invoices/:id/link-project` | Link invoice to project | admin, manager | `invoice, message` | 200, 404, 500 |
| POST | `/invoices/fix-project-links` | Fix invoice project links (migration for bug fix) | admin | `message, skipped_or_error, total_candidates, updated_count` | 200, 500 |

### Request / response notes

- See `PARITY.md` for full endpoint list and status codes.

## Reports

### Endpoints

| Method | Path | Description | Auth roles | Response envelope | Statuses |
| --- | --- | --- | --- | --- | --- |
| GET | `/reports/forecast` | Get sales forecast | admin, manager | `entity / message` | 200, 500 |
| GET | `/reports/velocity` | Get pipeline velocity metrics | admin, manager | `entity / message` | 200, 500 |

### Request / response notes

- See `PARITY.md` for full endpoint list and status codes.

## Field mappings (legacy Sequelize -> Prisma)

The legacy Sequelize models and the Prisma introspected schema use the same `snake_case` column names, so fields map 1:1. New code should keep these exact JSON keys in response bodies.

### Companies (`companies`)

`id`, `name`, `contact_person`, `domain`, `industry`, `company_size`, `annual_revenue`, `phone`, `email`, `address_line1`, `address_line2`, `city`, `state`, `postal_code`, `country`, `description`, `logo_url`, `linkedin_url`, `twitter_url`, `facebook_url`, `owner_id`, `parent_company_id`, `agent_id`, `lifecycle_stage`, `lead_source`, `last_activity_at`, `total_revenue`, `total_deals`, `custom_fields`, `tags`, `is_active`, `is_demo`, `company_type`, `trading_name`, `abn`, `acn`, `currency_code`, `payment_terms`, `created_at`, `updated_at`, `deleted_at`

### Contacts (`contacts`)

`id`, `name`, `email`, `phone`, `subject`, `message`, `rating`, `contact_type`, `priority`, `status`, `assigned_to`, `user_id`, `company`, `company_id`, `website`, `location`, `custom_fields`, `source`, `referrer`, `ip_address`, `user_agent`, `read_at`, `replied_at`, `resolved_at`, `closed_at`, `admin_notes`, `tags`, `lead_score`, `lifecycle_stage`, `lead_status`, `job_title`, `department`, `linkedin_url`, `twitter_url`, `date_of_birth`, `owner_id`, `last_contacted_at`, `contact_count`, `email_subscribed`, `do_not_call`, `became_mql_at`, `became_sql_at`, `became_customer_at`, `total_revenue`, `agent_id`, `commission_type`, `commission_rate`, `timezone`, `preferred_contact_method`, `avatar_url`, `is_demo`, `created_at`, `updated_at`, `deleted_at`

### Deals (`deals`)

`id`, `deal_number`, `title`, `description`, `value`, `currency`, `pipeline_id`, `stage_id`, `contact_id`, `company_id`, `owner_id`, `probability`, `expected_close_date`, `actual_close_date`, `won_reason`, `lost_reason`, `competitor`, `lead_source`, `priority`, `status`, `stage_entered_at`, `last_activity_at`, `next_activity_date`, `order_id`, `custom_package_id`, `tags`, `custom_fields`, `position`, `is_project`, `project_status`, `project_start_date`, `project_end_date`, `project_completion_percentage`, `created_at`, `updated_at`, `deleted_at`

### Pipelines (`crm_pipelines / crm_pipeline_stages`)

- `crm_pipelines: id, name, description, pipeline_type, currency, is_default, is_active, created_by, created_at, updated_at, is_demo`
- `crm_pipeline_stages: id, pipeline_id, name, description, position, probability, color, is_won, is_lost, rotting_days, is_active, is_demo, created_at, updated_at`

### Leads (`crm_leads`)

`id`, `lead_number`, `name`, `email`, `phone`, `company_name`, `job_title`, `website`, `pipeline_id`, `stage_id`, `position`, `estimated_value`, `currency`, `probability`, `lead_score`, `lead_source`, `priority`, `status`, `expected_close_date`, `actual_close_date`, `stage_entered_at`, `last_activity_at`, `next_activity_date`, `won_reason`, `lost_reason`, `competitor`, `owner_id`, `contact_id`, `company_id`, `converted_contact_id`, `description`, `requirements`, `tags`, `custom_fields`, `is_demo`, `created_at`, `updated_at`

### Projects (`crm_projects`)

`id`, `project_number`, `name`, `description`, `status`, `progress_percentage`, `priority`, `budget`, `actual_cost`, `currency`, `hourly_rate`, `start_date`, `due_date`, `completed_date`, `estimated_hours`, `actual_hours`, `customer_id`, `company_id`, `deal_id`, `manager_id`, `created_by`, `project_type`, `customer_visible`, `tags`, `custom_fields`, `internal_notes`, `customer_notes`, `support_period_type`, `support_start_date`, `support_end_date`, `support_price`, `support_currency`, `support_notes`, `is_demo`, `created_at`, `updated_at`, `deleted_at`

### Subprojects (`crm_subprojects`)

`id`, `parent_project_id`, `name`, `description`, `status`, `progress_percentage`, `priority`, `budget`, `actual_cost`, `currency`, `start_date`, `due_date`, `completed_date`, `manager_id`, `created_by`, `support_period_type`, `support_start_date`, `support_end_date`, `support_price`, `support_currency`, `support_notes`, `created_at`, `updated_at`, `deleted_at`

### Activities (`crm_activities`)

`id`, `activity_type`, `subject`, `description`, `status`, `priority`, `due_date`, `due_time`, `duration_minutes`, `completed_at`, `outcome`, `contact_id`, `company_id`, `deal_id`, `owner_id`, `assigned_to`, `created_by`, `call_direction`, `call_outcome`, `location`, `meeting_link`, `attendees`, `email_subject`, `email_body`, `email_sent_at`, `email_opened_at`, `email_clicked_at`, `reminder_at`, `reminder_sent`, `is_recurring`, `recurrence_pattern`, `parent_activity_id`, `attachments`, `custom_fields`, `is_pinned`, `created_at`, `updated_at`

### Notes (`crm_notes`)

`id`, `content`, `note_type`, `contact_id`, `company_id`, `deal_id`, `activity_id`, `created_by`, `is_pinned`, `is_private`, `attachments`, `mentions`, `created_at`, `updated_at`

### Meetings (`crm_meetings`)

`id`, `crm_project_id`, `title`, `meeting_date`, `duration_minutes`, `participants`, `notes`, `status`, `created_by`, `created_at`, `updated_at`

### Automations (`crm_automations / crm_automation_logs`)

- `crm_automations: id, name, description, trigger_type, trigger_conditions, action_type, action_config, target_entity, delay_minutes, is_active, execution_count, last_executed_at, created_by, created_at, updated_at`
- `crm_automation_logs: id, automation_id, trigger_data, entity_type, entity_id, status, result, error_message, executed_at`

## Pagination envelopes

Two pagination shapes are used across CRM list endpoints:

1. **Companies / Deals / Leads / Projects / Activities / Notes / Automations**
   ```json
   {
     "<resource>": [],
     "pagination": {
       "currentPage": 1,
       "totalPages": 1,
       "totalItems": 0,
       "itemsPerPage": 50
     }
   }
   ```

2. **Contacts**
   ```json
   {
     "contacts": [],
     "pagination": {
       "total": 0,
       "limit": 50,
       "offset": 0
     }
   }
   ```

Single-resource endpoints usually return the object directly or wrapped as `{ <resource>: object }` / `{ data: object }`.

## Common enum values

- `lifecycle_stage`: `subscriber`, `lead`, `marketing_qualified`, `sales_qualified`, `opportunity`, `customer`, `evangelist`, `completed`, `internal`, `other`
- `deal.status` / `lead.status`: `open`, `won`, `lost`
- `deal.priority` / `lead.priority`: `low`, `medium`, `high`, `urgent`
- `project.status` / `subproject.status`: `not_started`, `in_progress`, `on_hold`, `completed`, `cancelled`
- `activity.status`: `planned`, `in_progress`, `completed`, `cancelled`, `overdue`
- `activity.activity_type`: `call`, `email`, `meeting`, `task`, `note`, `lunch`, `deadline`, `follow_up`, `demo`, `other`
- `note.note_type`: `general`, `call`, `meeting`, `internal`, `important`
- `pipeline.pipeline_type`: `sales`, `marketing`, `support`, `custom`
- `project.support_period_type` / `subproject.support_period_type`: `3_months`, `6_months`, `1_year`, `2_years`, `3_years`, `5_years`, `lifetime`, `custom`