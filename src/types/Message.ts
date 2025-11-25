import { Database } from "@/integrations/supabase/types";

export type Message = Database["public"]["Tables"]["messages"]["Row"];
export type MessageInsert = Database["public"]["Tables"]["messages"]["Insert"];
export type MessageUpdate = Database["public"]["Tables"]["messages"]["Update"];

export type MessageStatus = Database["public"]["Enums"]["message_status"];

export interface MessageWithContact extends Message {
  contact?: {
    name: string;
    phone: string;
  };
}
