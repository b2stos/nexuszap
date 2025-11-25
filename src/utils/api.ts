import { supabase } from "@/integrations/supabase/client";
import { APIError, APIResponse } from "@/types/API";

export const handleAPIError = (error: any): APIError => {
  console.error("API Error:", error);
  
  return {
    message: error.message || "Ocorreu um erro inesperado",
    code: error.code,
    details: error.details,
  };
};

export const fetchWithAuth = async (url: string, options?: RequestInit): Promise<Response> => {
  const { data: { session } } = await supabase.auth.getSession();
  
  const headers = {
    "Content-Type": "application/json",
    ...(session?.access_token && {
      Authorization: `Bearer ${session.access_token}`,
    }),
    ...options?.headers,
  };

  return fetch(url, {
    ...options,
    headers,
  });
};

export const handleSupabaseResponse = <T>(data: T | null, error: any): APIResponse<T> => {
  if (error) {
    return {
      error: error.message,
      message: "Erro ao processar requisição",
    };
  }

  return {
    data: data || undefined,
    message: "Sucesso",
  };
};
