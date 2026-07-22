import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { MailService } from './mail.service';
import { MailAccountDto, UpdateMailAccountDto, SendMailDto, MailTemplateDto } from './dto/communication.dto';

@Controller('mail')
@UseGuards(SupabaseAuthGuard, RolesGuard)
export class MailController {
  constructor(private readonly mailService: MailService) {}

  @Get('presets')
  getPresets() {
    return this.mailService.getPresets();
  }

  @Get('accounts')
  listAccounts(@Req() req: any) {
    return this.mailService.listAccounts(req.user);
  }

  @Post('accounts')
  createAccount(@Req() req: any, @Body() dto: MailAccountDto) {
    return this.mailService.createAccount(req.user, dto as unknown as Record<string, unknown>);
  }

  @Put('accounts/:id')
  updateAccount(@Param('id') id: string, @Req() req: any, @Body() dto: UpdateMailAccountDto) {
    return this.mailService.updateAccount(req.user, id, dto as unknown as Record<string, unknown>);
  }

  @Delete('accounts/:id')
  deleteAccount(@Param('id') id: string, @Req() req: any) {
    return this.mailService.deleteAccount(req.user, id);
  }

  @Post('accounts/:id/test')
  testAccount(@Param('id') id: string, @Req() req: any) {
    return this.mailService.testAccount(req.user, id);
  }

  @Get('accounts/:accountId/folders')
  listFolders(@Param('accountId') accountId: string, @Req() req: any) {
    return this.mailService.listFolders(req.user, accountId);
  }

  @Get('accounts/:accountId/folders/:folderPath/messages')
  listMessages(@Param('accountId') accountId: string, @Param('folderPath') folderPath: string, @Req() req: any, @Query() query: Record<string, unknown>) {
    return this.mailService.listMessages(req.user, accountId, folderPath, query);
  }

  @Get('accounts/:accountId/folders/:folderPath/messages/:uid')
  getMessage(@Param('accountId') accountId: string, @Param('folderPath') folderPath: string, @Param('uid') uid: string, @Req() req: any) {
    return this.mailService.getMessage(req.user, accountId, folderPath, uid);
  }

  @Post('accounts/:accountId/send')
  send(@Param('accountId') accountId: string, @Req() req: any, @Body() dto: SendMailDto) {
    return this.mailService.send(req.user, accountId, dto as unknown as Record<string, unknown>);
  }

  @Get('templates')
  listTemplates(@Req() req: any) {
    return this.mailService.listTemplates(req.user);
  }

  @Post('templates')
  createTemplate(@Req() req: any, @Body() dto: MailTemplateDto) {
    return this.mailService.createTemplate(req.user, dto as unknown as Record<string, unknown>);
  }

  @Put('templates/:id')
  updateTemplate(@Param('id') id: string, @Req() req: any, @Body() dto: MailTemplateDto) {
    return this.mailService.updateTemplate(req.user, id, dto as unknown as Record<string, unknown>);
  }

  @Delete('templates/:id')
  deleteTemplate(@Param('id') id: string, @Req() req: any) {
    return this.mailService.deleteTemplate(req.user, id);
  }

  @Get('accounts/:id/signature')
  getSignature(@Param('id') id: string, @Req() req: any) {
    return this.mailService.getSignature(req.user, id);
  }

  @Put('accounts/:id/signature')
  updateSignature(@Param('id') id: string, @Req() req: any, @Body() dto: any) {
    return this.mailService.updateSignature(req.user, id, dto as Record<string, unknown>);
  }

  @Get('accounts/:id/aliases')
  getAliases(@Param('id') id: string, @Req() req: any) {
    return this.mailService.getAliases(req.user, id);
  }

  @Put('accounts/:id/aliases')
  updateAliases(@Param('id') id: string, @Req() req: any, @Body() dto: any) {
    return this.mailService.updateAliases(req.user, id, dto as Record<string, unknown>);
  }

  // Folders
  @Post('accounts/:accountId/folders')
  createFolder(@Param('accountId') accountId: string, @Body() dto: { name?: string }, @Req() req: any) {
    return this.mailService.createFolder(req.user, accountId, dto.name || '');
  }

  @Put('accounts/:accountId/folders/:folderPath')
  updateFolder(@Param('accountId') accountId: string, @Param('folderPath') folderPath: string, @Body() dto: any, @Req() req: any) {
    return this.mailService.updateFolder(req.user, accountId, folderPath, dto);
  }

  @Delete('accounts/:accountId/folders/:folderPath')
  deleteFolder(@Param('accountId') accountId: string, @Param('folderPath') folderPath: string, @Req() req: any) {
    return this.mailService.deleteFolder(req.user, accountId, folderPath);
  }

  @Post('accounts/:accountId/folders/:folderPath/sync')
  syncFolder(@Param('accountId') accountId: string, @Param('folderPath') folderPath: string, @Req() req: any) {
    return this.mailService.syncFolder(req.user, accountId, folderPath);
  }

  // Messages
  @Get('accounts/:accountId/folders/:folderPath/search')
  searchMessages(@Param('accountId') accountId: string, @Param('folderPath') folderPath: string, @Query() query: Record<string, unknown>, @Req() req: any) {
    return this.mailService.searchMessages(req.user, accountId, folderPath, query);
  }

  @Delete('accounts/:accountId/folders/:folderPath/messages/:uid')
  deleteMessage(@Param('accountId') accountId: string, @Param('folderPath') folderPath: string, @Param('uid') uid: string, @Req() req: any) {
    return this.mailService.deleteMessage(req.user, accountId, folderPath, uid);
  }

  @Post('accounts/:accountId/folders/:folderPath/messages/bulk-delete')
  bulkDeleteMessages(@Param('accountId') accountId: string, @Param('folderPath') folderPath: string, @Body() dto: any, @Req() req: any) {
    return this.mailService.bulkDeleteMessages(req.user, accountId, folderPath, dto);
  }

  @Put('accounts/:accountId/folders/:folderPath/messages/bulk-read')
  bulkReadMessages(@Param('accountId') accountId: string, @Param('folderPath') folderPath: string, @Body() dto: any, @Req() req: any) {
    return this.mailService.bulkReadMessages(req.user, accountId, folderPath, dto);
  }

  @Put('accounts/:accountId/folders/:folderPath/messages/:uid/move')
  moveMessage(@Param('accountId') accountId: string, @Param('folderPath') folderPath: string, @Param('uid') uid: string, @Body() dto: any, @Req() req: any) {
    return this.mailService.moveMessage(req.user, accountId, folderPath, uid, dto);
  }

  @Put('accounts/:accountId/folders/:folderPath/messages/:uid/read')
  markRead(@Param('accountId') accountId: string, @Param('folderPath') folderPath: string, @Param('uid') uid: string, @Body() dto: any, @Req() req: any) {
    return this.mailService.markRead(req.user, accountId, folderPath, uid, dto);
  }

  @Put('accounts/:accountId/folders/:folderPath/messages/:uid/star')
  starMessage(@Param('accountId') accountId: string, @Param('folderPath') folderPath: string, @Param('uid') uid: string, @Body() dto: any, @Req() req: any) {
    return this.mailService.starMessage(req.user, accountId, folderPath, uid, dto);
  }

  @Get('accounts/:accountId/folders/:folderPath/messages/:uid/attachments/:attachmentId')
  getAttachment(@Param('accountId') accountId: string, @Param('folderPath') folderPath: string, @Param('uid') uid: string, @Param('attachmentId') attachmentId: string, @Req() req: any) {
    return this.mailService.getAttachment(req.user, accountId, folderPath, uid, attachmentId);
  }

  @Post('accounts/:accountId/drafts')
  createDraft(@Param('accountId') accountId: string, @Body() dto: any, @Req() req: any) {
    return this.mailService.createDraft(req.user, accountId, dto);
  }
}
