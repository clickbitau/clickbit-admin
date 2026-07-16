import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
  ParseIntPipe,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RequestWithUser } from '../types/request-with-user';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto, GetListQueryDto, UpdateEmployeeDto } from './dto/hr.dto';
import { setNoCache } from './hr-utils';

@Controller('hr/employees')
@UseGuards(SupabaseAuthGuard, RolesGuard)
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  async findAll(@Query() query: GetListQueryDto, @Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.employeesService.findAll(query, req.user));
  }

  @Get('me')
  async findMe(@Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.employeesService.findMe(req.user));
  }

  @Get('sync')
  @Roles('admin')
  async sync(@Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.employeesService.sync(req.user));
  }

  @Get(':id/documents')
  async getDocuments(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ) {
    setNoCache(res);
    return res.json(await this.employeesService.getDocuments(id, req.user));
  }

  @Delete(':employeeId/documents/:docId')
  @Roles('admin')
  async deleteDocument(
    @Param('employeeId', ParseIntPipe) employeeId: number,
    @Param('docId', ParseIntPipe) docId: number,
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ) {
    setNoCache(res);
    return res.json(await this.employeesService.deleteDocument(employeeId, docId, req.user));
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.employeesService.findOne(id, req.user));
  }

  @Post()
  @Roles('admin', 'manager')
  async create(@Body() dto: CreateEmployeeDto, @Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    const result = await this.employeesService.create(dto as unknown as Record<string, unknown>, req.user);
    return res.status(HttpStatus.CREATED).json(result);
  }

  @Put(':id')
  @Roles('admin', 'manager')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEmployeeDto,
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ) {
    setNoCache(res);
    return res.json(await this.employeesService.update(id, dto as unknown as Record<string, unknown>, req.user));
  }

  @Post('sync')
  @Roles('admin')
  async syncPost(@Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.employeesService.sync(req.user));
  }

  @Delete(':id')
  @Roles('admin')
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.employeesService.remove(id, req.user));
  }
}
