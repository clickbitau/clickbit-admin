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

export interface BillingSettings {
  stripePublishableKey: string;
  enableStripe: boolean;
  currencyCode: string;
  taxRate: number;
  taxType: string;
  googleMapsApiKey: string;
}

export interface SettingRow {
  id?: number;
  setting_key: string;
  setting_value?: string | null;
  setting_type?: string;
  description?: string | null;
  is_public?: boolean;
  auto_load?: boolean;
  created_at?: string;
  updated_at?: string;
}
