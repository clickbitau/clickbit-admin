import { Module } from '@nestjs/common';
import { BugReportsController } from './bug-reports.controller';
import { BugReportsService } from './bug-reports.service';
import { DevinService } from './devin.service';
import { GithubService } from './github.service';
import { BugFixPipelineService } from './bug-fix-pipeline.service';

@Module({
  controllers: [BugReportsController],
  providers: [BugReportsService, DevinService, GithubService, BugFixPipelineService],
})
export class BugReportsModule {}
