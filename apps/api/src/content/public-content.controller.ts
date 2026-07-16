import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { OptionalAuthGuard } from '../auth/optional-auth.guard';
import { PublicContentService } from './public-content.service';

@Controller('public')
@UseGuards(OptionalAuthGuard)
export class PublicContentController {
  constructor(private readonly publicContentService: PublicContentService) {}

  @Get('site-identity')
  siteIdentity() { return this.publicContentService.getContent('site-identity'); }

  @Get('contact-info')
  contactInfo() { return this.publicContentService.getContent('contact-info'); }

  @Get('footer-content')
  footerContent() { return this.publicContentService.getContent('footer-content'); }

  @Get('navigation')
  navigation() { return this.publicContentService.getContent('navigation'); }

  @Get('faq')
  faq() { return this.publicContentService.getContent('faq'); }

  @Get('mission-points')
  missionPoints() { return this.publicContentService.getContent('mission-points'); }

  @Get('marketing-integrations')
  marketingIntegrations() { return this.publicContentService.getContent('marketing-integrations'); }

  @Get('process-phases')
  processPhases() { return this.publicContentService.getContent('process-phases'); }

  @Get('search')
  search(@Req() req: any, @Query() query: Record<string, unknown>) {
    return this.publicContentService.search(req.user, query);
  }
}
