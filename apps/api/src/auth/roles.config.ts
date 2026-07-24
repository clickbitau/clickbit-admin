// Ported from clickbit/server/config/roles.js — extended for manager ACL wiring.

export type PermissionGroup = {
  key: string;
  label: string;
  description: string;
};

/** Catalog shown in admin → user → Manager Permissions UI. */
export const AVAILABLE_PERMISSIONS: Record<string, PermissionGroup[]> = {
  dashboard: [{ key: 'dashboard:view', label: 'View Dashboard', description: 'Access the admin dashboard' }],
  users: [
    { key: 'users:list', label: 'List Users', description: 'View list of users' },
    { key: 'users:view', label: 'View Profile Details', description: 'View individual user details' },
    { key: 'users:create', label: 'Create Users', description: 'Create new user accounts' },
    { key: 'users:update', label: 'Update Users', description: 'Modify user accounts' },
    { key: 'users:delete', label: 'Delete Users', description: 'Remove user accounts' },
  ],
  content: [
    { key: 'content:list', label: 'List Content', description: 'View list of blog posts and portfolio items' },
    { key: 'content:view', label: 'View Content', description: 'View individual content items' },
    { key: 'content:create', label: 'Create Content', description: 'Create new blog posts and portfolio items' },
    { key: 'content:update', label: 'Update Content', description: 'Modify existing content' },
    { key: 'content:delete', label: 'Delete Content', description: 'Remove content items' },
  ],
  services: [
    { key: 'services:list', label: 'List Services', description: 'View list of services' },
    { key: 'services:view', label: 'View Services', description: 'View service details' },
    { key: 'services:create', label: 'Create Services', description: 'Create new services' },
    { key: 'services:update', label: 'Update Services', description: 'Modify services' },
    { key: 'services:delete', label: 'Delete Services', description: 'Remove services' },
  ],
  team: [
    { key: 'team:list', label: 'List Team Members', description: 'View team member list' },
    { key: 'team:view', label: 'View Team Members', description: 'View team member details' },
    { key: 'team:create', label: 'Create Team Members', description: 'Add new team members' },
    { key: 'team:update', label: 'Update Team Members', description: 'Modify team member info' },
    { key: 'team:delete', label: 'Delete Team Members', description: 'Remove team members' },
  ],
  reviews: [
    { key: 'reviews:list', label: 'List Reviews', description: 'View list of reviews' },
    { key: 'reviews:view', label: 'View Reviews', description: 'View review details' },
    { key: 'reviews:update', label: 'Update Reviews', description: 'Modify reviews (approve/reject)' },
    { key: 'reviews:delete', label: 'Delete Reviews', description: 'Remove reviews' },
  ],
  contacts: [
    { key: 'contacts:list', label: 'List Contacts', description: 'View list of contacts' },
    { key: 'contacts:view', label: 'View Contacts', description: 'View contact details' },
    { key: 'contacts:delete', label: 'Delete Contacts', description: 'Remove contacts' },
  ],
  orders: [
    { key: 'orders:list', label: 'List Orders', description: 'View list of orders' },
    { key: 'orders:view', label: 'View Orders', description: 'View order details' },
    { key: 'orders:update', label: 'Update Orders', description: 'Modify order status' },
    { key: 'orders:delete', label: 'Delete Orders', description: 'Remove orders' },
  ],
  settings: [
    { key: 'settings:view', label: 'View Settings', description: 'View site settings' },
    { key: 'settings:update', label: 'Update Settings', description: 'Modify site settings' },
  ],
  billing: [
    { key: 'billing:view', label: 'View Billing', description: 'View billing settings' },
    { key: 'billing:update', label: 'Update Billing', description: 'Modify billing settings' },
  ],
  marketing: [
    { key: 'marketing:view', label: 'View Marketing', description: 'View marketing settings' },
    { key: 'marketing:update', label: 'Update Marketing', description: 'Modify marketing settings' },
  ],
  crm: [
    { key: 'crm:view', label: 'View CRM', description: 'Access CRM features' },
    { key: 'crm:manage', label: 'Manage CRM', description: 'Create/Edit CRM data' },
  ],
  hr: [
    { key: 'hr:view', label: 'View HR', description: 'Access HR features' },
    { key: 'hr:manage', label: 'Manage HR', description: 'Create/Edit HR data (timesheets, schedules, etc.)' },
    { key: 'contracts:manage', label: 'Manage Contracts', description: 'Create, edit, activate, terminate and email employment contracts' },
  ],
  finance: [
    { key: 'finance:view', label: 'View Finance', description: 'Access invoices and expenses' },
    { key: 'finance:manage', label: 'Manage Finance', description: 'Create/Edit invoices and expenses' },
  ],
  support: [
    { key: 'support:view', label: 'View Support', description: 'Access support tickets' },
    { key: 'support:manage', label: 'Manage Support', description: 'Update and automate support tickets' },
  ],
  communication: [
    { key: 'communication:view', label: 'View Communication', description: 'Access chat and mail' },
    { key: 'communication:manage', label: 'Manage Communication', description: 'Send mail and manage chat workspaces' },
  ],
  tasks: [
    { key: 'tasks:list_assignees', label: 'List task assignees & mentions', description: 'Load the staff list for task assignee dropdowns and @mentions' },
    { key: 'tasks:mention_colleagues', label: 'Mention colleagues on tasks', description: 'Load teammates for @mentions in Tasks → Activity and post comments that notify mentioned users' },
  ],
};

/** Default grants when a manager has no custom permissions saved. */
export const DEFAULT_MANAGER_PERMISSIONS: string[] = [
  'dashboard:view',
  'content:list', 'content:view', 'content:create', 'content:update', 'content:delete',
  'services:list', 'services:view', 'services:create', 'services:update', 'services:delete',
  'team:list', 'team:view', 'team:create', 'team:update', 'team:delete',
  'reviews:list', 'reviews:view', 'reviews:update', 'reviews:delete',
  'contacts:list', 'contacts:view', 'contacts:delete',
  'orders:list', 'orders:view', 'orders:update', 'orders:delete',
  'settings:view', 'settings:update',
  'marketing:view', 'marketing:update',
  'crm:view', 'crm:manage',
  'hr:view', 'hr:manage', 'contracts:manage',
  'finance:view', 'finance:manage',
  'support:view', 'support:manage',
  'communication:view', 'communication:manage',
  'tasks:list_assignees', 'tasks:mention_colleagues',
  'users:list', 'users:view', 'users:create', 'users:update',
];

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: Object.values(AVAILABLE_PERMISSIONS).flatMap((g) => g.map((p) => p.key)),
  manager: [...DEFAULT_MANAGER_PERMISSIONS],
  employee: [
    'dashboard:view',
    'hr:timeclock',
    'hr:schedule_view',
    'hr:timeoff_request',
    'hr:announcements_view',
    'contacts:list',
    'contacts:view',
    'orders:list',
    'orders:view',
    'content:list',
    'content:view',
    'team:list',
    'team:view',
    'services:list',
    'services:view',
    'tasks:list_assignees',
    'tasks:mention_colleagues',
    'communication:view',
  ],
  customer: [],
  agent: [
    'dashboard:view',
    'contacts:list',
    'contacts:view',
    'tasks:list_assignees',
    'tasks:mention_colleagues',
  ],
  user: [],
};

export const ROLE_TOKENS = ['admin', 'manager', 'customer', 'employee', 'agent'];

export const TASK_STAFF_TEMPLATE_KEYS = [
  'tasks:list_assignees',
  'tasks:mention_colleagues',
];

/**
 * Nest controller class → permissions (any-of) required for managers.
 * Admins bypass. Controllers omitted here are not ACL-gated beyond @Roles.
 */
export const CONTROLLER_PERMISSIONS: Record<string, string[]> = {
  AdminController: ['dashboard:view'],
  AnalyticsController: ['dashboard:view'],

  // CRM
  CompaniesController: ['crm:view', 'crm:manage'],
  DealsController: ['crm:view', 'crm:manage'],
  PipelinesController: ['crm:view', 'crm:manage'],
  ProjectsController: ['crm:view', 'crm:manage'],
  ProjectsLegacyController: ['crm:view', 'crm:manage'],
  ProjectsNewController: ['crm:view', 'crm:manage'],
  CrmProjectsController: ['crm:view', 'crm:manage'],
  CrmController: ['crm:view', 'crm:manage'],
  ActivitiesController: ['crm:view', 'crm:manage'],
  NotesController: ['crm:view', 'crm:manage'],
  ReportsController: ['crm:view', 'crm:manage'],
  AutomationsController: ['crm:view', 'crm:manage'],
  IntegrationsController: ['crm:view', 'crm:manage'],
  ProjectLifecycleController: ['crm:view', 'crm:manage'],
  TasksController: ['crm:view', 'crm:manage', 'tasks:list_assignees'],
  AdminContactsController: ['crm:view', 'crm:manage', 'contacts:list', 'contacts:view'],
  LeadsController: ['crm:view', 'crm:manage', 'contacts:list', 'contacts:view'],
  ContactsController: ['contacts:list', 'contacts:view', 'contacts:delete', 'crm:view', 'crm:manage'],
  // Note: CRM also exports a UsersController / InvoicesController with the same class names;
  // users:* and finance:* covers both settings and CRM variants.

  // Finance
  InvoicesController: ['finance:view', 'finance:manage', 'orders:list', 'orders:view'],
  PaymentsController: ['finance:view', 'finance:manage'],
  ExpensesController: ['finance:view', 'finance:manage'],
  StaffAdvancesController: ['finance:view', 'finance:manage'],

  // HR
  EmployeesController: ['hr:view', 'hr:manage'],
  TimesheetsController: ['hr:view', 'hr:manage'],
  PayslipsController: ['hr:view', 'hr:manage'],
  TimeOffController: ['hr:view', 'hr:manage'],
  AnnouncementsController: ['hr:view', 'hr:manage'],
  RemindersController: ['hr:view', 'hr:manage'],
  PublicHolidaysController: ['hr:view', 'hr:manage'],
  KpiController: ['hr:view', 'hr:manage'],
  ShiftsController: ['hr:view', 'hr:manage'],
  HrController: ['hr:view', 'hr:manage'],
  HrFormsController: ['hr:view', 'hr:manage'],
  HrContractsController: ['contracts:manage', 'hr:manage'],
  DepartmentsController: ['hr:view', 'hr:manage'],

  // Support
  TicketsController: ['support:view', 'support:manage'],
  TicketsAdvancedController: ['support:view', 'support:manage'],
  TicketAutomationController: ['support:manage'],

  // Content / marketing site CMS
  BlogController: ['content:list', 'content:view', 'content:create', 'content:update', 'content:delete'],
  PortfolioController: ['content:list', 'content:view', 'content:create', 'content:update', 'content:delete'],
  MarketingController: ['marketing:view', 'marketing:update', 'content:list'],
  ReviewsController: ['reviews:list', 'reviews:view', 'reviews:update', 'reviews:delete'],
  ReviewsAdminController: ['reviews:list', 'reviews:view', 'reviews:update', 'reviews:delete'],
  ReviewsAdminLegacyController: ['reviews:list', 'reviews:view', 'reviews:update', 'reviews:delete'],
  ServicesController: ['services:list', 'services:view', 'services:create', 'services:update', 'services:delete'],
  TeamController: ['team:list', 'team:view', 'team:create', 'team:update', 'team:delete'],
  PublicContentController: ['settings:view', 'marketing:view'],

  // Communication
  MailController: ['communication:view', 'communication:manage'],
  ChatController: ['communication:view', 'communication:manage'],
  MessagesController: ['communication:view', 'communication:manage'],

  // Settings / admin tooling
  UsersController: ['users:list', 'users:view', 'users:create', 'users:update', 'users:delete', 'crm:view', 'crm:manage'],
  SettingsController: ['settings:view', 'settings:update'],
  AuditLogsController: ['settings:view'],
  PdfTemplatesController: ['settings:view', 'settings:update'],
  CredentialsController: ['settings:view', 'settings:update'],
  ClickdeployController: ['settings:update'],
  BugReportsController: ['settings:view'],
  DocumentsController: ['settings:view', 'content:view'],
  ServiceTokensController: ['settings:update'],
  WorkersController: ['settings:update'],
  VerifyController: ['settings:view'],
  UploadController: ['content:create', 'content:update', 'crm:manage', 'settings:update'],
  NotificationsController: ['dashboard:view'],
  TimeClockController: ['hr:view', 'hr:manage'],
};
