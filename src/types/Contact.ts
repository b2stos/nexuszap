import { Database } from "@/integrations/supabase/types";

export type Contact = Database["public"]["Tables"]["contacts"]["Row"];
export type ContactInsert = Database["public"]["Tables"]["contacts"]["Insert"];
export type ContactUpdate = Database["public"]["Tables"]["contacts"]["Update"];

export interface ImportedContact {
  name: string;
  phone: string;
}

export interface ContactWithMessages extends Contact {
  message_count?: number;
  last_message_at?: string;
}
