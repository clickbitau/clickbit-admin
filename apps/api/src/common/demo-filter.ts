/**
 * Production metrics / default list queries should exclude demo seed data
 * (e.g. the Apple demo company and related records flagged is_demo).
 */
export const NOT_DEMO = { is_demo: false };

/** Prisma where fragment: exclude rows whose linked company is demo. */
export const notDemoCompany = {
  OR: [{ company_id: null }, { companies: { is_demo: false } }],
};

/** Payments may link via invoice and/or crm project — exclude demo-linked ones. */
export const notDemoPaymentLinks = {
  NOT: {
    OR: [
      { invoices: { is_demo: true } },
      { invoices: { companies: { is_demo: true } } },
      { crm_projects: { is_demo: true } },
      { crm_projects: { companies: { is_demo: true } } },
    ],
  },
};
