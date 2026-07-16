import { Module } from '@nestjs/common';
import { HrFormsController } from './hr-forms.controller';
import { HrFormsService } from './hr-forms.service';

@Module({
  controllers: [HrFormsController],
  providers: [HrFormsService],
})
export class HrFormsModule {}
