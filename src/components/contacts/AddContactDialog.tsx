import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

const contactSchema = z.object({
  name: z.string()
    .trim()
    .min(1, { message: "Nome não pode ser vazio" })
    .max(100, { message: "Nome muito longo (máximo 100 caracteres)" }),
  phone: z.string()
    .trim()
    .min(10, { message: "Telefone muito curto (mínimo 10 dígitos)" })
    .max(15, { message: "Telefone muito longo (máximo 15 dígitos)" })
    .regex(/^[0-9]+$/, { message: "Telefone deve conter apenas números" })
    .refine((val) => {
      // WhatsApp format validation: DDI + DDD + número
      const cleanPhone = val.replace(/\D/g, "");
      return cleanPhone.length >= 10 && cleanPhone.length <= 15;
    }, { message: "Formato de telefone inválido para WhatsApp" }),
});

interface AddContactDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function AddContactDialog({ open, onOpenChange }: AddContactDialogProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const handleAdd = async () => {
    // Validate with Zod
    const validation = contactSchema.safeParse({ name, phone });
    if (!validation.success) {
      const firstError = validation.error.errors[0];
      toast({
        title: "Erro de validação",
        description: firstError.message,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Validate phone with AI
      const { data: validationData, error: validationError } = await supabase.functions.invoke(
        'validate-phone-numbers',
        { body: { phoneNumbers: [validation.data.phone] } }
      );

      if (validationError) {
        throw new Error(`Erro na validação: ${validationError.message || 'Erro desconhecido'}`);
      }

      if (!validationData || !validationData.results || validationData.results.length === 0) {
        throw new Error('Resposta inválida da validação');
      }

      const result = validationData.results[0];

      if (!result.isValid) {
        toast({
          title: "Número inválido",
          description: result.reason || "O número de telefone não é válido para WhatsApp",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Insert contact
      const { error: insertError } = await supabase
        .from('contacts')
        .insert({
          user_id: user.id,
          name: validation.data.name,
          phone: result.formatted,
        });

      if (insertError) throw insertError;

      toast({
        title: "Contato adicionado com sucesso!",
        description: `${validation.data.name} foi adicionado à sua lista de contatos`,
      });

      // Reset form
      setName("");
      setPhone("");
      
      // Refresh contacts list
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      
      // Close dialog
      if (onOpenChange) {
        onOpenChange(false);
      }
    } catch (error: any) {
      toast({
        title: "Erro ao adicionar contato",
        description: error.message || "Ocorreu um erro ao adicionar o contato. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar Contato</DialogTitle>
          <DialogDescription>
            Adicione um contato manualmente. O número será validado automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              placeholder="João Silva"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Telefone</Label>
            <Input
              id="phone"
              placeholder="5511999999999"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              Digite com DDI (ex: 5511999999999)
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange && onOpenChange(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button onClick={handleAdd} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? "Validando..." : "Adicionar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
