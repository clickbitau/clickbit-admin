import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, Res, UseGuards, ParseIntPipe, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { RequestWithUser } from '../types/request-with-user';
import { PublicHolidaysService } from './public-holidays.service';
import { CreatePublicHolidayDto, GetListQueryDto, ImportPublicHolidaysDto, UpdatePublicHolidayDto } from './dto/hr.dto';
import { setNoCache } from './hr-utils';

@Controller('hr/public-holidays')
@UseGuards(SupabaseAuthGuard, RolesGuard)
export class PublicHolidaysController {
  constructor(private readonly publicHolidaysService: PublicHolidaysService) {}

  @Get()
  async findAll(@Query() query: GetListQueryDto, @Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.publicHolidaysService.findAll(query, req.user));
  }

  @Post('import')
  @Roles('admin', 'manager')
  async import(@Body() dto: ImportPublicHolidaysDto, @Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.publicHolidaysService.import(dto, req.user));
  }

  @Post()
  @Roles('admin', 'manager')
  async create(@Body() dto: CreatePublicHolidayDto, @Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    const result = await this.publicHolidaysService.create(dto as unknown as Record<string, unknown>, req.user);
    return res.status(HttpStatus.CREATED).json(result);
  }

  @Put(':id')
  @Roles('admin', 'manager')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePublicHolidayDto,
    @Req() req: RequestWithUser,
    @Res() res: Response,
  ) {
    setNoCache(res);
    return res.json(await this.publicHolidaysService.update(id, dto as unknown as Record<string, unknown>, req.user));
  }

  @Delete(':id')
  @Roles('admin', 'manager')
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: RequestWithUser, @Res() res: Response) {
    setNoCache(res);
    return res.json(await this.publicHolidaysService.remove(id, req.user));
  }
}
