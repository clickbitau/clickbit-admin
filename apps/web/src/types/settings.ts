export * from '@clickbit/shared';

export interface PdfTemplate {
  id: number;
  name: string;
  type?: string;
  description?: string | null;
  is_default?: boolean;
  html?: string | null;
  css?: string | null;
  footer_html?: string | null;
  header_html?: string | null;
  created_at?: string;
  updated_at?: string;
}
