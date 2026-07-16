import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards, ParseIntPipe } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { MessagesService } from './messages.service';
import { CreateMessageDto, UpdateMessageDto, ReactionDto, SearchMessagesDto, ListMessagesQueryDto } from './dto/communication.dto';

@Controller('messages')
@UseGuards(SupabaseAuthGuard, RolesGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get('channel/:channelId')
  listChannel(@Param('channelId', ParseIntPipe) channelId: number, @Req() req: any, @Query() query: ListMessagesQueryDto) {
    return this.messagesService.listChannelMessages(req.user, channelId, query as unknown as Record<string, unknown>);
  }

  @Get('direct-message/:dmId')
  listDm(@Param('dmId', ParseIntPipe) dmId: number, @Req() req: any, @Query() query: ListMessagesQueryDto) {
    return this.messagesService.listDmMessages(req.user, dmId, query as unknown as Record<string, unknown>);
  }

  @Post()
  create(@Req() req: any, @Body() dto: CreateMessageDto) {
    return this.messagesService.create(req.user, dto as unknown as Record<string, unknown>);
  }

  @Put(':messageId')
  update(@Param('messageId', ParseIntPipe) messageId: number, @Req() req: any, @Body() dto: UpdateMessageDto) {
    return this.messagesService.update(req.user, messageId, dto as unknown as Record<string, unknown>);
  }

  @Delete(':messageId')
  remove(@Param('messageId', ParseIntPipe) messageId: number, @Req() req: any) {
    return this.messagesService.remove(req.user, messageId);
  }

  @Post(':messageId/reactions')
  addReaction(@Param('messageId', ParseIntPipe) messageId: number, @Req() req: any, @Body() dto: ReactionDto) {
    return this.messagesService.addReaction(req.user, messageId, dto.emoji);
  }

  @Delete(':messageId/reactions')
  removeReaction(@Param('messageId', ParseIntPipe) messageId: number, @Req() req: any, @Body() dto: ReactionDto) {
    return this.messagesService.removeReaction(req.user, messageId, dto.emoji);
  }

  @Get(':messageId/thread')
  getThread(@Param('messageId', ParseIntPipe) messageId: number, @Req() req: any) {
    return this.messagesService.getThread(req.user, messageId);
  }

  @Get('search')
  search(@Req() req: any, @Query() query: SearchMessagesDto) {
    return this.messagesService.search(req.user, query as unknown as Record<string, unknown>);
  }
}
