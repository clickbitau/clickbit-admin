import { Controller, Get, Query, UseGuards, Res } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { setNoCache } from './crm-utils';

@Controller('users')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('admin', 'manager')
export class UsersController {
  constructor(private prisma: PrismaService) {}

  @Get('team')
  async team(
    @Query('search') search: string,
    @Query('role') role: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    setNoCache(res);
    const where: { [key: string]: unknown } = {};
    if (role) where.role = role;
    if (search) {
      (where as { OR: unknown[] }).OR = [
        { first_name: { contains: search, mode: 'insensitive' } },
        { last_name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    const users = await this.prisma.profiles.findMany({
      where,
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        role: true,
        status: true,
        avatar: true,
        created_at: true,
      },
      orderBy: { first_name: 'asc' },
    });

    return users.map((u) => ({
      ...u,
      name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email,
      avatar: u.avatar,
    }));
  }
}
