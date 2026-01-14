/**
 * TemplateBuilder Component
 * 
 * Construtor visual de templates WhatsApp sem JSON
 * Detecta variáveis automaticamente e valida em tempo real
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FileText,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle,
  Info,
  Sparkles,
  ChevronDown,
  Image as ImageIcon,
  Video,
  File,
  Phone,
  ExternalLink,
  MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  TemplateComponent,
  TemplateButton,
  DetectedVariable,
  HeaderFormat,
  ButtonType,
  parseTemplateComponents,
  validateTemplateForSave,
  ValidationResult,
} from '@/utils/templateParser';
type LocalHeaderFormat = 'NONE' | 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';

import {
  TEMPLATE_PRESETS,
  TemplatePreset,
  getPresetsByCategory,
  getCategoryLabel,
} from '@/utils/templatePresets';

// ===================================
// TYPES
// ===================================

interface TemplateBuilderProps {
  initialName?: string;
  initialLanguage?: string;
  initialCategory?: string;
  initialStatus?: 'approved' | 'pending' | 'rejected';
  initialComponents?: TemplateComponent[];
  initialVariables?: DetectedVariable[];
  onSave: (data: TemplateBuilderOutput) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  isEditing?: boolean;
}

export interface TemplateBuilderOutput {
  name: string;
  language: string;
  category: string;
  status: 'approved' | 'pending' | 'rejected';
  components: TemplateComponent[];
  variables: DetectedVariable[];
}

// ===================================
// SUB-COMPONENTS
// ===================================

function PresetSelector({
  onSelect,
}: {
  onSelect: (preset: TemplatePreset) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const presetsByCategory = getPresetsByCategory();

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="outline" className="w-full justify-between">
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Escolher modelo pronto
          </span>
          <ChevronDown
            className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')}
          />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3">
        <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
          {Object.entries(presetsByCategory).map(([category, presets]) => (
            <div key={category}>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">
                {getCategoryLabel(category)}
              </h4>
              <div className="grid gap-2">
                {presets.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => {
                      onSelect(preset);
                      setIsOpen(false);
                    }}
                    className="flex flex-col items-start p-3 rounded-lg border bg-card hover:bg-accent hover:border-primary/50 transition-colors text-left"
                  >
                    <span className="font-medium text-sm">{preset.displayName}</span>
                    <span className="text-xs text-muted-foreground">
                      {preset.description}
                    </span>
                    <div className="flex gap-1 mt-2">
                      <Badge variant="outline" className="text-xs">
                        {preset.variables.length} variável(is)
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function HeaderSection({
  format,
  text,
  mediaUrl,
  onFormatChange,
  onTextChange,
  onMediaUrlChange,
}: {
  format: LocalHeaderFormat;
  text: string;
  mediaUrl: string;
  onFormatChange: (format: LocalHeaderFormat) => void;
  onTextChange: (text: string) => void;
  onMediaUrlChange: (url: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Header (opcional)</Label>
        <Select value={format} onValueChange={(v) => onFormatChange(v as LocalHeaderFormat)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="NONE">
              <span className="flex items-center gap-2">Nenhum</span>
            </SelectItem>
            <SelectItem value="TEXT">
              <span className="flex items-center gap-2">
                <FileText className="h-3 w-3" />
                Texto
              </span>
            </SelectItem>
            <SelectItem value="IMAGE">
              <span className="flex items-center gap-2">
                <ImageIcon className="h-3 w-3" />
                Imagem
              </span>
            </SelectItem>
            <SelectItem value="VIDEO">
              <span className="flex items-center gap-2">
                <Video className="h-3 w-3" />
                Vídeo
              </span>
            </SelectItem>
            <SelectItem value="DOCUMENT">
              <span className="flex items-center gap-2">
                <File className="h-3 w-3" />
                Documento
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {format === 'TEXT' && (
        <div>
          <Input
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            placeholder="Ex: ✅ Pedido Confirmado!"
            maxLength={60}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Até 60 caracteres. Pode usar emojis.
          </p>
        </div>
      )}

      {(format === 'IMAGE' || format === 'VIDEO' || format === 'DOCUMENT') && (
        <div>
          <Input
            value={mediaUrl}
            onChange={(e) => onMediaUrlChange(e.target.value)}
            placeholder="https://exemplo.com/arquivo"
          />
          <p className="text-xs text-muted-foreground mt-1">
            URL pública do arquivo de mídia.
          </p>
        </div>
      )}
    </div>
  );
}

function BodySection({
  text,
  onChange,
}: {
  text: string;
  onChange: (text: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">
          Corpo da Mensagem <span className="text-destructive">*</span>
        </Label>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-4 w-4 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-[300px]">
              <p>
                Use {'{{1}}'}, {'{{2}}'}, etc. para criar variáveis dinâmicas.
                A plataforma detectará automaticamente.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <Textarea
        value={text}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Ex: Olá {{1}}! Seu pedido #{{2}} foi confirmado.`}
        rows={5}
        className="font-mono text-sm"
      />
      <p className="text-xs text-muted-foreground">
        Até 1024 caracteres. Use {'{{1}}'}, {'{{2}}'} para variáveis.
      </p>
    </div>
  );
}

function FooterSection({
  text,
  onChange,
}: {
  text: string;
  onChange: (text: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Rodapé (opcional)</Label>
      <Input
        value={text}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ex: Obrigado pela preferência!"
        maxLength={60}
      />
      <p className="text-xs text-muted-foreground">Até 60 caracteres.</p>
    </div>
  );
}

function ButtonsSection({
  buttons,
  onChange,
}: {
  buttons: TemplateButton[];
  onChange: (buttons: TemplateButton[]) => void;
}) {
  const addButton = (type: ButtonType) => {
    if (buttons.length >= 3) return;
    onChange([
      ...buttons,
      {
        type,
        text: '',
        url: type === 'URL' ? '' : undefined,
        phone_number: type === 'PHONE_NUMBER' ? '' : undefined,
      },
    ]);
  };

  const updateButton = (index: number, updates: Partial<TemplateButton>) => {
    const newButtons = [...buttons];
    newButtons[index] = { ...newButtons[index], ...updates };
    onChange(newButtons);
  };

  const removeButton = (index: number) => {
    onChange(buttons.filter((_, i) => i !== index));
  };

  const getButtonIcon = (type: ButtonType) => {
    switch (type) {
      case 'URL':
        return <ExternalLink className="h-3 w-3" />;
      case 'PHONE_NUMBER':
        return <Phone className="h-3 w-3" />;
      case 'QUICK_REPLY':
        return <MessageSquare className="h-3 w-3" />;
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Botões (opcional)</Label>
        <span className="text-xs text-muted-foreground">{buttons.length}/3</span>
      </div>

      {buttons.map((button, index) => (
        <div key={index} className="flex gap-2 items-start p-3 border rounded-lg bg-muted/30">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              {getButtonIcon(button.type)}
              <Badge variant="outline" className="text-xs">
                {button.type === 'URL' && 'Link'}
                {button.type === 'PHONE_NUMBER' && 'Telefone'}
                {button.type === 'QUICK_REPLY' && 'Resposta Rápida'}
              </Badge>
            </div>
            <Input
              value={button.text}
              onChange={(e) => updateButton(index, { text: e.target.value })}
              placeholder="Texto do botão"
              maxLength={25}
            />
            {button.type === 'URL' && (
              <div className="space-y-1">
                <Input
                  value={button.url || ''}
                  onChange={(e) => updateButton(index, { url: e.target.value })}
                  placeholder="https://exemplo.com"
                />
                <div className="flex items-center gap-2">
                  <Switch
                    checked={button.url_suffix_variable || false}
                    onCheckedChange={(checked) =>
                      updateButton(index, { url_suffix_variable: checked })
                    }
                  />
                  <span className="text-xs text-muted-foreground">
                    URL dinâmica (com variável)
                  </span>
                </div>
              </div>
            )}
            {button.type === 'PHONE_NUMBER' && (
              <Input
                value={button.phone_number || ''}
                onChange={(e) => updateButton(index, { phone_number: e.target.value })}
                placeholder="+5511999999999"
              />
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => removeButton(index)}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}

      {buttons.length < 3 && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => addButton('QUICK_REPLY')}
            className="flex-1"
          >
            <Plus className="h-3 w-3 mr-1" />
            Resposta Rápida
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => addButton('URL')}
            className="flex-1"
          >
            <Plus className="h-3 w-3 mr-1" />
            Link
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => addButton('PHONE_NUMBER')}
            className="flex-1"
          >
            <Plus className="h-3 w-3 mr-1" />
            Telefone
          </Button>
        </div>
      )}
    </div>
  );
}

function VariablesEditor({
  variables,
  onChange,
  validation,
}: {
  variables: DetectedVariable[];
  onChange: (variables: DetectedVariable[]) => void;
  validation: ValidationResult;
}) {
  const updateVariable = (index: number, updates: Partial<DetectedVariable>) => {
    const newVars = [...variables];
    newVars[index] = { ...newVars[index], ...updates };
    onChange(newVars);
  };

  if (variables.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">
          Nenhuma variável detectada. Use {'{{1}}'}, {'{{2}}'} no texto.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Errors */}
      {validation.errors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc list-inside space-y-1">
              {validation.errors.map((error, i) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Warnings */}
      {validation.warnings.length > 0 && (
        <Alert className="bg-amber-500/10 border-amber-500/30">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-700 dark:text-amber-400">
            <ul className="list-disc list-inside space-y-1">
              {validation.warnings.map((warning, i) => (
                <li key={i}>{warning}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Variables list */}
      <div className="space-y-2">
        {variables.map((variable, index) => (
          <div
            key={`${variable.section}-${variable.index}`}
            className="grid grid-cols-12 gap-2 items-center p-3 border rounded-lg bg-muted/30"
          >
            <div className="col-span-2">
              <Badge variant="secondary" className="font-mono">
                {`{{${variable.index}}}`}
              </Badge>
            </div>
            <div className="col-span-2">
              <Badge variant="outline" className="text-xs">
                {variable.section}
              </Badge>
            </div>
            <div className="col-span-4">
              <Input
                value={variable.label}
                onChange={(e) => updateVariable(index, { label: e.target.value })}
                placeholder="Nome da variável"
                className="h-8 text-sm"
              />
            </div>
            <div className="col-span-3">
              <Input
                value={variable.example}
                onChange={(e) => updateVariable(index, { example: e.target.value })}
                placeholder="Exemplo"
                className="h-8 text-sm"
              />
            </div>
            <div className="col-span-1 flex justify-center">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Switch
                      checked={variable.required}
                      onCheckedChange={(checked) =>
                        updateVariable(index, { required: checked })
                      }
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    {variable.required ? 'Obrigatória' : 'Opcional'}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Configure o nome (label) e exemplo de cada variável. Variáveis obrigatórias
        devem ser preenchidas no disparo.
      </p>
    </div>
  );
}

// ===================================
// MAIN COMPONENT
// ===================================

export function TemplateBuilder({
  initialName = '',
  initialLanguage = 'pt_BR',
  initialCategory = 'MARKETING',
  initialStatus = 'approved',
  initialComponents = [],
  initialVariables = [],
  onSave,
  onCancel,
  isLoading = false,
  isEditing = false,
}: TemplateBuilderProps) {
  // Form state
  const [name, setName] = useState(initialName);
  const [language, setLanguage] = useState(initialLanguage);
  const [category, setCategory] = useState(initialCategory);
  const [status, setStatus] = useState(initialStatus);

  // Component state
  const [headerFormat, setHeaderFormat] = useState<LocalHeaderFormat>('NONE');
  const [headerText, setHeaderText] = useState('');
  const [headerMediaUrl, setHeaderMediaUrl] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [footerText, setFooterText] = useState('');
  const [buttons, setButtons] = useState<TemplateButton[]>([]);

  // Variables state
  const [variables, setVariables] = useState<DetectedVariable[]>(initialVariables);

  // Initialize from initial components
  useEffect(() => {
    if (initialComponents.length > 0) {
      initialComponents.forEach((comp) => {
        switch (comp.type) {
          case 'HEADER':
            setHeaderFormat((comp.format as LocalHeaderFormat) || 'NONE');
            setHeaderText(comp.text || '');
            setHeaderMediaUrl(comp.media_url || '');
            break;
          case 'BODY':
            setBodyText(comp.text || '');
            break;
          case 'FOOTER':
            setFooterText(comp.text || '');
            break;
          case 'BUTTONS':
            setButtons(comp.buttons || []);
            break;
        }
      });
    }
  }, []);

  // Build components array
  const components = useMemo<TemplateComponent[]>(() => {
    const result: TemplateComponent[] = [];

    if (headerFormat !== 'NONE') {
      result.push({
        type: 'HEADER',
        format: headerFormat as HeaderFormat,
        text: headerFormat === 'TEXT' ? headerText : undefined,
        media_url: headerFormat !== 'TEXT' ? headerMediaUrl : undefined,
      });
    }

    result.push({
      type: 'BODY',
      text: bodyText,
    });

    if (footerText.trim()) {
      result.push({
        type: 'FOOTER',
        text: footerText,
      });
    }

    if (buttons.length > 0) {
      result.push({
        type: 'BUTTONS',
        buttons,
      });
    }

    return result;
  }, [headerFormat, headerText, headerMediaUrl, bodyText, footerText, buttons]);

  // Parse variables from components
  const parseResult = useMemo(() => {
    return parseTemplateComponents(components, variables);
  }, [components, variables]);

  // Update variables when parsing detects changes
  useEffect(() => {
    const parsed = parseResult.variables;
    
    // Merge with existing variables to preserve labels
    const merged = parsed.map((p) => {
      const existing = variables.find(
        (v) => v.section === p.section && v.index === p.index
      );
      return existing ? { ...p, label: existing.label, required: existing.required, example: existing.example } : p;
    });
    
    // Only update if different
    if (JSON.stringify(merged) !== JSON.stringify(variables)) {
      setVariables(merged);
    }
  }, [parseResult.variables]);

  // Validate for save
  const saveValidation = useMemo(() => {
    return validateTemplateForSave(name, components, variables);
  }, [name, components, variables]);

  // Handle preset selection
  const handlePresetSelect = useCallback((preset: TemplatePreset) => {
    setName(preset.name);
    setLanguage(preset.language);
    setCategory(preset.category);
    setVariables(preset.variables);

    // Apply components
    preset.components.forEach((comp) => {
      switch (comp.type) {
        case 'HEADER':
          setHeaderFormat(comp.format || 'NONE');
          setHeaderText(comp.text || '');
          setHeaderMediaUrl(comp.media_url || '');
          break;
        case 'BODY':
          setBodyText(comp.text || '');
          break;
        case 'FOOTER':
          setFooterText(comp.text || '');
          break;
        case 'BUTTONS':
          setButtons(comp.buttons || []);
          break;
      }
    });
  }, []);

  // Handle save
  const handleSave = async () => {
    if (!saveValidation.isValid) return;

    await onSave({
      name,
      language,
      category,
      status,
      components,
      variables,
    });
  };

  return (
    <div className="space-y-6 max-h-[70vh] overflow-y-auto px-1">
      {/* Preset Selector (only for new templates) */}
      {!isEditing && (
        <PresetSelector onSelect={handlePresetSelect} />
      )}

      <Separator />

      {/* Basic Info */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Informações Básicas
        </h3>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="name">
              Nome do Template <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
              placeholder="hello_world"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Apenas letras minúsculas, números e underscores.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label>Idioma</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pt_BR">Português (BR)</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="es">Español</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MARKETING">Marketing</SelectItem>
                  <SelectItem value="UTILITY">Utilitário</SelectItem>
                  <SelectItem value="AUTHENTICATION">Autenticação</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="approved">
                    <span className="flex items-center gap-2">
                      <CheckCircle className="h-3 w-3 text-green-500" />
                      Aprovado
                    </span>
                  </SelectItem>
                  <SelectItem value="pending">
                    <span className="flex items-center gap-2">
                      <AlertCircle className="h-3 w-3 text-yellow-500" />
                      Pendente
                    </span>
                  </SelectItem>
                  <SelectItem value="rejected">
                    <span className="flex items-center gap-2">
                      <AlertCircle className="h-3 w-3 text-red-500" />
                      Rejeitado
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* Template Content */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold">Conteúdo do Template</h3>

        <HeaderSection
          format={headerFormat}
          text={headerText}
          mediaUrl={headerMediaUrl}
          onFormatChange={setHeaderFormat}
          onTextChange={setHeaderText}
          onMediaUrlChange={setHeaderMediaUrl}
        />

        <BodySection text={bodyText} onChange={setBodyText} />

        <FooterSection text={footerText} onChange={setFooterText} />

        <ButtonsSection buttons={buttons} onChange={setButtons} />
      </div>

      <Separator />

      {/* Variables */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          Variáveis Detectadas
          {variables.length > 0 && (
            <Badge variant="secondary">{variables.length}</Badge>
          )}
        </h3>

        <VariablesEditor
          variables={variables}
          onChange={setVariables}
          validation={parseResult.validation}
        />
      </div>

      <Separator />

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2 sticky bottom-0 bg-background pb-2">
        <Button variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancelar
        </Button>
        <Button
          onClick={handleSave}
          disabled={!saveValidation.isValid || isLoading}
        >
          {isLoading ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Criar Template'}
        </Button>
      </div>

      {/* Validation Summary */}
      {!saveValidation.isValid && (
        <Alert variant="destructive" className="mt-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc list-inside">
              {saveValidation.errors.slice(0, 3).map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
