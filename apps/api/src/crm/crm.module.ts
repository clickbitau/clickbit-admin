import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';
import { PipelinesController } from './pipelines.controller';
import { PipelinesService } from './pipelines.service';
import { DealsController } from './deals.controller';
import { DealsService } from './deals.service';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { ActivitiesController } from './activities.controller';
import { ActivitiesService } from './activities.service';
import { NotesController } from './notes.controller';
import { NotesService } from './notes.service';
import { AutomationsController } from './automations.controller';
import { AutomationsService } from './automations.service';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { InvoicesController } from './invoices.controller';
import { CrmProjectsController } from './crm-projects.controller';
import { UsersController } from './users.controller';
import { AdminContactsController } from './admin-contacts.controller';
import { TasksController } from './tasks.controller';

@Module({
  imports: [AuthModule],
  controllers: [
    CompaniesController,
    ContactsController,
    PipelinesController,
    DealsController,
    LeadsController,
    ProjectsController,
    ActivitiesController,
    NotesController,
    AutomationsController,
    ReportsController,
    IntegrationsController,
    InvoicesController,
    CrmProjectsController,
    UsersController,
    AdminContactsController,
    TasksController,
  ],
  providers: [
    CompaniesService,
    ContactsService,
    PipelinesService,
    DealsService,
    LeadsService,
    ProjectsService,
    ActivitiesService,
    NotesService,
    AutomationsService,
    ReportsService,
    IntegrationsService,
  ],
})
export class CrmModule {}
