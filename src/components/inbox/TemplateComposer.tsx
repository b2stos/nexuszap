/**
 * TemplateComposer Component
 * 
 * Componente para envio de templates quando a janela 24h está fechada
 */

import { useState, useEffect, useMemo } from 'react';
import { Send, Loader2, FileText, AlertCircle, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Template, TemplateVariable, TemplateVariablesSchema } from '@/hooks/useTemplates';
import { cn } from '@/lib/utils';

interface TemplateComposerProps {
  templates: Template[];
  isLoadingTemplates: boolean;
  onSend: (templateId: string, variables: Record<string, string>) => Promise<void>;
  isSending: boolean;
  disabled?: boolean;
}

export function TemplateComposer({
  templates,
  isLoadingTemplates,
  onSend,
  isSending,
  disabled = false,
}: TemplateComposerProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [isOpen, setIsOpen] = useState(true);
  
  // Get selected template
  const selectedTemplate = useMemo(() => {
    return templates.find(t => t.id === selectedTemplateId) || null;
  }, [templates, selectedTemplateId]);
  
  // Get all variables from schema
  const allVariables = useMemo(() => {
    if (!selectedTemplate?.variables_schema) return [];
    
    const schema = selectedTemplate.variables_schema as TemplateVariablesSchema;
    const vars: (TemplateVariable & { section: string })[] = [];
    
    if (schema.header) {
      schema.header.forEach(v => vars.push({ ...v, section: 'header' }));
    }
    if (schema.body) {
      schema.body.forEach(v => vars.push({ ...v, section: 'body' }));
    }
    if (schema.button) {
      schema.button.forEach(v => vars.push({ ...v, section: 'button' }));
    }
    
    return vars;
  }, [selectedTemplate]);
  
  // Reset variables when template changes
  useEffect(() => {
    setVariables({});
  }, [selectedTemplateId]);
  
  // Check if all required variables are filled
  const isValid = useMemo(() => {
    if (!selectedTemplateId) return false;
    
    for (const variable of allVariables) {
      if (variable.required && !variables[variable.key]?.trim()) {
        return false;
      }
    }
    
    return true;
  }, [selectedTemplateId, allVariables, variables]);
  
  // Handle send
  const handleSend = async () => {
    if (!selectedTemplateId || !isValid || isSending) return;
    
    try {
      await onSend(selectedTemplateId, variables);
      // Reset form
      setSelectedTemplateId('');
      setVariables({});
    } catch (error) {
      // Error handled by parent
      console.error('Template send error:', error);
    }
  };
  
  // Handle variable change
  const handleVariableChange = (key: string, value: string) => {
    setVariables(prev => ({ ...prev, [key]: value }));
  };
  
  // Approved templates only
  const approvedTemplates = templates.filter(t => t.status === 'approved');
  
  return (
    <div className="p-4 border-t border-border bg-card">
      {/* Warning */}
      <Alert className="mb-4 bg-amber-500/10 border-amber-500/30">
        <AlertCircle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-700 dark:text-amber-400">
          Fora da janela de 24h. Envie um template aprovado para retomar a conversa.
        </AlertDescription>
      </Alert>
      
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between mb-3">
            <span className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Enviar Template
            </span>
            <ChevronDown className={cn(
              "h-4 w-4 transition-transform",
              isOpen && "rotate-180"
            )} />
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent className="space-y-4">
          {/* Template selector */}
          <div className="space-y-2">
            <Label>Template</Label>
            {isLoadingTemplates ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando templates...
              </div>
            ) : approvedTemplates.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum template aprovado disponível.{' '}
                <a href="/dashboard/templates" className="text-primary underline">
                  Cadastrar templates
                </a>
              </p>
            ) : (
              <Select
                value={selectedTemplateId}
                onValueChange={setSelectedTemplateId}
                disabled={disabled || isSending}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um template..." />
                </SelectTrigger>
                <SelectContent>
                  {approvedTemplates.map(template => (
                    <SelectItem key={template.id} value={template.id}>
                      <div className="flex items-center gap-2">
                        <span>{template.name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({template.language})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          
          {/* Variables */}
          {selectedTemplate && allVariables.length > 0 && (
            <div className="space-y-3">
              <Label>Variáveis</Label>
              <div className="grid gap-3">
                {allVariables.map((variable) => (
                  <div key={variable.key} className="space-y-1">
                    <Label 
                      htmlFor={variable.key}
                      className="text-sm font-normal flex items-center gap-1"
                    >
                      {variable.label || variable.key}
                      {variable.required && (
                        <span className="text-destructive">*</span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        ({variable.section})
                      </span>
                    </Label>
                    <Input
                      id={variable.key}
                      value={variables[variable.key] || ''}
                      onChange={(e) => handleVariableChange(variable.key, e.target.value)}
                      placeholder={`Digite ${variable.label || variable.key}...`}
                      disabled={disabled || isSending}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Preview */}
          {selectedTemplate && (
            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              <p className="font-medium mb-1">Preview:</p>
              <p className="text-muted-foreground">
                Template: <strong>{selectedTemplate.name}</strong>
                {allVariables.length > 0 && (
                  <span className="block mt-1">
                    Variáveis: {allVariables.map(v => 
                      `${v.key}="${variables[v.key] || '...'}"`
                    ).join(', ')}
                  </span>
                )}
              </p>
            </div>
          )}
          
          {/* Send button */}
          <Button
            onClick={handleSend}
            disabled={!isValid || isSending || disabled}
            className="w-full"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Enviar Template
          </Button>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
