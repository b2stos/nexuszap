import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "@/hooks/use-toast";
import { Loader2, Send, Zap, Gauge, Snail } from "lucide-react";
import { MediaUpload } from "./MediaUpload";
import { z } from "zod";
import DOMPurify from "dompurify";

const campaignSchema = z.object({
  name: z.string().trim().min(1, { message: "Nome da campanha não pode ser vazio" }).max(200, { message: "Nome muito longo (máximo 200 caracteres)" }),
  message: z.string()
    .trim()
    .min(1, { message: "Mensagem não pode ser vazia" })
    .max(4000, { message: "Mensagem muito longa (máximo 4000 caracteres)" })
    .refine(val => !/<script|javascript:|onerror=|onclick=/i.test(val), {
      message: "Mensagem contém conteúdo potencialmente perigoso"
    }),
});

type SendSpeed = 'slow' | 'normal' | 'fast';

export function CampaignForm() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [sendSpeed, setSendSpeed] = useState<SendSpeed>("normal");

  // Count unique phone numbers (not duplicate contacts)
  const { data: uniqueContactCount } = useQuery({
    queryKey: ["contacts-unique-count"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("phone");

      if (error) throw error;
      
      // Get unique phone numbers
      const uniquePhones = new Set(data.map(c => c.phone));
      return uniquePhones.size;
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
    
    if (!uniqueContactCount || uniqueContactCount === 0) {
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

      // Sanitize message content to prevent XSS
      const sanitizedMessage = DOMPurify.sanitize(validation.data.message, {
        ALLOWED_TAGS: [], // Remove all HTML tags
        ALLOWED_ATTR: [], // Remove all attributes
        KEEP_CONTENT: true, // Keep text content
      });

      const { data: campaign, error: campaignError } = await supabase
        .from("campaigns")
        .insert({
          user_id: user.id,
          name: validation.data.name,
          message_content: sanitizedMessage,
          media_urls: mediaUrls,
          status: "draft",
          send_speed: sendSpeed,
        })
        .select()
        .single();

      if (campaignError) throw campaignError;

      // Fetch contacts with unique phone numbers (one per phone)
      const { data: allContacts, error: contactsError } = await supabase
        .from("contacts")
        .select("id, phone");

      if (contactsError) throw contactsError;

      // Deduplicate by phone - keep only one contact per unique phone number
      const seenPhones = new Set<string>();
      const uniqueContacts = allContacts.filter(contact => {
        if (seenPhones.has(contact.phone)) {
          return false;
        }
        seenPhones.add(contact.phone);
        return true;
      });

      const messages = uniqueContacts.map((contact) => ({
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

          <div className="space-y-3">
            <Label>Velocidade de Envio</Label>
            <RadioGroup
              value={sendSpeed}
              onValueChange={(value) => setSendSpeed(value as SendSpeed)}
              className="grid grid-cols-3 gap-4"
            >
              <div>
                <RadioGroupItem
                  value="slow"
                  id="speed-slow"
                  className="peer sr-only"
                />
                <Label
                  htmlFor="speed-slow"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                >
                  <Snail className="mb-2 h-6 w-6 text-green-500" />
                  <span className="text-sm font-medium">Lento</span>
                  <span className="text-xs text-muted-foreground text-center mt-1">
                    ~3s entre msgs
                  </span>
                </Label>
              </div>
              <div>
                <RadioGroupItem
                  value="normal"
                  id="speed-normal"
                  className="peer sr-only"
                />
                <Label
                  htmlFor="speed-normal"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                >
                  <Gauge className="mb-2 h-6 w-6 text-blue-500" />
                  <span className="text-sm font-medium">Normal</span>
                  <span className="text-xs text-muted-foreground text-center mt-1">
                    ~1.5s entre msgs
                  </span>
                </Label>
              </div>
              <div>
                <RadioGroupItem
                  value="fast"
                  id="speed-fast"
                  className="peer sr-only"
                />
                <Label
                  htmlFor="speed-fast"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                >
                  <Zap className="mb-2 h-6 w-6 text-yellow-500" />
                  <span className="text-sm font-medium">Rápido</span>
                  <span className="text-xs text-muted-foreground text-center mt-1">
                    ~0.8s entre msgs
                  </span>
                </Label>
              </div>
            </RadioGroup>
            <p className="text-xs text-muted-foreground">
              Velocidade mais lenta reduz o risco de bloqueio pelo WhatsApp
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
              {uniqueContactCount || 0} contato(s) receberão esta mensagem
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
