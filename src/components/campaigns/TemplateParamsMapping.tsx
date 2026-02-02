/**
 * TemplateParamsMapping Component
 * 
 * Componente para mapeamento de parâmetros de template.
 * Exibe campos para cada variável esperada pelo template.
 */

import { useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import {
  extractTemplateVariables,
  generateDefaultMappings,
  resolveParamValue,
  validateMappings,
  CONTACT_FIELD_OPTIONS,
  type ParamMapping,
  type ContactData,
} from '@/utils/templateParams';

interface TemplateParamsMappingProps {
  components: unknown;
  variablesSchema: Record<string, unknown[]> | null;
  mappings: Record<string, string>;
  onMappingsChange: (mappings: Record<string, string>) => void;
  sampleContact?: ContactData | null;
}

export function TemplateParamsMapping({
  components,
  variablesSchema,
  mappings,
  onMappingsChange,
  sampleContact,
}: TemplateParamsMappingProps) {
  // Extrair informações de variáveis do template
  const templateVars = useMemo(() => {
    return extractTemplateVariables(components);
  }, [components]);
  
  // Gerar mapeamentos padrão
  const defaultMappings = useMemo(() => {
    return generateDefaultMappings(components, variablesSchema as never);
  }, [components, variablesSchema]);
  
  // Validar mapeamentos atuais
  const validation = useMemo(() => {
    return validateMappings(defaultMappings, mappings);
  }, [defaultMappings, mappings]);
  
  // Se não há variáveis, mostrar mensagem
  if (templateVars.total === 0) {
    return (
      <Alert className="bg-blue-500/10 border-blue-500/30">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-700 dark:text-blue-400">
          Este template não possui variáveis. A mensagem será enviada como está.
        </AlertDescription>
      </Alert>
    );
  }
  
  // Handler para mudança de valor
  const handleValueChange = (key: string, value: string) => {
    onMappingsChange({
      ...mappings,
      [key]: value,
    });
  };
  
  // Renderizar preview de valor resolvido
  const renderPreview = (mapping: ParamMapping): string => {
    if (!sampleContact) {
      return mapping.fallback || '(sem preview)';
    }
    return resolveParamValue(mapping, sampleContact, mappings);
  };
  
  return (
    <div className="space-y-4">
      {/* Header com resumo */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {templateVars.total} {templateVars.total === 1 ? 'variável' : 'variáveis'}
          </Badge>
          {validation.valid ? (
            <Badge className="bg-green-500/20 text-green-700 text-xs">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Mapeamento válido
            </Badge>
          ) : (
            <Badge className="bg-amber-500/20 text-amber-700 text-xs">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {validation.missingParams.length} parâmetro(s) faltando
            </Badge>
          )}
        </div>
      </div>
      
      {/* Campos de mapeamento */}
      <div className="space-y-3 bg-muted/30 rounded-lg p-4 border">
        {defaultMappings.map((mapping) => {
          const key = `${mapping.component}_${mapping.paramIndex}`;
          const currentValue = mappings[mapping.sourceKey] || '';
          const isMissingValue = !currentValue && !mapping.fallback;
          
          return (
            <div key={key} className="flex flex-col sm:flex-row sm:items-center gap-2">
              {/* Label com posição da variável */}
              <div className="flex items-center gap-2 min-w-[140px]">
                <Badge variant="secondary" className="font-mono text-xs">
                  {`{{${mapping.paramIndex}}}`}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {mapping.label}
                </span>
              </div>
              
              {/* Campo de mapeamento */}
              <div className="flex-1 flex items-center gap-2">
                {mapping.source === 'contact_field' ? (
                  // Para campos de contato, mostrar select
                  <Select
                    value={mapping.sourceKey}
                    disabled
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTACT_FIELD_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  // Para variáveis de campanha, mostrar input
                  <Input
                    value={currentValue}
                    onChange={(e) => handleValueChange(mapping.sourceKey, e.target.value)}
                    placeholder={mapping.fallback ? `Fallback: ${mapping.fallback}` : 'Digite o valor...'}
                    className={isMissingValue ? 'border-amber-500' : ''}
                  />
                )}
                
                {/* Indicador de status */}
                {mapping.source === 'contact_field' && (
                  <Badge className="bg-blue-500/20 text-blue-700 text-xs whitespace-nowrap">
                    Campo do contato
                  </Badge>
                )}
                
                {!currentValue && mapping.fallback && (
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    → Fallback: "{mapping.fallback}"
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Preview (se tiver contato de amostra) */}
      {sampleContact && (
        <div className="bg-muted/50 rounded-lg p-3 border">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Preview com "{sampleContact.name || sampleContact.phone}":
          </p>
          <div className="flex flex-wrap gap-2">
            {defaultMappings.map((mapping) => {
              const preview = renderPreview(mapping);
              return (
                <Badge key={`preview-${mapping.paramIndex}`} variant="secondary">
                  {`{{${mapping.paramIndex}}}`} = "{preview}"
                </Badge>
              );
            })}
          </div>
        </div>
      )}
      
      {/* Avisos */}
      {validation.warnings.length > 0 && (
        <Alert className="bg-amber-500/10 border-amber-500/30">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-700 dark:text-amber-400 text-sm">
            {validation.warnings.map((w, i) => (
              <span key={i} className="block">{w}</span>
            ))}
          </AlertDescription>
        </Alert>
      )}
      
      {/* Info sobre primeiro nome */}
      <p className="text-xs text-muted-foreground">
        💡 O primeiro parâmetro usa automaticamente o primeiro nome do contato.
        Se o contato não tiver nome, será usado o fallback "Olá".
      </p>
    </div>
  );
}
