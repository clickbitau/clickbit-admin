export interface Service {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  category?: string | null;
  header_image?: string | null;
  features?: unknown;
  pricing?: unknown;
  sections?: unknown;
  is_popular?: boolean;
  is_active?: boolean;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PortfolioItem {
  id: number;
  title: string;
  slug: string;
  description?: string | null;
  short_description?: string | null;
  featured_image?: string | null;
  gallery_images?: unknown;
  client_name?: string | null;
  project_url?: string | null;
  project_date?: string | null;
  technologies?: unknown;
  services_provided?: unknown;
  status: string;
  featured?: boolean;
  category?: string | null;
  sort_order?: number;
  meta_title?: string | null;
  meta_description?: string | null;
  content_type?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface TeamMember {
  id: number;
  name: string;
  role: string;
  role_label?: string | null;
  image?: string | null;
  email?: string | null;
  phone?: string | null;
  bio?: string | null;
  linkedin?: string | null;
  display_order?: number | null;
  is_active?: boolean | null;
  user_id?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface Review {
  id: number;
  name: string;
  email?: string | null;
  company?: string | null;
  position?: string | null;
  rating: number;
  status: string;
  review_text: string;
  service_type?: string | null;
  project_type?: string | null;
  is_featured?: boolean | null;
  display_order?: number | null;
  approved_at?: string | null;
  approved_by?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface BlogPost {
  id: number;
  title: string;
  slug: string;
  content?: string | null;
  excerpt?: string | null;
  featured_image?: string | null;
  author_id?: number | null;
  author?: { id: number; first_name: string; last_name: string } | null;
  status: string;
  published_at?: string | null;
  scheduled_at?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  meta_keywords?: string | null;
  tags?: unknown;
  categories?: unknown;
  featured?: boolean;
  allow_comments?: boolean;
  view_count?: number;
  comment_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Comment {
  id: number;
  post_id: number;
  parent_id?: number | null;
  content: string;
  author_name: string;
  author_email: string;
  status: string;
  user_id?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface ContentLegacyListResponse<T> {
  success: boolean;
  data: T[];
  pagination: { total: number; limit?: number | null; offset?: number; hasMore?: boolean };
}

export interface ContentLegacyDataResponse<T> {
  success: boolean;
  data: T;
}

export interface ContentLegacyMessageResponse {
  success: boolean;
  message: string;
}
