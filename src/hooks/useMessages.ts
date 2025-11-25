import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Message, MessageInsert } from "@/types/Message";
import { QUERY_KEYS } from "@/utils/constants";
import { toast } from "sonner";

export const useMessages = (campaignId?: string) => {
  const queryClient = useQueryClient();

  const { data: messages, isLoading, error } = useQuery({
    queryKey: [QUERY_KEYS.MESSAGES, campaignId],
    queryFn: async () => {
      let query = supabase
        .from("messages")
        .select("*, contact:contacts(name, phone)")
        .order("created_at", { ascending: false });

      if (campaignId) {
        query = query.eq("campaign_id", campaignId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Message[];
    },
  });

  const createMessage = useMutation({
    mutationFn: async (message: MessageInsert) => {
      const { data, error } = await supabase
        .from("messages")
        .insert(message)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.MESSAGES] });
      toast.success("Mensagem enviada com sucesso");
    },
    onError: (error: any) => {
      toast.error("Erro ao enviar mensagem");
      console.error(error);
    },
  });

  return {
    messages,
    isLoading,
    error,
    createMessage: createMessage.mutate,
    isCreating: createMessage.isPending,
  };
};
