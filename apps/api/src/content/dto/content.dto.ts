import { IsOptional, IsString, IsInt, IsBoolean, Min, Max, IsEmail } from 'class-validator';
import { Type } from 'class-transformer';

export class ListContentQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() limit?: number;
  @IsOptional() @Type(() => Number) @IsInt() offset?: number;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() featured?: string;
}

export class CreateServiceDto {
  @IsString() name!: string;
  @IsOptional() @IsString() slug?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() header_image?: string;
  @IsOptional() features?: unknown;
  @IsOptional() pricing?: unknown;
  @IsOptional() sections?: unknown;
  @IsOptional() @IsBoolean() is_popular?: boolean;
  @IsOptional() @IsBoolean() is_active?: boolean;
}

export class UpdateServiceDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() slug?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() header_image?: string;
  @IsOptional() features?: unknown;
  @IsOptional() pricing?: unknown;
  @IsOptional() sections?: unknown;
  @IsOptional() @IsBoolean() is_popular?: boolean;
  @IsOptional() @IsBoolean() is_active?: boolean;
}

export class CreatePortfolioDto {
  @IsString() title!: string;
  @IsOptional() @IsString() slug?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() short_description?: string;
  @IsOptional() @IsString() featured_image?: string;
  @IsOptional() gallery_images?: unknown;
  @IsOptional() @IsString() client_name?: string;
  @IsOptional() @IsString() project_url?: string;
  @IsOptional() project_date?: unknown;
  @IsOptional() technologies?: unknown;
  @IsOptional() services_provided?: unknown;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsBoolean() featured?: boolean;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @Type(() => Number) @IsInt() sort_order?: number;
  @IsOptional() @IsString() meta_title?: string;
  @IsOptional() @IsString() meta_description?: string;
  @IsOptional() content_type?: unknown;
}

export class UpdatePortfolioDto extends CreatePortfolioDto {}

export class CreateTeamDto {
  @IsString() name!: string;
  @IsString() role!: string;
  @IsOptional() @IsString() role_label?: string;
  @IsOptional() @IsString() image?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() bio?: string;
  @IsOptional() @IsString() linkedin?: string;
  @IsOptional() @Type(() => Number) @IsInt() display_order?: number;
  @IsOptional() @IsBoolean() is_active?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() user_id?: number;
}

export class UpdateTeamDto extends CreateTeamDto {}

export class CreateReviewDto {
  @IsString() name!: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() company?: string;
  @IsOptional() @IsString() position?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5) rating?: number;
  @IsString() review_text!: string;
  @IsOptional() @IsString() service_type?: string;
  @IsOptional() @IsString() project_type?: string;
}

export class UpdateReviewDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsBoolean() is_featured?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() display_order?: number;
  @IsOptional() @IsString() review_text?: string;
}

export class ReviewStatusDto {
  @IsString() status!: 'approved' | 'rejected' | 'pending';
}

export class CreateBlogPostDto {
  @IsString() title!: string;
  @IsOptional() @IsString() slug?: string;
  @IsOptional() @IsString() content?: string;
  @IsOptional() @IsString() excerpt?: string;
  @IsOptional() @IsString() featured_image?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() published_at?: unknown;
  @IsOptional() scheduled_at?: unknown;
  @IsOptional() @IsString() meta_title?: string;
  @IsOptional() @IsString() meta_description?: string;
  @IsOptional() @IsString() meta_keywords?: string;
  @IsOptional() tags?: unknown;
  @IsOptional() categories?: unknown;
  @IsOptional() @IsBoolean() featured?: boolean;
  @IsOptional() @IsBoolean() allow_comments?: boolean;
}

export class UpdateBlogPostDto extends CreateBlogPostDto {}

export class CreateCommentDto {
  @IsString() author_name!: string;
  @IsEmail() author_email!: string;
  @IsString() content!: string;
  @IsOptional() @Type(() => Number) @IsInt() parent_id?: number;
}
