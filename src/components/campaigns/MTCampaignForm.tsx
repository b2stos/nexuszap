/**
 * MTCampaignForm - Formulário de criação de campanha multi-tenant
 * 
 * Baseado exclusivamente em templates aprovados
 */

import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { 
  Loader2, 
  Send, 
  FileText, 
  Users, 
  Zap, 
  Gauge, 
  Snail,
  Search,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useChannels } from "@/hooks/useChannels";
import { useApprovedTemplates, useCurrentTenantForTemplates } from "@/hooks/useTemplates";
import { useMTContacts, useMTContactsCount } from "@/hooks/useMTContacts";
import { useCreateMTCampaign, useCurrentTenantForCampaigns } from "@/hooks/useMTCampaigns";

type SendSpeed = 'slow' | 'normal' | 'fast';

interface VariableInput {
  key: string;
  value: string;
  label: string;
}

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
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [variables, setVariables] = useState<Record<string, string>>({});
  
  // Data fetching - only enable when tenantId is available
  const { data: channels, isLoading: channelsLoading } = useChannels(tenantId);
  const { data: templates, isLoading: templatesLoading } = useApprovedTemplates(tenantId);
  const { data: contacts, isLoading: contactsLoading } = useMTContacts(tenantId, { limit: 1000 });
  const { data: totalContacts } = useMTContactsCount(tenantId);
  
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
  
  // Filter contacts by search
  const filteredContacts = useMemo(() => {
    if (!contacts) return [];
    if (!searchTerm) return contacts;
    const term = searchTerm.toLowerCase();
    return contacts.filter(c => 
      c.name?.toLowerCase().includes(term) ||
      c.phone.includes(term)
    );
  }, [contacts, searchTerm]);
  
  // Track if initial selection has been made - use ref to avoid re-runs
  const initialSelectionRef = useRef(false);
  
  // Handle initial select all - only run once when contacts first load
  useEffect(() => {
    if (selectAll && contacts && contacts.length > 0 && !initialSelectionRef.current) {
      initialSelectionRef.current = true;
      setSelectedContactIds(contacts.map(c => c.id));
    }
  }, [selectAll, contacts]);
  
  // Toggle contact selection
  const toggleContact = (contactId: string) => {
    setSelectAll(false);
    setSelectedContactIds(prev => 
      prev.includes(contactId)
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    );
  };
  
  // Toggle all - manual action by user
  const handleSelectAllChange = (checked: boolean) => {
    setSelectAll(checked);
    if (checked && contacts) {
      setSelectedContactIds(contacts.map(c => c.id));
    } else {
      setSelectedContactIds([]);
    }
    // Mark as done since user manually interacted
    initialSelectionRef.current = true;
  };
  
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
    
    if (selectedContactIds.length === 0) {
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
          contact_ids: selectedContactIds,
        },
      });
      
      navigate("/dashboard/campaigns");
    } catch (error) {
      // Error handled by mutation
    }
  };
  
  // Loading state - include tenant loading
  const isLoading = tenantLoading || channelsLoading || templatesLoading || contactsLoading;
  
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
            <Label htmlFor="channel">Canal WhatsApp *</Label>
            <Select value={channelId} onValueChange={setChannelId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um canal" />
              </SelectTrigger>
              <SelectContent>
                {connectedChannels.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    Nenhum canal conectado
                  </div>
                ) : (
                  connectedChannels.map((channel) => (
                    <SelectItem key={channel.id} value={channel.id}>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        {channel.name}
                        {channel.phone_number && (
                          <span className="text-muted-foreground">
                            ({channel.phone_number})
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
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
          <Select value={templateId} onValueChange={setTemplateId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um template" />
            </SelectTrigger>
            <SelectContent>
              {!templates || templates.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Nenhum template aprovado encontrado
                </div>
              ) : (
                templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {template.category}
                      </Badge>
                      {template.name}
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          
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
        </CardContent>
      </Card>
      
      {/* Contact Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Destinatários
          </CardTitle>
          <CardDescription>
            Selecione os contatos que receberão a campanha
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Stats */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <span className="text-sm">
              Total de contatos: <strong>{totalContacts || 0}</strong>
            </span>
            <span className="text-sm">
              Selecionados: <strong className="text-primary">{selectedContactIds.length}</strong>
            </span>
          </div>
          
          {/* Search & Select All */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar contatos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="select-all"
                checked={selectAll}
                onCheckedChange={(checked) => handleSelectAllChange(!!checked)}
              />
              <Label htmlFor="select-all" className="text-sm cursor-pointer">
                Selecionar todos
              </Label>
            </div>
          </div>
          
          {/* Contact List */}
          <ScrollArea className="h-[300px] rounded-md border">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Users className="h-8 w-8 mb-2" />
                <p>Nenhum contato encontrado</p>
              </div>
            ) : (
              <div className="p-4 space-y-2">
                {filteredContacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                    onClick={() => toggleContact(contact.id)}
                  >
                    <Checkbox
                      checked={selectedContactIds.includes(contact.id)}
                      onCheckedChange={() => toggleContact(contact.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {contact.name || 'Sem nome'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {contact.phone}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
      
      {/* Submit */}
      <div className="flex items-center justify-between pt-4 border-t">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {selectedContactIds.length > 0 ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              {selectedContactIds.length} contato(s) selecionado(s)
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
            disabled={createCampaign.isPending || selectedContactIds.length === 0}
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
