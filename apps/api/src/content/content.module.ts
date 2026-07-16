import { Module } from '@nestjs/common';
import { PublicContentController } from './public-content.controller';
import { PublicContentService } from './public-content.service';
import { ServicesController } from './services.controller';
import { ServicesService } from './services.service';
import { PortfolioController } from './portfolio.controller';
import { PortfolioService } from './portfolio.service';
import { TeamController } from './team.controller';
import { TeamService } from './team.service';
import { ReviewsController, ReviewsAdminController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { BlogController } from './blog.controller';
import { BlogService } from './blog.service';
import { MarketingController } from './marketing.controller';
import { MarketingService } from './marketing.service';

@Module({
  controllers: [
    PublicContentController,
    ServicesController,
    PortfolioController,
    TeamController,
    ReviewsController,
    ReviewsAdminController,
    BlogController,
    MarketingController,
  ],
  providers: [
    PublicContentService,
    ServicesService,
    PortfolioService,
    TeamService,
    ReviewsService,
    BlogService,
    MarketingService,
  ],
})
export class ContentModule {}
