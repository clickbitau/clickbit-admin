import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { OptionalAuthGuard } from '../auth/optional-auth.guard';
import { ContactService } from './contact.service';
import { ContactSubmissionDto } from './dto/contact.dto';

@Controller('contact')
@UseGuards(OptionalAuthGuard)
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Post()
  submit(@Body() dto: ContactSubmissionDto) {
    return this.contactService.submit(dto as unknown as Record<string, unknown>);
  }
}
