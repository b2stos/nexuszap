import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

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
    if (!name.trim() || !phone.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha nome e telefone",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Validate phone with AI
      console.log('Validating phone:', phone);
      
      const { data: validationData, error: validationError } = await supabase.functions.invoke(
        'validate-phone-numbers',
        { body: { phoneNumbers: [phone] } }
      );

      console.log('Validation response:', { validationData, validationError });

      if (validationError) {
        console.error('Validation error:', validationError);
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
          name: name.trim(),
          phone: result.formatted,
        });

      if (insertError) throw insertError;

      toast({
        title: "Contato adicionado!",
        description: `${name} foi adicionado com sucesso`,
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
      console.error('Add contact error:', error);
      toast({
        title: "Erro ao adicionar contato",
        description: error.message,
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
