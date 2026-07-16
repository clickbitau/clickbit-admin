import { Controller, Get, Head, Param, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { VerifyService } from './verify.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('verify')
export class VerifyController {
  constructor(private readonly verifyService: VerifyService) {}

  @Get(':code')
  async verify(@Param('code') code: string, @Req() req: Request) {
    const clientIp = String(req.headers['x-forwarded-for'] || '').split(',')[0] || req.ip;
    return this.verifyService.verify(code, clientIp);
  }

  @Head(':code')
  async exists(@Param('code') code: string, @Res() res: Response) {
    const found = await this.verifyService.exists(code);
    return res.status(found ? 200 : 404).end();
  }

  @Get('admin/stats')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  async stats() {
    return this.verifyService.stats();
  }
}
