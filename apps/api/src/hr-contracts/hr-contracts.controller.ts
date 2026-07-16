import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RequestWithUser } from '../types/request-with-user';
import { HrContractsService } from './hr-contracts.service';
import { CreateContractDto, UpdateContractDto, ListContractsQueryDto, TerminateContractDto } from './dto/hr-contracts.dto';

@Controller('hr/contracts')
@UseGuards(SupabaseAuthGuard)
export class HrContractsController {
  constructor(private readonly hrContractsService: HrContractsService) {}

  @Get()
  findAll(@Req() req: RequestWithUser, @Query() query: ListContractsQueryDto) {
    return this.hrContractsService.findAll(req.user, query as Record<string, unknown>);
  }

  @Get('coi-blocked')
  getBlockedEmployeeIds(@Req() req: RequestWithUser) {
    return this.hrContractsService.findBlockedEmployeeIds(req.user);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'contracts:manage')
  create(@Req() req: RequestWithUser, @Body() dto: CreateContractDto) {
    return this.hrContractsService.create(req.user, dto);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'contracts:manage')
  update(
    @Req() req: RequestWithUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateContractDto,
  ) {
    return this.hrContractsService.update(req.user, id, dto);
  }

  @Post(':id/accept')
  accept(@Req() req: RequestWithUser, @Param('id', ParseIntPipe) id: number) {
    return this.hrContractsService.accept(req.user, id);
  }

  @Post(':id/activate')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'contracts:manage')
  activate(@Req() req: RequestWithUser, @Param('id', ParseIntPipe) id: number) {
    return this.hrContractsService.activate(req.user, id);
  }

  @Post(':id/terminate')
  @UseGuards(RolesGuard)
  @Roles('admin', 'manager', 'contracts:manage')
  terminate(
    @Req() req: RequestWithUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: TerminateContractDto,
  ) {
    return this.hrContractsService.terminate(req.user, id, dto.reason);
  }

  @Get(':id/pdf')
  downloadPdf(@Req() req: RequestWithUser, @Param('id', ParseIntPipe) id: number) {
    return this.hrContractsService.downloadPdf(req.user, id);
  }
}
