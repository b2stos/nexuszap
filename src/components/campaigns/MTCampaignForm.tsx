/**
 * MTCampaignForm - Formulário de criação de campanha multi-tenant
 * 
 * Baseado exclusivamente em templates aprovados
 * Usa CampaignRecipients para seleção com limite BM e fila de envio
 */

import { useState, useMemo, useEffect, useRef, useCallback, memo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  Loader2, 
  Send, 
  FileText, 
  Zap, 
  Gauge, 
  Snail,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  Check,
} from "lucide-react";
import { useChannels } from "@/hooks/useChannels";
import { useApprovedTemplates } from "@/hooks/useTemplates";
import { useCreateMTCampaign, useCurrentTenantForCampaigns } from "@/hooks/useMTCampaigns";
import { CampaignRecipients } from "./CampaignRecipients";

type SendSpeed = 'slow' | 'normal' | 'fast';

// Memoized channel option to prevent ref instability
const ChannelOption = memo(function ChannelOption({ 
  channel, 
  isSelected, 
  onSelect 
}: { 
  channel: { id: string; name: string; phone_number: string | null }; 
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <div
      onClick={() => onSelect(channel.id)}
      className={`p-3 rounded-md cursor-pointer transition-colors ${
        isSelected 
          ? 'bg-primary text-primary-foreground' 
          : 'bg-muted/50 hover:bg-muted'
      }`}
    >
      <div className="flex items-center gap-2">
        <CheckCircle2 className={`h-4 w-4 ${isSelected ? 'opacity-100' : 'opacity-0'}`} />
        <span className="font-medium">{channel.name}</span>
      </div>
      {channel.phone_number && (
        <span className="text-xs opacity-70 ml-6">{channel.phone_number}</span>
      )}
    </div>
  );
});

// Custom dropdown selector for templates (avoids Radix ref issues)
const TemplateDropdown = memo(function TemplateDropdown({
  templates,
  selectedId,
  onSelect,
  isLoading,
}: {
  templates: Array<{ id: string; name: string; category: string }>;
  selectedId: string;
  onSelect: (id: string) => void;
  isLoading: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);
  
  const selectedTemplate = templates.find(t => t.id === selectedId);
  
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-4 bg-muted/30 rounded-md border">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">Carregando templates...</span>
      </div>
    );
  }
  
  if (templates.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground bg-muted/30 rounded-md border">
        Nenhum template aprovado encontrado
      </div>
    );
  }
  
  return (
    <div ref={dropdownRef} className="relative">
      {/* Trigger button - looks like a select */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        <span className={selectedTemplate ? 'text-foreground' : 'text-muted-foreground'}>
          {selectedTemplate 
            ? `${selectedTemplate.category} - ${selectedTemplate.name}` 
            : 'Selecione um template'
          }
        </span>
        <ChevronDown className={`h-4 w-4 opacity-50 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md max-h-[300px] overflow-y-auto">
          <div className="p-1">
            {templates.map((template) => (
              <div
                key={template.id}
                onClick={() => {
                  onSelect(template.id);
                  setIsOpen(false);
                }}
                className={`relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground ${
                  selectedId === template.id ? 'bg-accent' : ''
                }`}
              >
                <span className="mr-2 flex h-4 w-4 items-center justify-center">
                  {selectedId === template.id && <Check className="h-4 w-4" />}
                </span>
                <Badge variant="outline" className="mr-2 text-xs">
                  {template.category}
                </Badge>
                <span>{template.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

export function MTCampaignForm() {
  const navigate = useNavigate();
  
  // Tenant data
  const { data: tenantData, isLoading: tenantLoading } = useCurrentTenantForCampaigns();
  const tenantId = tenantData?.tenantId;
  const userId = tenantData?.userId;
  
  // Form state
  const [name, setName] = useState("");
  const [channelId, setChannelId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [sendSpeed, setSendSpeed] = useState<SendSpeed>("normal");
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [variables, setVariables] = useState<Record<string, string>>({});
  
  // Data fetching - only enable when tenantId is available
  const { data: channels, isLoading: channelsLoading } = useChannels(tenantId);
  const { data: templates, isLoading: templatesLoading } = useApprovedTemplates(tenantId);
  
  // Mutations
  const createCampaign = useCreateMTCampaign();
  
  // Filter connected channels - with safe defaults
  const connectedChannels = useMemo(() => {
    if (!channels) return [];
    return channels.filter(c => c.status === 'connected');
  }, [channels]);
  
  // Get selected template - with null safety
  const selectedTemplate = useMemo(() => {
    if (!templates || !templateId) return null;
    return templates.find(t => t.id === templateId) || null;
  }, [templates, templateId]);
  
  // Extract template variable keys as stable reference for comparison
  const templateVariableKeys = useMemo(() => {
    if (!selectedTemplate?.variables_schema) return '';
    const schema = selectedTemplate.variables_schema as { body?: Array<{ key: string; label: string }> };
    const vars = schema.body || [];
    return vars.map(v => v.key).join(',');
  }, [selectedTemplate]);
  
  // Extract template variables for rendering
  const templateVariables = useMemo(() => {
    if (!selectedTemplate?.variables_schema) return [];
    const schema = selectedTemplate.variables_schema as { body?: Array<{ key: string; label: string }> };
    return (schema.body || []).map(v => ({
      key: v.key,
      label: v.label || v.key,
    }));
  }, [selectedTemplate]);
  
  // Initialize variables when template changes - use stable key comparison
  const processedTemplateRef = useRef<string>("");
  
  useEffect(() => {
    // Create a stable key from templateId + variable keys
    const currentKey = `${templateId}:${templateVariableKeys}`;
    
    // Skip if no template or already processed this exact combination
    if (!templateId || currentKey === processedTemplateRef.current) return;
    
    // Mark as processed BEFORE setting state
    processedTemplateRef.current = currentKey;
    
    // Initialize with empty values
    const next: Record<string, string> = {};
    templateVariables.forEach(v => {
      next[v.key] = '';
    });
    setVariables(next);
  }, [templateId, templateVariableKeys, templateVariables]);
  
  // Memoized callbacks for channel/template selection - prevents ref instability
  const handleChannelSelect = useCallback((id: string) => {
    setChannelId(id);
  }, []);
  
  const handleTemplateSelect = useCallback((id: string) => {
    setTemplateId(id);
  }, []);
  
  // Handle selection change from CampaignRecipients component
  const handleSelectionChange = useCallback((ids: Set<string>) => {
    setSelectedContactIds(ids);
  }, []);
  
  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!tenantId || !userId) {
      toast.error("Sessão inválida");
      return;
    }
    
    if (!name.trim()) {
      toast.error("Nome da campanha é obrigatório");
      return;
    }
    
    if (!channelId) {
      toast.error("Selecione um canal");
      return;
    }
    
    if (!templateId) {
      toast.error("Selecione um template");
      return;
    }
    
    if (selectedContactIds.size === 0) {
      toast.error("Selecione pelo menos um contato");
      return;
    }
    
    try {
      await createCampaign.mutateAsync({
        tenantId,
        userId,
        input: {
          name: name.trim(),
          channel_id: channelId,
          template_id: templateId,
          template_variables: variables,
          contact_ids: Array.from(selectedContactIds),
        },
      });
      
      navigate("/dashboard/campaigns");
    } catch (error) {
      // Error handled by mutation
    }
  };
  
  // Loading state
  const isDataLoading = channelsLoading || templatesLoading;
  
  // Show loading spinner while tenant data is loading
  if (tenantLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Carregando...</span>
      </div>
    );
  }
  
  // Show error if no tenant found
  if (!tenantId) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <p className="text-muted-foreground">Sessão inválida. Faça login novamente.</p>
          <Button 
            variant="outline" 
            className="mt-4"
            onClick={() => navigate("/auth")}
          >
            Fazer Login
          </Button>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Detalhes da Campanha
          </CardTitle>
          <CardDescription>
            Configure os dados básicos da sua campanha
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome da Campanha *</Label>
            <Input
              id="name"
              placeholder="Ex: Promoção de Janeiro"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label>Canal WhatsApp *</Label>
            {channelsLoading ? (
              <div className="flex items-center gap-2 p-4 bg-muted/30 rounded-md">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Carregando canais...</span>
              </div>
            ) : connectedChannels.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground bg-muted/30 rounded-md">
                Nenhum canal conectado
              </div>
            ) : (
              <div className="grid gap-2">
                {connectedChannels.map((channel) => (
                  <ChannelOption
                    key={channel.id}
                    channel={channel}
                    isSelected={channelId === channel.id}
                    onSelect={handleChannelSelect}
                  />
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Template Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Template de Mensagem *</CardTitle>
          <CardDescription>
            Apenas templates aprovados podem ser usados em campanhas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <TemplateDropdown
            templates={templates ?? []}
            selectedId={templateId}
            onSelect={handleTemplateSelect}
            isLoading={templatesLoading}
          />
          
          {/* Template Preview & Variables */}
          {selectedTemplate && (
            <div className="mt-4 p-4 rounded-lg bg-muted/50 border">
              <div className="flex items-center gap-2 mb-3">
                <Badge className="bg-green-500">Aprovado</Badge>
                <span className="text-sm text-muted-foreground">
                  Idioma: {selectedTemplate.language}
                </span>
              </div>
              
              {templateVariables.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Variáveis do Template</Label>
                  {templateVariables.map((v, idx) => (
                    <div key={v.key} className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground min-w-[100px]">
                        {`{{${idx + 1}}}`} - {v.label}:
                      </span>
                      <Input
                        placeholder={`Valor para ${v.label}`}
                        value={variables[v.key] || ''}
                        onChange={(e) => setVariables(prev => ({
                          ...prev,
                          [v.key]: e.target.value,
                        }))}
                        className="flex-1"
                      />
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground">
                    Use "nome" para substituir automaticamente pelo nome do contato
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Speed Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Velocidade de Envio</CardTitle>
          <CardDescription>
            Velocidade mais lenta reduz o risco de bloqueio
          </CardDescription>
        </CardHeader>
        <CardContent>
          <fieldset className="grid grid-cols-3 gap-4" aria-label="Velocidade de envio">
            <div>
              <input
                type="radio"
                id="speed-slow"
                name="sendSpeed"
                value="slow"
                checked={sendSpeed === "slow"}
                onChange={() => setSendSpeed("slow")}
                className="peer sr-only"
              />
              <Label
                htmlFor="speed-slow"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-checked:border-primary cursor-pointer"
              >
                <Snail className="mb-2 h-6 w-6 text-green-500" />
                <span className="text-sm font-medium">Lento</span>
                <span className="text-xs text-muted-foreground text-center mt-1">
                  ~3s entre msgs
                </span>
              </Label>
            </div>

            <div>
              <input
                type="radio"
                id="speed-normal"
                name="sendSpeed"
                value="normal"
                checked={sendSpeed === "normal"}
                onChange={() => setSendSpeed("normal")}
                className="peer sr-only"
              />
              <Label
                htmlFor="speed-normal"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-checked:border-primary cursor-pointer"
              >
                <Gauge className="mb-2 h-6 w-6 text-blue-500" />
                <span className="text-sm font-medium">Normal</span>
                <span className="text-xs text-muted-foreground text-center mt-1">
                  ~1.5s entre msgs
                </span>
              </Label>
            </div>

            <div>
              <input
                type="radio"
                id="speed-fast"
                name="sendSpeed"
                value="fast"
                checked={sendSpeed === "fast"}
                onChange={() => setSendSpeed("fast")}
                className="peer sr-only"
              />
              <Label
                htmlFor="speed-fast"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-checked:border-primary cursor-pointer"
              >
                <Zap className="mb-2 h-6 w-6 text-yellow-500" />
                <span className="text-sm font-medium">Rápido</span>
                <span className="text-xs text-muted-foreground text-center mt-1">
                  ~0.8s entre msgs
                </span>
              </Label>
            </div>
          </fieldset>
        </CardContent>
      </Card>
      
      {/* Recipients Selection - New component with BM limit */}
      {tenantId && (
        <CampaignRecipients
          tenantId={tenantId}
          selectedContactIds={selectedContactIds}
          onSelectionChange={handleSelectionChange}
        />
      )}
      
      {/* Submit */}
      <div className="flex items-center justify-between pt-4 border-t">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {selectedContactIds.size > 0 ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              {selectedContactIds.size} contato(s) selecionado(s)
            </>
          ) : (
            <>
              <AlertCircle className="h-4 w-4 text-yellow-500" />
              Selecione os destinatários
            </>
          )}
        </div>
        
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/dashboard/campaigns")}
          >
            Cancelar
          </Button>
          <Button 
            type="submit" 
            disabled={createCampaign.isPending || selectedContactIds.size === 0}
          >
            {createCampaign.isPending ? (
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
      </div>
    </form>
  );
}
