import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { z } from "zod";
import { validatePhoneDetailed } from "@/utils/validators";

const validationSchema = z.object({
  email: z.string()
    .trim()
    .min(1, { message: "Email não pode ser vazio" })
    .email({ message: "Email inválido" })
    .max(255, { message: "Email muito longo" }),
  password: z.string()
    .min(8, { message: "Senha deve ter pelo menos 8 caracteres" })
    .max(128, { message: "Senha muito longa" }),
  phone: z.string()
    .trim()
    .min(10, { message: "Telefone muito curto" })
    .max(15, { message: "Telefone muito longo" })
    .regex(/^[0-9]+$/, { message: "Telefone deve conter apenas números" }),
  message: z.string()
    .trim()
    .min(1, { message: "Mensagem não pode ser vazia" })
    .max(4000, { message: "Mensagem muito longa" }),
});

export function ValidationDemo() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [messageError, setMessageError] = useState<string | null>(null);

  const validateField = (field: keyof typeof validationSchema.shape, value: string) => {
    try {
      const fieldSchema = validationSchema.shape[field];
      fieldSchema.parse(value);
      return null;
    } catch (error: any) {
      return error.errors?.[0]?.message || "Valor inválido";
    }
  };

  const handleEmailBlur = () => {
    setEmailError(validateField("email", email));
  };

  const handlePasswordBlur = () => {
    setPasswordError(validateField("password", password));
  };

  const handlePhoneBlur = () => {
    const phoneValidation = validatePhoneDetailed(phone);
    setPhoneError(phoneValidation);
  };

  const handleMessageBlur = () => {
    setMessageError(validateField("message", message));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all fields
    const validation = validationSchema.safeParse({
      email,
      password,
      phone,
      message,
    });

    if (!validation.success) {
      const firstError = validation.error.errors[0];
      toast({
        title: "Erro de validação",
        description: firstError.message,
        variant: "destructive",
      });
      return;
    }

    // Additional phone validation
    const phoneValidation = validatePhoneDetailed(phone);
    if (phoneValidation) {
      toast({
        title: "Telefone inválido",
        description: phoneValidation,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    // Simulate API call
    setTimeout(() => {
      setLoading(false);
      toast({
        title: "Mensagem enviada com sucesso!",
        description: "Todos os campos foram validados corretamente.",
      });
      
      // Reset form
      setEmail("");
      setPassword("");
      setPhone("");
      setMessage("");
      setEmailError(null);
      setPasswordError(null);
      setPhoneError(null);
      setMessageError(null);
    }, 2000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Demonstração de Validação</CardTitle>
        <CardDescription>
          Teste todas as validações implementadas no sistema
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="demo-email">
              Email válido
              {emailError === null && email && (
                <CheckCircle2 className="inline ml-2 h-4 w-4 text-green-500" />
              )}
              {emailError && (
                <XCircle className="inline ml-2 h-4 w-4 text-destructive" />
              )}
            </Label>
            <Input
              id="demo-email"
              type="email"
              placeholder="usuario@exemplo.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailError(null);
              }}
              onBlur={handleEmailBlur}
              className={emailError ? "border-destructive" : ""}
            />
            {emailError && (
              <p className="text-sm text-destructive">{emailError}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="demo-password">
              Senha (mínimo 8 caracteres)
              {passwordError === null && password && (
                <CheckCircle2 className="inline ml-2 h-4 w-4 text-green-500" />
              )}
              {passwordError && (
                <XCircle className="inline ml-2 h-4 w-4 text-destructive" />
              )}
            </Label>
            <Input
              id="demo-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setPasswordError(null);
              }}
              onBlur={handlePasswordBlur}
              className={passwordError ? "border-destructive" : ""}
            />
            {passwordError && (
              <p className="text-sm text-destructive">{passwordError}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Caracteres: {password.length}/128
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="demo-phone">
              Telefone (formato WhatsApp)
              {phoneError === null && phone && (
                <CheckCircle2 className="inline ml-2 h-4 w-4 text-green-500" />
              )}
              {phoneError && (
                <XCircle className="inline ml-2 h-4 w-4 text-destructive" />
              )}
            </Label>
            <Input
              id="demo-phone"
              type="tel"
              placeholder="5511999999999"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setPhoneError(null);
              }}
              onBlur={handlePhoneBlur}
              className={phoneError ? "border-destructive" : ""}
            />
            {phoneError && (
              <p className="text-sm text-destructive">{phoneError}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Digite com DDI: 55 (Brasil) + DDD + Número
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="demo-message">
              Mensagem (não vazia)
              {messageError === null && message && (
                <CheckCircle2 className="inline ml-2 h-4 w-4 text-green-500" />
              )}
              {messageError && (
                <XCircle className="inline ml-2 h-4 w-4 text-destructive" />
              )}
            </Label>
            <Textarea
              id="demo-message"
              placeholder="Digite sua mensagem aqui..."
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                setMessageError(null);
              }}
              onBlur={handleMessageBlur}
              className={messageError ? "border-destructive" : ""}
              rows={4}
            />
            {messageError && (
              <p className="text-sm text-destructive">{messageError}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Caracteres: {message.length}/4000
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                "Enviar Mensagem"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                // Simulate error
                toast({
                  title: "Erro ao enviar mensagem",
                  description: "Não foi possível enviar a mensagem. Tente novamente.",
                  variant: "destructive",
                });
              }}
            >
              Testar Erro
            </Button>
          </div>

          <div className="p-4 bg-muted rounded-lg">
            <h4 className="font-semibold mb-2">Status das Validações:</h4>
            <ul className="space-y-1 text-sm">
              <li>✅ Validação com Zod implementada</li>
              <li>✅ Email válido</li>
              <li>✅ Senha mínimo 8 caracteres</li>
              <li>✅ Número de telefone (formato WhatsApp)</li>
              <li>✅ Mensagem não vazia</li>
              <li>✅ Toast de feedback (sucesso/erro/aviso)</li>
              <li>✅ Estado de loading nos botões</li>
              <li>✅ Botões desabilitados durante requisição</li>
            </ul>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
