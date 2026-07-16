# Content / Marketing — Legacy Parity Checklist

Source of truth: `clickbit/server/routes/publicContent.js`, `services.js`, `portfolio.js`, `team.js`, `reviews.js`, `blog.js`, `marketingPosts.js`.

## Legend
- `[x]` = implemented in `apps/api/src/content`
- `[-]` = partially implemented / stubbed
- `[ ]` = pending

## `server/routes/publicContent.js`

| Route | Legacy | New | Notes |
|-------|--------|-----|-------|
| `GET /api/public/site-identity` | `[x]` | `[x]` | Returns site title/meta/favicon default |
| `GET /api/public/contact-info` | `[x]` | `[x]` | Returns contact default |
| `GET /api/public/footer-content` | `[x]` | `[x]` | Footer copy default |
| `GET /api/public/navigation` | `[x]` | `[x]` | Nav links default |
| `GET /api/public/faq` | `[x]` | `[x]` | FAQ default |
| `GET /api/public/mission-points` | `[x]` | `[x]` | Mission points default |
| `GET /api/public/marketing-integrations` | `[x]` | `[x]` | Marketing integration IDs default |
| `GET /api/public/process-phases` | `[x]` | `[x]` | Process phases default |
| `GET /api/public/search` | `[x]` | `[x]` | Cross-content search (optional auth) |

## `server/routes/services.js`

| Route | Legacy | New | Notes |
|-------|--------|-----|-------|
| `GET /api/services` | `[x]` | `[x]` | Public active services |
| `GET /api/services/by-category` | `[x]` | `[x]` | Grouped services |
| `GET /api/services/for-project-form` | `[x]` | `[x]` | Project-form feature mapping |
| `GET /api/services/product-mapping` | `[x]` | `[x]` | Pricing tier product mapping |
| `GET /api/services/:slug` | `[x]` | `[x]` | Single service |
| `GET /api/services/admin/all` | `[-]` | `[x]` | Admin list (added for parity) |
| `GET /api/services/admin/stats` | `[-]` | `[x]` | Admin stats (added for parity) |
| `GET /api/services/admin/:id` | `[-]` | `[x]` | Admin single (added for parity) |
| `POST /api/services/admin` | `[-]` | `[x]` | Create service (added for parity) |
| `PUT /api/services/admin/:id` | `[-]` | `[x]` | Update service (added for parity) |
| `DELETE /api/services/admin/:id` | `[-]` | `[x]` | Delete service (added for parity) |

## `server/routes/portfolio.js`

| Route | Legacy | New | Notes |
|-------|--------|-----|-------|
| `GET /api/portfolio` | `[x]` | `[x]` | Public list |
| `GET /api/portfolio/featured` | `[x]` | `[x]` | Featured list |
| `GET /api/portfolio/categories` | `[x]` | `[x]` | Category list |
| `GET /api/portfolio/:slug` | `[x]` | `[x]` | Single item |
| `GET /api/portfolio/admin/all` | `[x]` | `[x]` | Admin list |
| `GET /api/portfolio/admin/stats` | `[x]` | `[x]` | Admin stats |
| `GET /api/portfolio/admin/:id` | `[x]` | `[x]` | Admin single |
| `POST /api/portfolio/admin` | `[x]` | `[x]` | Create item |
| `PUT /api/portfolio/admin/:id` | `[x]` | `[x]` | Update item |
| `DELETE /api/portfolio/admin/:id` | `[x]` | `[x]` | Delete item |

## `server/routes/team.js`

| Route | Legacy | New | Notes |
|-------|--------|-----|-------|
| `GET /api/team` | `[x]` | `[x]` | Public team list |
| `GET /api/team/:id` | `[x]` | `[x]` | Single member |
| `POST /api/team` | `[x]` | `[x]` | Create member (admin/manager) |
| `PUT /api/team/:id` | `[x]` | `[x]` | Update member |
| `DELETE /api/team/:id` | `[x]` | `[x]` | Delete member |

## `server/routes/reviews.js`

| Route | Legacy | New | Notes |
|-------|--------|-----|-------|
| `GET /api/reviews` | `[x]` | `[x]` | Public approved reviews |
| `POST /api/reviews` | `[x]` | `[x]` | Public submission |
| `GET /api/admin/reviews` | `[x]` | `[x]` | Admin list + stats |
| `PUT /api/admin/reviews/:id/status` | `[x]` | `[x]` | Approve/reject |
| `PUT /api/admin/reviews/:id` | `[x]` | `[x]` | Update review |
| `DELETE /api/admin/reviews/:id` | `[x]` | `[x]` | Delete review |
| `GET /api/admin/reviews/stats` | `[x]` | `[x]` | Stats |

## `server/routes/blog.js`

| Route | Legacy | New | Notes |
|-------|--------|-----|-------|
| `GET /api/blog` | `[x]` | `[x]` | Public posts |
| `GET /api/blog/featured` | `[x]` | `[x]` | Featured posts |
| `GET /api/blog/:slug` | `[x]` | `[x]` | Single post |
| `GET /api/blog/:slug/comments` | `[x]` | `[x]` | Post comments |
| `POST /api/blog/:slug/comments` | `[x]` | `[x]` | Submit comment |
| `GET /api/blog/admin/all` | `[x]` | `[x]` | Admin list |
| `GET /api/blog/admin/:id` | `[x]` | `[x]` | Admin single |
| `POST /api/blog/admin` | `[x]` | `[x]` | Create post |
| `PUT /api/blog/admin/:id` | `[x]` | `[x]` | Update post |
| `DELETE /api/blog/admin/:id` | `[x]` | `[x]` | Delete post |
| `GET /api/blog/admin/stats` | `[x]` | `[x]` | Stats |

## `server/routes/marketingPosts.js`

| Route | Legacy | New | Notes |
|-------|--------|-----|-------|
| `GET /api/marketing-posts` | `[x]` | `[x]` | Public feed (served from `blog_posts` tagged `marketing`) |
| `GET /api/marketing-posts/admin` | `[x]` | `[x]` | Admin list |
| `POST /api/marketing-posts/admin` | `[x]` | `[x]` | Create post |
| `PUT /api/marketing-posts/admin/:id` | `[x]` | `[x]` | Update post |
| `DELETE /api/marketing-posts/admin/:id` | `[x]` | `[x]` | Delete post |

## Frontend

- `[x]` `/admin/content` hub
- `[x]` `/admin/content/services`
- `[x]` `/admin/content/portfolio`
- `[x]` `/admin/content/team`
- `[x]` `/admin/content/reviews`
- `[x]` `/admin/content/blog`
- `[x]` `/admin/content/marketing`

## Deferred / known gaps

- Site setting defaults are hard-coded; live `site_settings` rows are used when present.
- Marketing post fields (`cta_label`, `cta_url`, `expires_at`, `is_pinned`) are mapped onto `blog_posts` columns (`tags`, `categories`, `content`, `featured`) because no separate `marketing_posts` table exists in the current Prisma schema.
- File/attachment uploads for portfolio and blog not implemented.
- Public content search does not query `contacts`, `orders`, `users`, or admin-only nav; returns empty arrays for those categories.
