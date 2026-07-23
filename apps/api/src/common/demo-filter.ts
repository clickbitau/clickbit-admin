/**
 * Demo seed data (e.g. Apple demo company) must not appear in the admin portal
 * or production metrics. Prefer spreading these helpers into Prisma `where` clauses.
 */
export const NOT_DEMO = { is_demo: false };

/** Prisma where fragment: exclude rows whose linked company is demo. */
export const notDemoCompany = {
  OR: [{ company_id: null }, { companies: { is_demo: false } }],
};

/** Deals have no is_demo column — hide those tied to demo companies or contacts. */
export const notDemoDealLinks = {
  AND: [
    { OR: [{ company_id: null }, { companies: { is_demo: false } }] },
    { OR: [{ contact_id: null }, { contacts: { is_demo: false } }] },
  ],
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
