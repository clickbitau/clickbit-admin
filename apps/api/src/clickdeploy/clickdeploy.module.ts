import { Module } from '@nestjs/common';
import { ClickdeployController } from './clickdeploy.controller';
import { ClickdeployService } from './clickdeploy.service';

@Module({
  controllers: [ClickdeployController],
  providers: [ClickdeployService],
})
export class ClickdeployModule {}
