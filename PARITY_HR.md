# HR Module Endpoint Parity

Source of truth: `clickbitau/clickbit/server/routes/hr.js` (and `hrForms.js`, `hrPayslips.js`, `hr/kpi.js`).
Target implementation: `clickbitau/clickbit-admin/apps/api/src/hr/`.

## Legend

- ✅ Implemented in `apps/api/src/hr/`
- 🚧 Not yet implemented

## Core HR (`/api/hr/*`)

| Legacy Route | New Route | Status | Notes |
|---|---|---|---|
| GET /api/hr/dashboard | `GET /api/hr/dashboard` | ✅ | Admin/manager stats |
| GET /api/hr/employee-dashboard | `GET /api/hr/employee-dashboard` | ✅ | Employee self-service dashboard |
| GET /api/hr/employees | `GET /api/hr/employees` | ✅ | List/search employees |
| GET /api/hr/employees/me | `GET /api/hr/employees/me` | ✅ | Current user employee record |
| GET /api/hr/employees/:id | `GET /api/hr/employees/:id` | ✅ | Employee detail |
| POST /api/hr/employees | `POST /api/hr/employees` | ✅ | Create employee |
| PUT /api/hr/employees/:id | `PUT /api/hr/employees/:id` | ✅ | Update employee |
| POST /api/hr/employees/sync | `POST /api/hr/employees/sync` | ✅ | Sync from profiles/users |
| DELETE /api/hr/employees/:id | `DELETE /api/hr/employees/:id` | ✅ | Soft delete |
| GET /api/hr/employees/:id/documents | `GET /api/hr/employees/:id/documents` | ✅ | List employee docs |
| POST /api/hr/employees/:id/documents | `POST /api/hr/employees/:id/documents` | 🚧 | File upload not ported |
| DELETE /api/hr/employees/:employeeId/documents/:docId | `DELETE ...` | ✅ | Delete document record |

## Time Clock & Timesheets

| Legacy Route | New Route | Status | Notes |
|---|---|---|---|
| GET /api/hr/time-clock/status | `GET /api/hr/time-clock/status` | ✅ | |
| POST /api/hr/time-clock/auto-clock-in | `POST /api/hr/time-clock/auto-clock-in` | ✅ | |
| POST /api/hr/time-clock/upload-photo | `POST /api/hr/time-clock/upload-photo` | ✅ | File upload to Supabase Storage |
| POST /api/hr/time-clock/clock-in | `POST /api/hr/time-clock/clock-in` | ✅ | |
| POST /api/hr/time-clock/clock-out | `POST /api/hr/time-clock/clock-out` | ✅ | |
| POST /api/hr/time-clock/start-break | `POST /api/hr/time-clock/start-break` | ✅ | |
| POST /api/hr/time-clock/end-break | `POST /api/hr/time-clock/end-break` | ✅ | |
| GET /api/hr/time-clock/active | `GET /api/hr/time-clock/active` | ✅ | |
| POST /api/hr/time-clock/breadcrumb | `POST /api/hr/time-clock/breadcrumb` | ✅ | |
| GET /api/hr/timesheets | `GET /api/hr/timesheets` | ✅ | List/search with summary |
| GET /api/hr/timesheets/summary/:employeeId | `GET /api/hr/timesheets/summary/:employeeId` | ✅ | |
| PUT /api/hr/timesheets/:id/edit | `PUT /api/hr/timesheets/:id/edit` | ✅ | |
| POST /api/hr/timesheets/:id/approve | `POST /api/hr/timesheets/:id/approve` | ✅ | |
| POST /api/hr/timesheets/:id/reject | `POST /api/hr/timesheets/:id/reject` | ✅ | |
| GET /api/hr/timesheets/:id/tasks | `GET /api/hr/timesheets/:id/tasks` | ✅ | |
| POST /api/hr/timesheets/:id/work-items | `POST /api/hr/timesheets/:id/work-items` | ✅ | |
| DELETE /api/hr/timesheets/:id/work-items/:itemId | `DELETE ...` | ✅ | |
| POST /api/hr/timesheets/manual | `POST /api/hr/timesheets/manual` | ✅ | |
| POST /api/hr/timesheets/bulk-delete | `POST /api/hr/timesheets/bulk-delete` | ✅ | |
| DELETE /api/hr/timesheets/:id | `DELETE /api/hr/timesheets/:id` | ✅ | |

## Shifts

| Legacy Route | New Route | Status | Notes |
|---|---|---|---|
| GET /api/hr/shifts | `GET /api/hr/shifts` | ✅ | |
| POST /api/hr/shifts | `POST /api/hr/shifts` | ✅ | |
| POST /api/hr/shifts/batch | `POST /api/hr/shifts/batch` | ✅ | |
| PUT /api/hr/shifts/:id | `PUT /api/hr/shifts/:id` | ✅ | |
| DELETE /api/hr/shifts/:id | `DELETE /api/hr/shifts/:id` | ✅ | |
| DELETE /api/hr/shifts/employee/:employeeId | `DELETE ...` | ✅ | |
| POST /api/hr/shifts/:id/confirm | `POST /api/hr/shifts/:id/confirm` | ✅ | |
| POST /api/hr/shifts/publish | `POST /api/hr/shifts/publish` | ✅ | |
| POST /api/hr/shifts/copy-week | `POST /api/hr/shifts/copy-week` | ✅ | |
| GET /api/hr/shifts/open | `GET /api/hr/shifts/open` | ✅ | |
| POST /api/hr/shifts/:id/claim | `POST /api/hr/shifts/:id/claim` | ✅ | |

## Time Off

| Legacy Route | New Route | Status | Notes |
|---|---|---|---|
| GET /api/hr/time-off | `GET /api/hr/time-off` | ✅ | List time-off requests |
| POST /api/hr/time-off | `POST /api/hr/time-off` | ✅ | Create request |
| POST /api/hr/time-off/:id/approve | `POST /api/hr/time-off/:id/approve` | ✅ | |
| POST /api/hr/time-off/:id/reject | `POST /api/hr/time-off/:id/reject` | ✅ | |
| POST /api/hr/time-off/:id/revoke | `POST /api/hr/time-off/:id/revoke` | ✅ | |
| POST /api/hr/time-off/:id/cancel | `POST /api/hr/time-off/:id/cancel` | ✅ | |
| GET /api/hr/time-off/calendar | `GET /api/hr/time-off/calendar` | ✅ | Calendar view |

## Announcements

| Legacy Route | New Route | Status | Notes |
|---|---|---|---|
| GET /api/hr/announcements/public | `GET /api/hr/announcements/public` | ✅ | Public feed |
| GET /api/hr/announcements | `GET /api/hr/announcements` | ✅ | Admin list |
| GET /api/hr/announcements/:id | `GET /api/hr/announcements/:id` | ✅ | Detail |
| POST /api/hr/announcements | `POST /api/hr/announcements` | ✅ | Create |
| PUT /api/hr/announcements/:id | `PUT /api/hr/announcements/:id` | ✅ | Update |
| DELETE /api/hr/announcements/:id | `DELETE /api/hr/announcements/:id` | ✅ | Delete |
| POST /api/hr/announcements/:id/publish | `POST /api/hr/announcements/:id/publish` | ✅ | |
| POST /api/hr/announcements/:id/acknowledge | `POST /api/hr/announcements/:id/acknowledge` | ✅ | |
| POST /api/hr/announcements/:id/react | `POST /api/hr/announcements/:id/react` | ✅ | |
| POST /api/hr/announcements/:id/comment | `POST /api/hr/announcements/:id/comment` | ✅ | |

## Reminders

| Legacy Route | New Route | Status | Notes |
|---|---|---|---|
| GET /api/hr/reminders | `GET /api/hr/reminders` | ✅ | |
| GET /api/hr/reminders/:id | `GET /api/hr/reminders/:id` | ✅ | |
| POST /api/hr/reminders | `POST /api/hr/reminders` | ✅ | |
| PUT /api/hr/reminders/:id | `PUT /api/hr/reminders/:id` | ✅ | |
| DELETE /api/hr/reminders/:id | `DELETE /api/hr/reminders/:id` | ✅ | |
| POST /api/hr/reminders/:id/complete | `POST /api/hr/reminders/:id/complete` | ✅ | |
| POST /api/hr/reminders/:id/send-email | `POST /api/hr/reminders/:id/send-email` | 🚧 | Email sending deferred |

## Contracts

| Legacy Route | New Route | Status | Notes |
|---|---|---|---|
| GET /api/hr/contracts | `GET /api/hr/contracts` | 🚧 | |
| GET /api/hr/contracts/coi-blocked | `GET /api/hr/contracts/coi-blocked` | 🚧 | |
| POST /api/hr/contracts | `POST /api/hr/contracts` | 🚧 | |
| PUT /api/hr/contracts/:id | `PUT /api/hr/contracts/:id` | 🚧 | |
| POST /api/hr/contracts/:id/accept | `POST /api/hr/contracts/:id/accept` | 🚧 | |
| POST /api/hr/contracts/:id/activate | `POST /api/hr/contracts/:id/activate` | 🚧 | |
| POST /api/hr/contracts/:id/terminate | `POST /api/hr/contracts/:id/terminate` | 🚧 | |
| GET /api/hr/contracts/:id/pdf | `GET /api/hr/contracts/:id/pdf` | 🚧 | |
| POST /api/hr/contracts/:id/send | `POST /api/hr/contracts/:id/send` | 🚧 | |

## Public Holidays

| Legacy Route | New Route | Status | Notes |
|---|---|---|---|
| GET /api/hr/public-holidays | `GET /api/hr/public-holidays` | ✅ | |
| POST /api/hr/public-holidays/import | `POST /api/hr/public-holidays/import` | ✅ | Bulk import |
| POST /api/hr/public-holidays | `POST /api/hr/public-holidays` | ✅ | Create |
| PUT /api/hr/public-holidays/:id | `PUT /api/hr/public-holidays/:id` | ✅ | Update |
| DELETE /api/hr/public-holidays/:id | `DELETE /api/hr/public-holidays/:id` | ✅ | Delete |

## Other HR route files

- `server/routes/hrForms.js` — HR form templates and submissions → 🚧
- `server/routes/hrPayslips.js` — payslip generation and distribution → 🚧
- `server/routes/hr/kpi.js` — KPI tracking → 🚧
