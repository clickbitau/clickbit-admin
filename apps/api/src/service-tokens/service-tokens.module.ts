import { Module } from '@nestjs/common';
import { ServiceTokensController } from './service-tokens.controller';
import { ServiceTokensService } from './service-tokens.service';

@Module({
  controllers: [ServiceTokensController],
  providers: [ServiceTokensService],
})
export class ServiceTokensModule {}
