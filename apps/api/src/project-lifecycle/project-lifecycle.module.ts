import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProjectLifecycleService } from './project-lifecycle.service';
import { ProjectLifecycleController } from './project-lifecycle.controller';

@Module({
  imports: [AuthModule],
  controllers: [ProjectLifecycleController],
  providers: [ProjectLifecycleService],
})
export class ProjectLifecycleModule {}
