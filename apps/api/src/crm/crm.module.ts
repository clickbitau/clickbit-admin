import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { GeneratedCrmService } from './generated-crm.service';
import { ContactsController } from './contacts.controller';
import { DealsController } from './deals.controller';
import { PipelinesController } from './pipelines.controller';
import { LeadsController } from './leads.controller';
import { ProjectsNewController } from './projects_new.controller';
import { ActivitiesController } from './activities.controller';
import { NotesController } from './notes.controller';
import { AutomationsController } from './automations.controller';

@Module({
  imports: [AuthModule],
  controllers: [
    CompaniesController,
    ContactsController,
    DealsController,
    PipelinesController,
    LeadsController,
    ProjectsNewController,
    ActivitiesController,
    NotesController,
    AutomationsController,
  ],
  providers: [CompaniesService, GeneratedCrmService],
})
export class CrmModule {}
