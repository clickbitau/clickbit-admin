export * from '@clickbit/shared';

export interface PdfTemplate {
  id: number;
  name: string;
  template_type?: string;
  /** @deprecated use template_type */
  type?: string;
  description?: string | null;
  is_default?: boolean;
  html?: string | null;
  css?: string | null;
  header?: string | null;
  footer?: string | null;
  /** @deprecated use header */
  header_html?: string | null;
  /** @deprecated use footer */
  footer_html?: string | null;
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
  id: number;
  setting_key: string;
  setting_value: string;
  setting_type: string;
  is_public: boolean;
}
