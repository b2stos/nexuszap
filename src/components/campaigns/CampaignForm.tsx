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

export function CampaignForm() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");

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
          name,
          message_content: message,
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
        description: `Campanha "${name}" criada com ${messages.length} mensagens.`,
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
              {message.length} caracteres
            </p>
          </div>

          <div className="rounded-lg border border-border p-4 bg-muted/50">
            <h3 className="font-medium mb-2 text-foreground">Destinatários</h3>
            <p className="text-sm text-muted-foreground">
              Esta campanha será enviada para{" "}
              <span className="font-medium text-foreground">
                {contacts?.length || 0} contatos
              </span>
            </p>
          </div>

          <div className="flex gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/dashboard/campaigns")}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1"
            >
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
