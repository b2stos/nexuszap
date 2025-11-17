import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Loader2, Send } from "lucide-react";
import { MediaUpload } from "./MediaUpload";
import { z } from "zod";

const campaignSchema = z.object({
  name: z.string().trim().min(1, { message: "Nome da campanha não pode ser vazio" }).max(200, { message: "Nome muito longo (máximo 200 caracteres)" }),
  message: z.string().trim().min(1, { message: "Mensagem não pode ser vazia" }).max(4000, { message: "Mensagem muito longa (máximo 4000 caracteres)" }),
});

export function CampaignForm() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);

  const { data: contacts } = useQuery({
    queryKey: ["contacts-count"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id", { count: "exact" });

      if (error) throw error;
      return data;
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate inputs
    const validation = campaignSchema.safeParse({ name, message });
    if (!validation.success) {
      const firstError = validation.error.errors[0];
      toast({
        title: "Erro de validação",
        description: firstError.message,
        variant: "destructive",
      });
      return;
    }
    
    if (!contacts || contacts.length === 0) {
      toast({
        title: "Nenhum contato disponível",
        description: "Importe contatos antes de criar uma campanha.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: campaign, error: campaignError } = await supabase
        .from("campaigns")
        .insert({
          user_id: user.id,
          name: validation.data.name,
          message_content: validation.data.message,
          media_urls: mediaUrls,
          status: "draft",
        })
        .select()
        .single();

      if (campaignError) throw campaignError;

      const { data: allContacts, error: contactsError } = await supabase
        .from("contacts")
        .select("id");

      if (contactsError) throw contactsError;

      const messages = allContacts.map((contact) => ({
        campaign_id: campaign.id,
        contact_id: contact.id,
        status: "pending" as const,
      }));

      const { error: messagesError } = await supabase
        .from("messages")
        .insert(messages);

      if (messagesError) throw messagesError;

      toast({
        title: "Campanha criada!",
        description: `Campanha "${validation.data.name}" criada com ${messages.length} mensagens${mediaUrls.length > 0 ? ` e ${mediaUrls.length} arquivo(s) de mídia` : ''}.`,
      });

      navigate("/dashboard/campaigns");
    } catch (error: any) {
      toast({
        title: "Erro ao criar campanha",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Detalhes da Campanha</CardTitle>
        <CardDescription>
          Preencha os dados da sua campanha de mensagens
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Nome da Campanha</Label>
            <Input
              id="name"
              placeholder="Ex: Promoção Black Friday"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Mensagem</Label>
            <Textarea
              id="message"
              placeholder="Digite sua mensagem aqui..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              rows={6}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Caracteres: {message.length}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Mídia (Fotos, Vídeos ou PDFs)</Label>
            <MediaUpload
              onMediaUploaded={setMediaUrls}
              existingMedia={mediaUrls}
            />
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              {contacts?.length || 0} contato(s) receberão esta mensagem
            </p>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Criar Campanha
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
