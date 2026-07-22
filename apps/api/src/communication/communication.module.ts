import { Module } from '@nestjs/common';
import { MessagesController } from './messages.controller';
import { ChatController } from './chat.controller';
import { MailController } from './mail.controller';
import { MessagesService } from './messages.service';
import { ChatService } from './chat.service';
import { MailService } from './mail.service';
import { MailImapService } from './mail-imap.service';

@Module({
  controllers: [MessagesController, ChatController, MailController],
  providers: [MessagesService, ChatService, MailService, MailImapService],
  exports: [MailImapService],
})
export class CommunicationModule {}
