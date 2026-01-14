/**
 * Template Variable Parser
 * 
 * Parser para detectar, validar e gerenciar placeholders {{1}}, {{2}}, etc.
 * em templates do WhatsApp
 */

// Regex para detectar placeholders no formato {{n}} onde n é um número inteiro >= 1
const PLACEHOLDER_REGEX = /\{\{(\d+)\}\}/g;

// Limite máximo de variáveis por seção
export const MAX_VARIABLES_PER_SECTION = 10;
export const MAX_TOTAL_VARIABLES = 20;

// Tipos de componentes do template
export type ComponentType = 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
export type HeaderFormat = 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
export type ButtonType = 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';

// Estrutura de uma variável detectada
export interface DetectedVariable {
  index: number;
  key: string;
  label: string;
  required: boolean;
  example: string;
  section: ComponentType;
}

// Estrutura de um botão
export interface TemplateButton {
  type: ButtonType;
  text: string;
  url?: string;
  phone_number?: string;
  url_suffix_variable?: boolean; // Se a URL tem {{1}} no final
}

// Componente do template (estrutura Meta/WhatsApp)
export interface TemplateComponent {
  type: ComponentType;
  format?: HeaderFormat;
  text?: string;
  buttons?: TemplateButton[];
  media_url?: string;
}

// Resultado da validação
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Resultado do parsing
export interface ParseResult {
  variables: DetectedVariable[];
  validation: ValidationResult;
}

/**
 * Extrai todos os índices de placeholders de um texto
 */
export function extractPlaceholderIndexes(text: string): number[] {
  const indexes: number[] = [];
  let match;
  
  // Reset regex state
  PLACEHOLDER_REGEX.lastIndex = 0;
  
  while ((match = PLACEHOLDER_REGEX.exec(text)) !== null) {
    const index = parseInt(match[1], 10);
    if (!indexes.includes(index)) {
      indexes.push(index);
    }
  }
  
  return indexes.sort((a, b) => a - b);
}

/**
 * Valida a sequência de placeholders (não pode haver buracos)
 * Ex: [1, 2, 3] é válido, [1, 3] é inválido
 */
export function validatePlaceholderSequence(indexes: number[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (indexes.length === 0) {
    return { isValid: true, errors, warnings };
  }
  
  // Verificar se começa com 1
  if (indexes[0] !== 1) {
    errors.push(`A primeira variável deve ser {{1}}, mas encontramos {{${indexes[0]}}}.`);
  }
  
  // Verificar se há buracos na sequência
  for (let i = 1; i < indexes.length; i++) {
    const expected = indexes[i - 1] + 1;
    if (indexes[i] !== expected) {
      const missing = [];
      for (let j = expected; j < indexes[i]; j++) {
        missing.push(`{{${j}}}`);
      }
      errors.push(`Faltando: ${missing.join(', ')}. A sequência deve ser contínua.`);
    }
  }
  
  // Verificar limite
  const maxIndex = Math.max(...indexes);
  if (maxIndex > MAX_VARIABLES_PER_SECTION) {
    warnings.push(`Limite de ${MAX_VARIABLES_PER_SECTION} variáveis por seção.`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Parse um texto e extrai as variáveis detectadas
 */
export function parseVariablesFromText(
  text: string,
  section: ComponentType,
  existingLabels?: Map<number, string>
): { variables: DetectedVariable[]; validation: ValidationResult } {
  const indexes = extractPlaceholderIndexes(text);
  const validation = validatePlaceholderSequence(indexes);
  
  const variables: DetectedVariable[] = indexes.map((index) => ({
    index,
    key: `var_${index}`,
    label: existingLabels?.get(index) || `Variável ${index}`,
    required: true,
    example: '',
    section,
  }));
  
  return { variables, validation };
}

/**
 * Parse completo de um template com todos os componentes
 */
export function parseTemplateComponents(
  components: TemplateComponent[],
  existingVariables?: DetectedVariable[]
): ParseResult {
  const allVariables: DetectedVariable[] = [];
  const allErrors: string[] = [];
  const allWarnings: string[] = [];
  
  // Criar mapa de labels existentes por seção
  const existingLabelsBySection = new Map<ComponentType, Map<number, string>>();
  
  if (existingVariables) {
    existingVariables.forEach((v) => {
      if (!existingLabelsBySection.has(v.section)) {
        existingLabelsBySection.set(v.section, new Map());
      }
      existingLabelsBySection.get(v.section)!.set(v.index, v.label);
    });
  }
  
  // Parse cada componente
  components.forEach((component) => {
    let text = '';
    
    if (component.type === 'HEADER' && component.format === 'TEXT' && component.text) {
      text = component.text;
    } else if (component.type === 'BODY' && component.text) {
      text = component.text;
    } else if (component.type === 'FOOTER' && component.text) {
      text = component.text;
    } else if (component.type === 'BUTTONS' && component.buttons) {
      // Verificar URLs dinâmicas nos botões
      component.buttons.forEach((button, btnIndex) => {
        if (button.type === 'URL' && button.url && button.url_suffix_variable) {
          const urlIndexes = extractPlaceholderIndexes(button.url);
          if (urlIndexes.length > 0) {
            allVariables.push({
              index: urlIndexes[0],
              key: `button_url_${btnIndex + 1}`,
              label: `URL do Botão ${btnIndex + 1}`,
              required: true,
              example: '',
              section: 'BUTTONS',
            });
          }
        }
      });
      return; // Não precisa processar texto para botões
    }
    
    if (text) {
      const existingLabels = existingLabelsBySection.get(component.type);
      const { variables, validation } = parseVariablesFromText(
        text,
        component.type,
        existingLabels
      );
      
      // Preservar propriedades existentes
      const enhancedVars = variables.map((v) => {
        const existing = existingVariables?.find(
          (ev) => ev.section === v.section && ev.index === v.index
        );
        return existing ? { ...v, label: existing.label, required: existing.required, example: existing.example } : v;
      });
      
      allVariables.push(...enhancedVars);
      allErrors.push(...validation.errors.map((e) => `${component.type}: ${e}`));
      allWarnings.push(...validation.warnings.map((w) => `${component.type}: ${w}`));
    }
  });
  
  // Verificar limite total
  if (allVariables.length > MAX_TOTAL_VARIABLES) {
    allWarnings.push(`Total de ${allVariables.length} variáveis excede o limite de ${MAX_TOTAL_VARIABLES}.`);
  }
  
  return {
    variables: allVariables,
    validation: {
      isValid: allErrors.length === 0,
      errors: allErrors,
      warnings: allWarnings,
    },
  };
}

/**
 * Converte variáveis detectadas para o schema do banco de dados
 */
export function variablesToSchema(variables: DetectedVariable[]): {
  header?: DetectedVariable[];
  body?: DetectedVariable[];
  button?: DetectedVariable[];
} {
  const schema: {
    header?: DetectedVariable[];
    body?: DetectedVariable[];
    button?: DetectedVariable[];
  } = {};
  
  const headerVars = variables.filter((v) => v.section === 'HEADER');
  const bodyVars = variables.filter((v) => v.section === 'BODY');
  const buttonVars = variables.filter((v) => v.section === 'BUTTONS');
  
  if (headerVars.length > 0) schema.header = headerVars;
  if (bodyVars.length > 0) schema.body = bodyVars;
  if (buttonVars.length > 0) schema.button = buttonVars;
  
  return schema;
}

/**
 * Converte componentes para formato JSON armazenável
 */
export function componentsToJson(components: TemplateComponent[]): object[] {
  return components.map((c) => {
    const result: Record<string, unknown> = { type: c.type };
    
    if (c.format) result.format = c.format;
    if (c.text) result.text = c.text;
    if (c.media_url) result.media_url = c.media_url;
    if (c.buttons && c.buttons.length > 0) {
      result.buttons = c.buttons.map((b) => ({
        type: b.type,
        text: b.text,
        ...(b.url && { url: b.url }),
        ...(b.phone_number && { phone_number: b.phone_number }),
        ...(b.url_suffix_variable && { url_suffix_variable: true }),
      }));
    }
    
    return result;
  });
}

/**
 * Reconstrói componentes a partir do JSON armazenado
 */
export function jsonToComponents(json: unknown): TemplateComponent[] {
  if (!Array.isArray(json)) return [];
  
  return json.map((item: Record<string, unknown>) => ({
    type: (item.type as ComponentType) || 'BODY',
    format: item.format as HeaderFormat | undefined,
    text: item.text as string | undefined,
    media_url: item.media_url as string | undefined,
    buttons: item.buttons as TemplateButton[] | undefined,
  }));
}

/**
 * Valida se o template está pronto para ser salvo
 */
export function validateTemplateForSave(
  name: string,
  components: TemplateComponent[],
  variables: DetectedVariable[]
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Validar nome
  if (!name.trim()) {
    errors.push('Nome do template é obrigatório.');
  } else if (!/^[a-z0-9_]+$/.test(name)) {
    errors.push('Nome deve conter apenas letras minúsculas, números e underscores.');
  }
  
  // Validar BODY obrigatório
  const bodyComponent = components.find((c) => c.type === 'BODY');
  if (!bodyComponent || !bodyComponent.text?.trim()) {
    errors.push('O corpo (BODY) do template é obrigatório.');
  }
  
  // Validar que todas as variáveis têm labels
  variables.forEach((v) => {
    if (!v.label.trim()) {
      errors.push(`Variável {{${v.index}}} precisa de um nome (label).`);
    }
  });
  
  // Parse e validar variáveis
  const parseResult = parseTemplateComponents(components, variables);
  errors.push(...parseResult.validation.errors);
  warnings.push(...parseResult.validation.warnings);
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
