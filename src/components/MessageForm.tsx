import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Loader2, Send, CheckCircle2, XCircle, Phone, MessageSquare } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

const messageSchema = z.object({
  phone: z.string()
    .trim()
    .min(10, { message: "Telefone muito curto" })
    .max(15, { message: "Telefone muito longo" })
    .regex(/^[0-9]+$/, { message: "Telefone deve conter apenas números" })
    .refine((val) => {
      const cleanPhone = val.replace(/\D/g, "");
      return cleanPhone.length >= 10 && cleanPhone.length <= 15;
    }, { message: "Formato de telefone inválido para WhatsApp" }),
  message: z.string()
    .trim()
    .min(1, { message: "Mensagem não pode ser vazia" })
    .max(4096, { message: "Mensagem muito longa (máximo 4096 caracteres)" }),
});

type FormState = "idle" | "sending" | "success" | "error";

export function MessageForm() {
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [formState, setFormState] = useState<FormState>("idle");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [messageError, setMessageError] = useState<string | null>(null);

  // Format phone number with mask
  const formatPhoneNumber = (value: string): string => {
    // Remove all non-digits
    const cleaned = value.replace(/\D/g, "");
    
    // Limit to 13 digits (55 + 11 + 9 digits)
    const limited = cleaned.slice(0, 13);
    
    // Apply mask: +55 11 99999-9999
    if (limited.length <= 2) {
      return limited ? `+${limited}` : "";
    } else if (limited.length <= 4) {
      return `+${limited.slice(0, 2)} ${limited.slice(2)}`;
    } else if (limited.length <= 9) {
      return `+${limited.slice(0, 2)} ${limited.slice(2, 4)} ${limited.slice(4)}`;
    } else {
      return `+${limited.slice(0, 2)} ${limited.slice(2, 4)} ${limited.slice(4, 9)}-${limited.slice(9)}`;
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhone(formatted);
    setPhoneError(null);
  };

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= 4096) {
      setMessage(value);
      setMessageError(null);
    }
  };

  const validateForm = (): boolean => {
    // Clean phone for validation (remove mask)
    const cleanPhone = phone.replace(/\D/g, "");
    
    const validation = messageSchema.safeParse({
      phone: cleanPhone,
      message: message,
    });

    if (!validation.success) {
      const errors = validation.error.errors;
      const phoneErr = errors.find(e => e.path[0] === "phone");
      const messageErr = errors.find(e => e.path[0] === "message");
      
      if (phoneErr) setPhoneError(phoneErr.message);
      if (messageErr) setMessageError(messageErr.message);
      
      return false;
    }

    setPhoneError(null);
    setMessageError(null);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast({
        title: "Preencha os campos obrigatórios",
        description: "Verifique os erros nos campos do formulário",
        variant: "destructive",
      });
      return;
    }

    setFormState("sending");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Clean phone for sending
      const cleanPhone = phone.replace(/\D/g, "");

      // Simulate API call (replace with actual WhatsApp API integration)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Here you would integrate with your WhatsApp sending service
      console.log("Sending message:", { phone: cleanPhone, message });

      setFormState("success");
      
      toast({
        title: "Mensagem enviada com sucesso!",
        description: `Mensagem enviada para ${phone}`,
      });

      // Clear form after 2 seconds
      setTimeout(() => {
        setPhone("");
        setMessage("");
        setFormState("idle");
      }, 2000);

    } catch (error: any) {
      setFormState("error");
      
      toast({
        title: "Erro ao enviar mensagem",
        description: error.message || "Não foi possível enviar a mensagem. Tente novamente.",
        variant: "destructive",
      });

      // Reset to idle after showing error
      setTimeout(() => {
        setFormState("idle");
      }, 3000);
    }
  };

  const isFormValid = () => {
    const cleanPhone = phone.replace(/\D/g, "");
    return cleanPhone.length >= 10 && message.trim().length > 0 && message.length <= 4096;
  };

  const characterCount = message.length;
  const characterLimit = 4096;
  const isNearLimit = characterCount > 3500;
  const isAtLimit = characterCount >= characterLimit;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Enviar Mensagem WhatsApp
        </CardTitle>
        <CardDescription>
          Envie mensagens individuais via WhatsApp
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Phone Input */}
          <div className="space-y-2">
            <Label htmlFor="phone" className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Número WhatsApp
              {phoneError === null && phone && (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              )}
              {phoneError && (
                <XCircle className="h-4 w-4 text-destructive" />
              )}
            </Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+55 11 99999-9999"
              value={phone}
              onChange={handlePhoneChange}
              disabled={formState === "sending"}
              className={phoneError ? "border-destructive" : ""}
            />
            {phoneError && (
              <p className="text-sm text-destructive">{phoneError}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Digite com DDI: +55 (Brasil)
            </p>
          </div>

          {/* Message Textarea */}
          <div className="space-y-2">
            <Label htmlFor="message" className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                Mensagem
                {messageError === null && message && (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                )}
                {messageError && (
                  <XCircle className="h-4 w-4 text-destructive" />
                )}
              </span>
              <span 
                className={`text-xs ${
                  isAtLimit ? "text-destructive font-semibold" :
                  isNearLimit ? "text-orange-500 font-medium" :
                  "text-muted-foreground"
                }`}
              >
                {characterCount}/{characterLimit}
              </span>
            </Label>
            <Textarea
              id="message"
              placeholder="Digite sua mensagem aqui..."
              value={message}
              onChange={handleMessageChange}
              disabled={formState === "sending"}
              className={`resize-none ${messageError ? "border-destructive" : ""}`}
              rows={8}
            />
            {messageError && (
              <p className="text-sm text-destructive">{messageError}</p>
            )}
            {isNearLimit && !isAtLimit && (
              <p className="text-xs text-orange-500">
                Atenção: Próximo ao limite de caracteres
              </p>
            )}
          </div>

          {/* Submit Button */}
          <div className="flex gap-3 pt-4">
            <Button
              type="submit"
              disabled={!isFormValid() || formState === "sending"}
              className="flex-1"
            >
              {formState === "sending" && (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              )}
              {formState === "success" && (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Mensagem Enviada!
                </>
              )}
              {formState === "error" && (
                <>
                  <XCircle className="mr-2 h-4 w-4" />
                  Erro ao Enviar
                </>
              )}
              {formState === "idle" && (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Enviar Mensagem
                </>
              )}
            </Button>
            
            {(phone || message) && formState === "idle" && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setPhone("");
                  setMessage("");
                  setPhoneError(null);
                  setMessageError(null);
                }}
              >
                Limpar
              </Button>
            )}
          </div>

          {/* Status Messages */}
          {formState === "success" && (
            <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                <CheckCircle2 className="h-5 w-5" />
                <p className="font-medium">Mensagem enviada com sucesso!</p>
              </div>
              <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                O formulário será limpo automaticamente...
              </p>
            </div>
          )}

          {formState === "error" && (
            <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
                <XCircle className="h-5 w-5" />
                <p className="font-medium">Erro ao enviar mensagem</p>
              </div>
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                Tente novamente em alguns instantes.
              </p>
            </div>
          )}
        </form>

        {/* Form Info */}
        <div className="mt-6 p-4 bg-muted rounded-lg">
          <h4 className="text-sm font-semibold mb-2">Informações:</h4>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• Telefone deve incluir DDI (código do país)</li>
            <li>• Máximo de 4096 caracteres por mensagem</li>
            <li>• O formulário é validado em tempo real</li>
            <li>• Botão de envio desabilitado se houver erros</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
