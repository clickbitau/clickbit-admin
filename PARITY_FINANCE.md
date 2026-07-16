# Finance Module Endpoint Parity

Source of truth: `clickbitau/clickbit/server/routes/{expenses,payments,invoices}.js`.
Target implementation: `clickbitau/clickbit-admin/apps/api/src/finance/`.

## Expenses (`/api/expenses`)

| Legacy Route | Admin Route | Status | Notes |
|---|---|---|---|
| GET /api/expenses/stats | `GET /api/expenses/stats` | ✅ | Legacy envelope `{ success, data, pagination }`.
| GET /api/expenses/ | `GET /api/expenses` | ✅ | List, search, pagination, legacy envelope.
| GET /api/expenses/pending | `GET /api/expenses/pending` | ✅ | Pending approvals.
| GET /api/expenses/reimbursable | `GET /api/expenses/reimbursable` | ✅ | Reimbursable list.
| GET /api/expenses/billable | `GET /api/expenses/billable` | ✅ | Billable list.
| GET /api/expenses/:id | `GET /api/expenses/:id` | ✅ | Full relation mapping.
| POST /api/expenses | `POST /api/expenses` | ✅ | CRUD + auto-number.
| PUT /api/expenses/:id | `PUT /api/expenses/:id` | ✅ | Partial update.
| DELETE /api/expenses/:id | `DELETE /api/expenses/:id` | ✅ | Soft delete.
| POST /api/expenses/:id/approve | `POST /api/expenses/:id/approve` | ✅ | Approval flow.
| POST /api/expenses/:id/reject | `POST /api/expenses/:id/reject` | ✅ | Rejection flow.
| POST /api/expenses/:id/reimburse | `POST /api/expenses/:id/reimburse` | ✅ | Reimbursement.
| POST /api/expenses/:id/add-to-invoice | `POST /api/expenses/:id/add-to-invoice` | ✅ | Link to invoice.
| POST /api/expenses/:id/duplicate | `POST /api/expenses/:id/duplicate` | ✅ | Duplicate expense.
| POST /api/expenses/:id/add-receipt | `POST /api/expenses/:id/add-receipt` | ✅ | Attach receipt JSON.
| GET /api/expenses/receipts/list | `GET /api/expenses/receipts/list` | ✅ | Receipt list.
| GET /api/expenses/receipts/unmatched | `GET /api/expenses/receipts/unmatched` | ✅ | Unmatched receipts.
| GET /api/expenses/receipts/stats | `GET /api/expenses/receipts/stats` | ✅ | Receipt stats.
| GET /api/expenses/receipts/:id | `GET /api/expenses/receipts/:id` | ✅ | Receipt detail.
| POST /api/expenses/receipts | `POST /api/expenses/receipts` | ✅ | Create receipt.
| PUT /api/expenses/receipts/:id | `PUT /api/expenses/receipts/:id` | ✅ | Update receipt.
| DELETE /api/expenses/receipts/:id | `DELETE /api/expenses/receipts/:id` | ✅ | Delete receipt.
| POST /api/expenses/receipts/:id/link-expense | `POST /api/expenses/receipts/:id/link-expense` | ✅ | Link receipt to expense.
| POST /api/expenses/receipts/:id/unlink | `POST /api/expenses/receipts/:id/unlink` | ✅ | Unlink receipt.
| POST /api/expenses/receipts/:id/create-expense | `POST /api/expenses/receipts/:id/create-expense` | ✅ | Auto-create expense.

## Payments (`/api/payments` admin)

| Legacy Route | Admin Route | Status | Notes |
|---|---|---|---|
| GET /api/payments | `GET /api/payments` | ✅ | Admin payments list with legacy pagination.
| GET /api/payments/stats | `GET /api/payments/stats` | ✅ | Aggregations.
| POST /api/payments | `POST /api/payments` | ✅ | Manual payment record, recalculates invoice.
| DELETE /api/payments/:id | `DELETE /api/payments/:id` | ✅ | Soft delete + recalc invoice.
| Public payment routes | — | 🚧 | Stripe intents, checkout, webhooks, public status routes not implemented. |

## Invoices (`/api/invoices` / `/api/custom-packages`)

| Legacy Route | Admin Route | Status | Notes |
|---|---|---|---|
| GET /api/invoices/stats | `GET /api/invoices/stats` | ✅ | Status counts + overdue.
| GET /api/invoices | `GET /api/invoices` | ✅ | List with legacy multi-key envelope (`packages/data/invoices`).
| POST /api/invoices | `POST /api/invoices` | ✅ | Create invoice/estimate/quote, auto-link contact/company.
| GET /api/invoices/:id | `GET /api/invoices/:id` | ✅ | Detail with `payment_records` mapped to `payments`.
| PUT /api/invoices/:id | `PUT /api/invoices/:id` | ✅ | Update + recalc totals.
| DELETE /api/invoices/:id | `DELETE /api/invoices/:id` | ✅ | Soft delete.
| POST /api/invoices/:id/void | `POST /api/invoices/:id/void` | ✅ | Cancel invoice.
| POST /api/invoices/:id/send | `POST /api/invoices/:id/send` | ✅ | Mark sent + payment URL.
| POST /api/invoices/:id/mark-paid | `POST /api/invoices/:id/mark-paid` | ✅ | Manual full payment.
| POST /api/invoices/:id/record-payment | `POST /api/invoices/:id/record-payment` | ✅ | Partial/over-payment record.
| POST /api/invoices/:id/recalculate-payments | `POST /api/invoices/:id/recalculate-payments` | ✅ | Recalc from `payments` table.
| POST /api/invoices/recalculate-all-payments | `POST /api/invoices/recalculate-all-payments` | ✅ | Bulk recalc.
| GET /api/invoices/:id/pdf | `GET /api/invoices/:id/pdf` | 🚧 | PDF generation not yet ported; 501 placeholder.
| Public pay routes (`/api/invoices/pay/:code/*`) | — | 🚧 | Public portal + Stripe checkout not implemented. |
| POST /api/invoices/from-contact/:contactId | — | 🚧 | Not yet implemented. |
| POST /api/invoices/:id/recover-stripe-payment | — | 🚧 | Not yet implemented. |
| POST /api/invoices/recover-stripe-by-client | — | 🚧 | Not yet implemented. |

## Frontend Pages

| Legacy Page (`client/src/pages/admin/finance`) | Next.js Page | Status |
|---|---|---|
| Invoices / Quotes / Estimates list | `apps/web/src/app/admin/finance/invoices/page.tsx` | 🚧 |
| Invoice detail/edit/create | `apps/web/src/app/admin/finance/invoices/[id]/page.tsx` | 🚧 |
| Expenses list | `apps/web/src/app/admin/finance/expenses/page.tsx` | 🚧 |
| Expense detail/edit/create | `apps/web/src/app/admin/finance/expenses/[id]/page.tsx` | 🚧 |
| Payments list | `apps/web/src/app/admin/finance/payments/page.tsx` | 🚧 |
