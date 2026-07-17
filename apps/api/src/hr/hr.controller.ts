import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RequestWithUser } from '../types/request-with-user';
import { EmployeesService } from './employees.service';
import { setNoCache } from './hr-utils';

@Controller('hr')
@UseGuards(SupabaseAuthGuard, RolesGuard)
export class HrController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get('dashboard')
  @Roles('admin', 'manager')
  async dashboard(@Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.employeesService.getDashboardStats(req.user));
  }

  @Get('stats')
  @Roles('admin', 'manager', 'hr')
  async stats(@Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.employeesService.getStats(req.user));
  }

  @Get('employee-dashboard')
  async employeeDashboard(@Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.employeesService.getEmployeeDashboard(req.user));
  }
}
