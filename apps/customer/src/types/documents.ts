export interface AppDocument {
  id: number;
  name: string;
  original_name?: string | null;
  file_url: string;
  file_type?: string | null;
  file_size?: number | null;
  status?: string;
  related_entity_type?: string | null;
  related_entity_id?: number | null;
  uploaded_by?: number | null;
  created_at?: string;
  updated_at?: string;
  uploader?: { name?: string; email?: string };
  signed_url?: string | null;
}
