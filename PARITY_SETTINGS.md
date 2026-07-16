# Settings / Admin module parity

## Implemented

### Settings (`/api/settings`)
- `GET /api/settings/public/billing-settings` — public billing defaults
- `GET /api/settings/public` — public auto-load settings
- `GET /api/settings/public/:key` — single public setting
- `GET /api/settings/admin/all` — admin settings list with search/type filters
- `GET /api/settings/admin/type/:type` — settings grouped by type
- `GET /api/settings/admin/:key` — single admin setting
- `PUT /api/settings/admin/:key` — create/update setting
- `PUT /api/settings/admin/bulk` — bulk settings update
- `DELETE /api/settings/admin/:key` — delete setting
- `GET /api/settings/marketing-integrations` and `PUT /api/settings/marketing-integrations`
- `GET /api/settings/billing-settings` and `PUT /api/settings/billing-settings`

### Users (`/api/users`)
- `GET /api/users` — paginated user list (admin/manager, role/status/search/sort filters)
- `POST /api/users` — create user with Supabase Auth
- `GET /api/users/:id` — get user
- `PUT /api/users/:id` — update user
- `DELETE /api/users/:id` — delete user
- `GET /api/users/team` — team members (admin/manager)
- `GET /api/users/managers` — managers list

### Profile (`/api/profile`)
- `GET /api/profile` — current profile
- `PUT /api/profile` — update profile
- `PUT /api/profile/password` — change password
- `PUT /api/profile/notifications` — update notification preferences
- `DELETE /api/profile` — deactivate own account

### Admin (`/api/admin`)
- `GET /api/admin/data` — test admin route
- `GET /api/admin/dashboard/stats` — dashboard statistics
- `GET /api/admin/content-management` and `PUT /api/admin/content-management`
- `GET /api/admin/posts`, `GET /api/admin/posts/:id`
- `GET /api/admin/categories`
- `GET /api/admin/portfolio`, `GET /api/admin/portfolio/:id`
- `GET /api/admin/services`, `GET /api/admin/services/:id`, `GET /api/admin/services/:slug/detail`, `PUT /api/admin/services/:slug/detail`
- `GET /api/admin/team`, `GET /api/admin/team/:id`
- `GET /api/admin/reviews`

### Audit logs (`/api/admin/audit-logs`)
- `GET /api/admin/audit-logs/stats`
- `GET /api/admin/audit-logs`
- `GET /api/admin/audit-logs/entity/:type/:id`
- `GET /api/admin/audit-logs/restorable`
- `GET /api/admin/audit-logs/entity-types/list`
- `GET /api/admin/audit-logs/user/:userId`
- `GET /api/admin/audit-logs/export`
- `GET /api/admin/audit-logs/:id`

## Frontend
- `/admin/settings` — hub
- `/admin/settings/users` — user list/create/delete
- `/admin/settings/profile` — profile edit
- `/admin/settings/dashboard` — dashboard stats
- `/admin/settings/audit-logs` — audit log viewer

## Deferred / known gaps
- File uploads: avatar, company logo, documents
- Full company-linking side effects on user update
- Supabase Auth password verification for profile password change
- Audit log restore/undo (restorable action not wired)
- Admin content alias mutations (POST/PUT/DELETE for posts, portfolio, services, team) and admin reviews moderation
- Admin products, orders, scheduled-posts, scheduler status, cleanup, finance dashboard, agent requests
- Legacy `/api/admin/comments`, `/api/admin/faq`, `/api/admin/mission-points`, `/api/admin/process-phases`, `/api/admin/site-identity`, `/api/admin/contact-info`, `/api/admin/footer-content`, `/api/admin/navigation`
- Background workers (mailSync, payroll, reminder, recurring tasks, shifts, blog scheduler, analytics alerts, announcement automation)
