import { Response } from 'express';

import { LeadsService } from '../src/crm/leads.service';
import { ProjectsService } from '../src/crm/projects.service';
import { ActivitiesService } from '../src/crm/activities.service';
import { NotesService } from '../src/crm/notes.service';
import { AutomationsService } from '../src/crm/automations.service';
import { AdminContactsController } from '../src/crm/admin-contacts.controller';
import { TasksController } from '../src/crm/tasks.controller';

describe('CRM backend endpoint contracts', () => {
  const resMock = { set: jest.fn() } as unknown as Response;

  describe('Leads endpoints (LeadsService)', () => {
    const leadRow = {
      id: 1,
      lead_number: 'LEAD-000001',
      name: 'Test Lead',
      email: 'lead@example.com',
      phone: null,
      company_name: null,
      job_title: null,
      website: null,
      description: null,
      requirements: null,
      pipeline_id: 1,
      stage_id: 1,
      position: 0,
      owner_id: null,
      contact_id: null,
      company_id: null,
      converted_contact_id: null,
      estimated_value: 0,
      currency: 'AUD',
      probability: 20,
      lead_score: 50,
      lead_source: null,
      priority: 'medium',
      status: 'open',
      won_reason: null,
      lost_reason: null,
      competitor: null,
      expected_close_date: null,
      last_activity_at: null,
      custom_fields: {},
      tags: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    };

    const buildPrisma = () => ({
      crm_leads: {
        findMany: jest.fn().mockResolvedValue([leadRow]),
        count: jest.fn().mockResolvedValue(1),
        findUnique: jest.fn().mockResolvedValue(leadRow),
      },
      crm_pipeline_stages: {
        findUnique: jest.fn().mockResolvedValue({ id: 1, pipeline_id: 1, name: 'New', probability: 20 }),
      },
      profiles: { findUnique: jest.fn().mockResolvedValue(null) },
      companies: { findUnique: jest.fn().mockResolvedValue(null) },
      contacts: { findUnique: jest.fn().mockResolvedValue(null) },
    });

    it('GET /api/crm/leads returns { leads, pagination }', async () => {
      const service = new LeadsService(buildPrisma() as any);
      const result = await service.findAll({}) as any;
      expect(result).toHaveProperty('leads');
      expect(result).toHaveProperty('pagination');
      expect(Array.isArray(result.leads)).toBe(true);
      expect(result.pagination).toMatchObject({
        currentPage: 1,
        totalPages: 1,
        totalItems: 1,
        itemsPerPage: 50,
      });
    });

    it('GET /api/crm/leads/:id returns { lead }', async () => {
      const service = new LeadsService(buildPrisma() as any);
      const result = await service.findOne(1);
      expect(result).toHaveProperty('lead');
      expect(result.lead).toMatchObject({ id: 1, name: 'Test Lead' });
    });
  });

  describe('Projects endpoints (ProjectsService)', () => {
    const projectRow = {
      id: 42,
      project_number: 'PROJ-000042',
      name: 'Test Project',
      description: null,
      status: 'in_progress',
      priority: 'medium',
      budget: 1000,
      currency: 'AUD',
      start_date: null,
      due_date: null,
      customer_id: null,
      company_id: 2,
      deal_id: null,
      manager_id: 5,
      created_by: 5,
      project_type: null,
      customer_visible: true,
      custom_fields: {},
      tags: [],
      support_period_type: null,
      support_start_date: null,
      support_end_date: null,
      support_price: null,
      support_currency: 'AUD',
      support_notes: null,
      hourly_rate: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      companies: { id: 2, name: 'Acme', logo_url: null },
      contacts: null,
      deals: null,
      profiles_crm_projects_manager_idToprofiles: { id: 5, first_name: 'Max', last_name: 'Manager' },
    };

    const buildPrisma = () => ({
      crm_projects: {
        findMany: jest.fn().mockResolvedValue([projectRow]),
        count: jest.fn().mockResolvedValue(1),
        findUnique: jest.fn().mockResolvedValue(projectRow),
        groupBy: jest.fn().mockResolvedValue([{ status: 'in_progress', _count: { status: 1 } }]),
      },
      project_tasks: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        groupBy: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn().mockResolvedValue({ _sum: { estimated_hours: 0, actual_hours: 0 } }),
      },
    });

    it('GET /api/crm/projects-new returns { projects, pagination, stats }', async () => {
      const service = new ProjectsService(buildPrisma() as any);
      const result = await service.findAll({}) as any;
      expect(result).toHaveProperty('projects');
      expect(result).toHaveProperty('pagination');
      expect(result).toHaveProperty('stats');
      expect(Array.isArray(result.projects)).toBe(true);
      expect(result.projects[0]).toMatchObject({ id: 42, name: 'Test Project' });
      expect(result.projects[0]).toHaveProperty('manager');
      expect(result.projects[0]).toHaveProperty('company');
      expect(result.stats).toMatchObject({ total: 1, inProgress: 1 });
    });

    it('GET /api/crm/projects-new/:id returns { project }', async () => {
      const service = new ProjectsService(buildPrisma() as any);
      const result = await service.findOne(42);
      expect(result).toHaveProperty('project');
      expect(result.project).toMatchObject({ id: 42, name: 'Test Project' });
    });

    it('GET /api/crm/projects-new/:id/tasks returns { tasks, stats, pagination }', async () => {
      const taskRow = {
        id: 10,
        crm_project_id: 42,
        title: 'Task one',
        status: 'todo',
        priority: 'medium',
        estimated_hours: 2,
        actual_hours: 0,
        created_at: new Date().toISOString(),
        crm_projects: { id: 42, project_number: 'PROJ-000042', name: 'Test Project' },
        profiles_project_tasks_assigned_toToprofiles: { id: 3, email: 'a@e.com', first_name: 'A', last_name: 'B', avatar: null, role: 'employee' },
        profiles_project_tasks_created_byToprofiles: { id: 3, email: 'a@e.com', first_name: 'A', last_name: 'B', avatar: null, role: 'employee' },
        contacts: null,
      };
      const prisma = buildPrisma();
      prisma.crm_projects.findUnique = jest.fn().mockResolvedValue(projectRow);
      prisma.project_tasks.findMany = jest.fn().mockResolvedValue([taskRow]);
      prisma.project_tasks.count = jest.fn().mockResolvedValue(1);
      prisma.project_tasks.groupBy = jest.fn().mockResolvedValue([
        { status: 'todo', _count: { status: 1 }, _sum: { estimated_hours: 2, actual_hours: 0 } },
      ]);

      const service = new ProjectsService(prisma as any);
      const result = await service.getTasks(42, 1, 50);
      expect(result).toHaveProperty('tasks');
      expect(result).toHaveProperty('stats');
      expect(result).toHaveProperty('pagination');
      expect(Array.isArray(result.tasks)).toBe(true);
      expect(result.tasks[0]).toHaveProperty('assignee');
      expect(result.stats).toMatchObject({ total: 1, todo: 1, totalEstimatedHours: 2 });
    });
  });

  describe('Activities endpoints (ActivitiesService)', () => {
    const activityRow = {
      id: 4,
      activity_type: 'task',
      subject: 'Follow up',
      description: null,
      status: 'planned',
      priority: 'medium',
      due_date: null,
      duration_minutes: null,
      contact_id: null,
      company_id: null,
      deal_id: null,
      owner_id: 5,
      assigned_to: null,
      created_by: 5,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      profiles_crm_activities_owner_idToprofiles: { id: 5, first_name: 'O', last_name: 'Owner' },
      profiles_crm_activities_assigned_toToprofiles: null,
    };

    const buildPrisma = () => ({
      crm_activities: {
        findMany: jest.fn().mockResolvedValue([activityRow]),
        count: jest.fn().mockResolvedValue(1),
        findUnique: jest.fn().mockResolvedValue(activityRow),
      },
    });

    it('GET /api/crm/activities returns { activities, pagination }', async () => {
      const service = new ActivitiesService(buildPrisma() as any);
      const result = await service.findAll({}) as any;
      expect(result).toHaveProperty('activities');
      expect(result).toHaveProperty('pagination');
      expect(Array.isArray(result.activities)).toBe(true);
      expect(result.activities[0]).toMatchObject({ id: 4, subject: 'Follow up' });
    });

    it('GET /api/crm/activities/:id returns { activity }', async () => {
      const service = new ActivitiesService(buildPrisma() as any);
      const result = await service.findOne(4);
      expect(result).toHaveProperty('activity');
      expect(result.activity).toMatchObject({ id: 4, subject: 'Follow up' });
    });
  });

  describe('Notes endpoints (NotesService)', () => {
    const noteRow = {
      id: 7,
      content: 'Important note',
      note_type: 'general',
      contact_id: null,
      company_id: null,
      deal_id: null,
      activity_id: null,
      created_by: 5,
      is_pinned: false,
      is_private: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      profiles: { id: 5, first_name: 'O', last_name: 'Owner' },
    };

    const buildPrisma = () => ({
      crm_notes: {
        findMany: jest.fn().mockResolvedValue([noteRow]),
        count: jest.fn().mockResolvedValue(1),
        findUnique: jest.fn().mockResolvedValue(noteRow),
      },
    });

    it('GET /api/crm/notes returns { notes, pagination }', async () => {
      const service = new NotesService(buildPrisma() as any);
      const result = await service.findAll({}) as any;
      expect(result).toHaveProperty('notes');
      expect(result).toHaveProperty('pagination');
      expect(Array.isArray(result.notes)).toBe(true);
      expect(result.notes[0]).toMatchObject({ id: 7, content: 'Important note' });
    });

    it('GET /api/crm/notes/:id returns { note }', async () => {
      const service = new NotesService(buildPrisma() as any);
      const result = await service.findOne(7);
      expect(result).toHaveProperty('note');
      expect(result.note).toMatchObject({ id: 7, content: 'Important note' });
    });
  });

  describe('Automations endpoints (AutomationsService)', () => {
    const automationRow = {
      id: 3,
      name: 'Welcome email',
      description: null,
      trigger_type: 'contact_created',
      trigger_conditions: {},
      action_type: 'send_email',
      action_config: {},
      target_entity: 'contact',
      delay_minutes: 0,
      is_active: true,
      created_by: 5,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const buildPrisma = () => ({
      crm_automations: {
        findMany: jest.fn().mockResolvedValue([automationRow]),
        count: jest.fn().mockResolvedValue(1),
        findUnique: jest.fn().mockResolvedValue(automationRow),
      },
    });

    it('GET /api/crm/automations returns { automations, pagination }', async () => {
      const service = new AutomationsService(buildPrisma() as any);
      const result = await service.findAll({}) as any;
      expect(result).toHaveProperty('automations');
      expect(result).toHaveProperty('pagination');
      expect(Array.isArray(result.automations)).toBe(true);
      expect(result.automations[0]).toMatchObject({ id: 3, name: 'Welcome email' });
    });

    it('GET /api/crm/automations/:id returns { automation }', async () => {
      const service = new AutomationsService(buildPrisma() as any);
      const result = await service.findOne(3);
      expect(result).toHaveProperty('automation');
      expect(result.automation).toMatchObject({ id: 3, name: 'Welcome email' });
    });
  });

  describe('Admin contacts endpoints (AdminContactsController)', () => {
    const contactRow = {
      id: 76,
      name: 'Jane Client',
      email: 'jane@example.com',
      phone: null,
      lifecycle_stage: 'customer',
      lead_status: 'active',
      total_revenue: 1000,
      lead_score: 50,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      companies_contacts_company_idTocompanies: { id: 2, name: 'Acme Inc' },
      profiles: { id: 5, first_name: 'Owner', last_name: 'One', email: 'owner@example.com' },
    };

    const buildPrisma = () => ({
      contacts: {
        findMany: jest.fn().mockResolvedValue([contactRow]),
        count: jest.fn().mockResolvedValue(1),
        aggregate: jest.fn().mockResolvedValue({ _sum: { total_revenue: 1000 } }),
        update: jest.fn().mockResolvedValue({}),
      },
      companies: {
        findMany: jest.fn().mockResolvedValue([{ id: 2, name: 'Acme Inc' }]),
      },
    });

    it('GET /api/admin/contacts returns { contacts, pagination }', async () => {
      const controller = new AdminContactsController(buildPrisma() as any);
      const result = await controller.findAll({}, resMock);
      expect(result).toHaveProperty('contacts');
      expect(result).toHaveProperty('pagination');
      expect(Array.isArray(result.contacts)).toBe(true);
      expect(result.contacts[0]).toHaveProperty('owner');
      expect(result.contacts[0]).toHaveProperty('company');
    });

    it('GET /api/admin/contacts/customer-stats returns stats object', async () => {
      const controller = new AdminContactsController(buildPrisma() as any);
      const result = await controller.customerStats(resMock);
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('totalRevenue');
      expect(result).toHaveProperty('avgRevenue');
      expect(result).toHaveProperty('newThisMonth');
      expect(result).toHaveProperty('activeCustomers');
    });

    it('GET /api/admin/contacts/agents returns { success, data }', async () => {
      const controller = new AdminContactsController(buildPrisma() as any);
      const result = await controller.agents(resMock);
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('data');
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('GET /api/admin/contacts/:id/clients returns { success, data }', async () => {
      const controller = new AdminContactsController(buildPrisma() as any);
      const result = await controller.clients(76, resMock);
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('data');
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('PUT /api/admin/contacts/:id/commission returns { success, data }', async () => {
      const controller = new AdminContactsController(buildPrisma() as any);
      const result = await controller.updateCommission(76, { commission_type: 'percentage', commission_rate: 10 }, resMock);
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('data');
      expect(result.data).toMatchObject({ commission_type: 'percentage', commission_rate: 10 });
    });
  });

  describe('Tasks endpoints (TasksController)', () => {
    const taskRow = {
      id: 9,
      crm_project_id: 42,
      title: 'Build API',
      description: null,
      status: 'in_progress',
      priority: 'high',
      assigned_to: 3,
      created_by: 3,
      estimated_hours: 4,
      actual_hours: 1,
      due_date: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      crm_projects: { id: 42, project_number: 'PROJ-000042', name: 'Test Project' },
      profiles_project_tasks_assigned_toToprofiles: { id: 3, email: 'dev@example.com', first_name: 'Dev', last_name: 'One', avatar: null, role: 'employee' },
      profiles_project_tasks_created_byToprofiles: { id: 3, email: 'dev@example.com', first_name: 'Dev', last_name: 'One', avatar: null, role: 'employee' },
      contacts: null,
    };

    const buildPrisma = () => ({
      project_tasks: {
        findMany: jest.fn().mockResolvedValue([taskRow]),
        count: jest.fn().mockResolvedValue(1),
        groupBy: jest.fn().mockResolvedValue([{ status: 'in_progress', _count: { status: 1 } }]),
        aggregate: jest.fn().mockResolvedValue({ _sum: { estimated_hours: 4, actual_hours: 1 } }),
        update: jest.fn().mockResolvedValue({ ...taskRow, status: 'completed' }),
      },
      profiles: {
        findMany: jest.fn().mockResolvedValue([{ id: 3, email: 'dev@example.com', first_name: 'Dev', last_name: 'One', avatar: null, role: 'employee', status: 'active' }]),
      },
    });

    it('GET /api/tasks returns { data, stats, pagination }', async () => {
      const controller = new TasksController(buildPrisma() as any);
      const result = await controller.findAll({}, resMock);
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('stats');
      expect(result).toHaveProperty('pagination');
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data[0]).toHaveProperty('assignee');
      expect(result.data[0]).toHaveProperty('project');
      expect(result.stats).toMatchObject({ total: 1, in_progress: 1 });
    });

    it('PATCH /api/projects/tasks/:id/status returns { data }', async () => {
      const controller = new TasksController(buildPrisma() as any);
      const result = await controller.updateStatus(9, { status: 'completed', actual_hours: 2 }, resMock);
      expect(result).toHaveProperty('data');
      expect(result.data).toMatchObject({ status: 'completed' });
    });

    it('GET /api/projects/tasks/assignees returns { success, data }', async () => {
      const controller = new TasksController(buildPrisma() as any);
      const result = await controller.assignees(resMock);
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('data');
      expect(Array.isArray(result.data)).toBe(true);
    });
  });
});
