import { Controller, Get, Post, Patch, Body, Param, Query, Req, UseGuards, ParseIntPipe } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { ChatService } from './chat.service';
import { CreateWorkspaceDto, CreateDirectMessageDto, UpdateDirectMessageDto, CreateChannelDto, ReadConversationDto, ConversationPreferencesDto } from './dto/communication.dto';

@Controller('chat')
@UseGuards(SupabaseAuthGuard, RolesGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('participants')
  participants(@Req() req: any) {
    return this.chatService.participants(req.user);
  }

  @Get('workspaces')
  listWorkspaces(@Req() req: any) {
    return this.chatService.listWorkspaces(req.user);
  }

  @Post('workspaces')
  createWorkspace(@Req() req: any, @Body() dto: CreateWorkspaceDto) {
    return this.chatService.createWorkspace(req.user, dto as unknown as Record<string, unknown>);
  }

  @Get('direct-messages')
  listDirectMessages(@Req() req: any, @Query() query: Record<string, unknown>) {
    return this.chatService.listDirectMessages(req.user, query);
  }

  @Post('direct-messages')
  createDirectMessage(@Req() req: any, @Body() dto: CreateDirectMessageDto) {
    return this.chatService.createDirectMessage(req.user, dto as unknown as Record<string, unknown>);
  }

  @Patch('direct-messages/:id')
  patchDirectMessage(@Param('id', ParseIntPipe) id: number, @Req() req: any, @Body() dto: UpdateDirectMessageDto) {
    return this.chatService.patchDirectMessage(req.user, id, dto as unknown as Record<string, unknown>);
  }

  @Post('direct-messages/:id/read')
  markDmRead(@Param('id', ParseIntPipe) id: number, @Req() req: any, @Body() dto: ReadConversationDto) {
    return this.chatService.markDmRead(req.user, id, dto as unknown as Record<string, unknown>);
  }

  @Get('channels')
  listChannels(@Req() req: any, @Query() query: Record<string, unknown>) {
    return this.chatService.listChannels(req.user, query);
  }

  @Post('channels')
  createChannel(@Req() req: any, @Body() dto: CreateChannelDto) {
    return this.chatService.createChannel(req.user, dto as unknown as Record<string, unknown>);
  }

  @Post('channels/:id/read')
  markChannelRead(@Param('id', ParseIntPipe) id: number, @Req() req: any, @Body() dto: ReadConversationDto) {
    return this.chatService.markChannelRead(req.user, id, dto as unknown as Record<string, unknown>);
  }

  @Get('preferences')
  getPreferences(@Req() req: any, @Query() query: Record<string, unknown>) {
    return this.chatService.getPreferences(req.user, query);
  }

  @Post('preferences')
  savePreferences(@Req() req: any, @Body() dto: ConversationPreferencesDto) {
    return this.chatService.savePreferences(req.user, dto as unknown as Record<string, unknown>);
  }
}
