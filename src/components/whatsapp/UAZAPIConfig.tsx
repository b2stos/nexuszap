import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Settings, TestTube, Save, Loader2, CheckCircle, XCircle, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface UAZAPIConfigProps {
  userId: string;
  onConfigured?: (configured: boolean) => void;
}

interface UAZAPIConfigData {
  id?: string;
  base_url: string;
  instance_token: string;
  instance_name: string;
  is_active: boolean;
  phone_number: string | null;
  last_connected_at: string | null;
}

export function UAZAPIConfig({ userId, onConfigured }: UAZAPIConfigProps) {
  const { toast } = useToast();
  const [config, setConfig] = useState<UAZAPIConfigData>({
    base_url: "",
    instance_token: "",
    instance_name: "",
    is_active: true,
    phone_number: null,
    last_connected_at: null
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [hasExisting, setHasExisting] = useState(false);

  useEffect(() => {
    loadConfig();
  }, [userId]);

  async function loadConfig() {
    try {
      const { data, error } = await supabase
        .from('uazapi_config')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setConfig({
          id: data.id,
          base_url: data.base_url,
          instance_token: data.instance_token,
          instance_name: data.instance_name || "",
          is_active: data.is_active,
          phone_number: data.phone_number,
          last_connected_at: data.last_connected_at
        });
        setHasExisting(true);
        onConfigured?.(true);
      } else {
        onConfigured?.(false);
      }
    } catch (error) {
      console.error('Error loading config:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar configuração",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleTest() {
    if (!config.base_url || !config.instance_token) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha a URL base e o token",
        variant: "destructive"
      });
      return;
    }

    setTesting(true);
    try {
      const baseUrl = config.base_url.replace(/\/$/, '');
      
      const { data, error } = await supabase.functions.invoke('whatsapp-session', {
        body: { 
          action: 'test',
          baseUrl: baseUrl,
          instanceToken: config.instance_token
        }
      });

      if (error) throw error;

      if (data?.success) {
        const phoneNumber = data.phoneNumber || data.phone_number;
        if (phoneNumber) {
          setConfig(prev => ({ ...prev, phone_number: phoneNumber }));
        }
        toast({
          title: "Sucesso",
          description: "Conexão testada com sucesso!"
        });
      } else {
        toast({
          title: "Falha na conexão",
          description: data?.message || "Verifique as credenciais.",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      console.error('Test error:', error);
      toast({
        title: "Erro",
        description: error?.message || "Erro ao testar conexão",
        variant: "destructive"
      });
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    if (!config.base_url || !config.instance_token) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha a URL base e o token",
        variant: "destructive"
      });
      return;
    }

    setSaving(true);
    try {
      const baseUrl = config.base_url.replace(/\/$/, '');
      
      const payload = {
        user_id: userId,
        base_url: baseUrl,
        instance_token: config.instance_token,
        instance_name: config.instance_name || null,
        is_active: true,
        phone_number: config.phone_number
      };

      if (hasExisting && config.id) {
        const { error } = await supabase
          .from('uazapi_config')
          .update(payload)
          .eq('id', config.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('uazapi_config')
          .insert(payload)
          .select()
          .single();

        if (error) throw error;
        
        setConfig(prev => ({ ...prev, id: data.id }));
        setHasExisting(true);
      }

      toast({
        title: "Sucesso",
        description: "Configuração salva com sucesso!"
      });
      onConfigured?.(true);
    } catch (error) {
      console.error('Save error:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar configuração",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!config.id) return;

    if (!confirm('Tem certeza que deseja remover a configuração?')) return;

    try {
      const { error } = await supabase
        .from('uazapi_config')
        .delete()
        .eq('id', config.id);

      if (error) throw error;

      setConfig({
        base_url: "",
        instance_token: "",
        instance_name: "",
        is_active: true,
        phone_number: null,
        last_connected_at: null
      });
      setHasExisting(false);
      onConfigured?.(false);
      toast({
        title: "Removido",
        description: "Configuração removida"
      });
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: "Erro",
        description: "Erro ao remover configuração",
        variant: "destructive"
      });
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Settings className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl">Configuração UAZAPI</CardTitle>
              <CardDescription>Configure suas credenciais da API WhatsApp</CardDescription>
            </div>
          </div>
          {hasExisting && (
            <Badge variant={config.is_active ? "default" : "secondary"}>
              {config.is_active ? (
                <><CheckCircle className="h-3 w-3 mr-1" /> Configurado</>
              ) : (
                <><XCircle className="h-3 w-3 mr-1" /> Inativo</>
              )}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="base_url">URL Base da Instância *</Label>
          <Input
            id="base_url"
            placeholder="https://sua-instancia.base360.com.br"
            value={config.base_url}
            onChange={(e) => setConfig(prev => ({ ...prev, base_url: e.target.value }))}
          />
          <p className="text-xs text-muted-foreground">
            Ex: https://instancia.base360.com.br
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="instance_token">Token da Instância *</Label>
          <div className="relative">
            <Input
              id="instance_token"
              type={showToken ? "text" : "password"}
              placeholder="Seu token de acesso"
              value={config.instance_token}
              onChange={(e) => setConfig(prev => ({ ...prev, instance_token: e.target.value }))}
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full"
              onClick={() => setShowToken(!showToken)}
            >
              {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="instance_name">Nome da Instância (opcional)</Label>
          <Input
            id="instance_name"
            placeholder="Minha Instância WhatsApp"
            value={config.instance_name}
            onChange={(e) => setConfig(prev => ({ ...prev, instance_name: e.target.value }))}
          />
          <p className="text-xs text-muted-foreground">
            Um nome para identificar esta configuração
          </p>
        </div>

        {config.phone_number && (
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm">
              <span className="text-muted-foreground">Número conectado:</span>{" "}
              <span className="font-medium">{config.phone_number}</span>
            </p>
          </div>
        )}

        <div className="flex gap-3 pt-4">
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={testing || !config.base_url || !config.instance_token}
          >
            {testing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <TestTube className="h-4 w-4 mr-2" />
            )}
            Testar Conexão
          </Button>
          
          <Button
            onClick={handleSave}
            disabled={saving || !config.base_url || !config.instance_token}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar
          </Button>

          {hasExisting && (
            <Button variant="destructive" onClick={handleDelete}>
              Remover
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
