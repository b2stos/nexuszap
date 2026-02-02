/**
 * Template Parameters Utilities (Frontend)
 * 
 * Versão frontend dos utilitários de parâmetros de template.
 * Usado na UI para validação e preview.
 */

// ============================================
// TYPES
// ============================================

export interface TemplateVariableSchema {
  key: string;
  label?: string;
  required?: boolean;
  type?: 'text' | 'currency' | 'date_time';
  fallback?: string;
}

export interface TemplateSchema {
  header?: TemplateVariableSchema[];
  body?: TemplateVariableSchema[];
  button?: TemplateVariableSchema[];
}

export interface ParamMapping {
  paramIndex: number;
  component: 'header' | 'body' | 'button';
  source: 'contact_field' | 'fixed_value' | 'campaign_variable';
  sourceKey: string; // campo do contato, key da variável, ou valor fixo
  fallback: string;
  label: string;
}

export interface ContactData {
  id: string;
  phone: string;
  name: string | null;
  email?: string | null;
  metadata?: Record<string, unknown>;
}

export interface TemplateComponent {
  type: string;
  text?: string;
  buttons?: Array<{ type: string; url?: string; text?: string }>;
}

// ============================================
// NORMALIZAÇÃO
// ============================================

/**
 * Normaliza um valor de parâmetro.
 */
export function normalizeParam(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  
  const stringValue = String(value).trim();
  return stringValue.length > 0 ? stringValue : null;
}

/**
 * Extrai o primeiro nome de um nome completo.
 */
export function extractFirstName(fullName: string | null | undefined): string | null {
  const normalized = normalizeParam(fullName);
  if (!normalized) return null;
  
  const parts = normalized.split(/\s+/);
  const firstName = parts[0];
  
  if (firstName && firstName.length > 0) {
    return firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
  }
  
  return null;
}

// ============================================
// EXTRAÇÃO DE VARIÁVEIS DO TEMPLATE
// ============================================

/**
 * Conta o número de variáveis em um texto de template.
 * Suporta AMBOS os formatos:
 * - {{N}} (numérico): {{1}}, {{2}}, {{3}}
 * - {{nome}} (nomeado): {{nome}}, {{bairro}}, {{data}}
 */
export function countVariablesInText(text: string): number {
  const matches = text.match(/\{\{([^}]+)\}\}/g);
  return matches ? matches.length : 0;
}

/**
 * Extrai informações de variáveis dos components do template.
 * Suporta placeholders numéricos ({{1}}) e nomeados ({{nome}}).
 */
export function extractTemplateVariables(components: unknown): {
  header: { count: number; positions: number[]; names: string[] };
  body: { count: number; positions: number[]; names: string[] };
  button: { count: number; positions: number[]; names: string[] };
  total: number;
} {
  const result = {
    header: { count: 0, positions: [] as number[], names: [] as string[] },
    body: { count: 0, positions: [] as number[], names: [] as string[] },
    button: { count: 0, positions: [] as number[], names: [] as string[] },
    total: 0,
  };
  
  if (!Array.isArray(components)) {
    return result;
  }
  
  for (const component of components) {
    if (typeof component !== 'object' || component === null) continue;
    
    const comp = component as TemplateComponent;
    const type = String(comp.type || '').toUpperCase();
    const text = comp.text || '';
    
    // Extrair TODAS as variáveis (numéricas e nomeadas)
    const regex = /\{\{([^}]+)\}\}/g;
    let match;
    const positions: number[] = [];
    const names: string[] = [];
    
    while ((match = regex.exec(text)) !== null) {
      const varName = match[1].trim();
      // Se for numérico, adicionar como posição
      const numValue = parseInt(varName, 10);
      if (!isNaN(numValue)) {
        positions.push(numValue);
      }
      names.push(varName);
    }
    
    if (type === 'HEADER') {
      result.header.count = names.length;
      result.header.positions = positions;
      result.header.names = names;
    } else if (type === 'BODY') {
      result.body.count = names.length;
      result.body.positions = positions;
      result.body.names = names;
    }
    
    // Botões com URLs dinâmicas
    if (type === 'BUTTONS' && Array.isArray(comp.buttons)) {
      for (const btn of comp.buttons) {
        const btnUrl = btn.url || '';
        let btnMatch;
        const btnRegex = /\{\{([^}]+)\}\}/g;
        while ((btnMatch = btnRegex.exec(btnUrl)) !== null) {
          const varName = btnMatch[1].trim();
          const numValue = parseInt(varName, 10);
          if (!isNaN(numValue)) {
            result.button.positions.push(numValue);
          }
          result.button.names.push(varName);
        }
      }
      result.button.count = result.button.names.length;
    }
  }
  
  result.total = result.header.count + result.body.count + result.button.count;
  return result;
}

/**
 * Gera mapeamentos padrão para os parâmetros do template.
 * - Variáveis com nome 'nome', 'name', 'cliente' → primeiro nome do contato
 * - Outras variáveis → mapeadas por nome ou índice
 */
export function generateDefaultMappings(
  components: unknown,
  variablesSchema: TemplateSchema | null
): ParamMapping[] {
  const variables = extractTemplateVariables(components);
  const mappings: ParamMapping[] = [];
  
  // Nomes de variáveis que devem ser mapeadas para o nome do contato
  const nameVariablePatterns = ['nome', 'name', 'primeiro_nome', 'first_name', 'cliente'];
  
  // Mapeamentos para BODY
  variables.body.names.forEach((varName, idx) => {
    const schemaVar = variablesSchema?.body?.[idx];
    const isNameVariable = nameVariablePatterns.includes(varName.toLowerCase());
    const position = variables.body.positions[idx] || (idx + 1);
    
    if (isNameVariable || idx === 0) {
      // Variável de nome → primeiro nome do contato
      mappings.push({
        paramIndex: position,
        component: 'body',
        source: 'contact_field',
        sourceKey: 'first_name',
        fallback: 'Olá',
        label: schemaVar?.label || varName || `Variável ${position}`,
      });
    } else {
      // Outras variáveis → variável de campanha
      mappings.push({
        paramIndex: position,
        component: 'body',
        source: 'campaign_variable',
        sourceKey: schemaVar?.key || varName || `var_${position}`,
        fallback: schemaVar?.fallback || '',
        label: schemaVar?.label || varName || `Variável ${position}`,
      });
    }
  });
  
  // Mapeamentos para HEADER
  variables.header.names.forEach((varName, idx) => {
    const schemaVar = variablesSchema?.header?.[idx];
    const position = variables.header.positions[idx] || (idx + 1);
    
    mappings.push({
      paramIndex: position,
      component: 'header',
      source: 'campaign_variable',
      sourceKey: schemaVar?.key || varName || `header_${position}`,
      fallback: schemaVar?.fallback || '',
      label: schemaVar?.label || varName || `Header ${position}`,
    });
  });
  
  // Mapeamentos para BUTTON
  variables.button.names.forEach((varName, idx) => {
    const schemaVar = variablesSchema?.button?.[idx];
    const position = variables.button.positions[idx] || (idx + 1);
    
    mappings.push({
      paramIndex: position,
      component: 'button',
      source: 'campaign_variable',
      sourceKey: schemaVar?.key || varName || `button_${position}`,
      fallback: schemaVar?.fallback || '',
      label: schemaVar?.label || varName || `Botão ${position}`,
    });
  });
  
  return mappings;
}

/**
 * Resolve o valor de um parâmetro a partir do mapeamento.
 */
export function resolveParamValue(
  mapping: ParamMapping,
  contact: ContactData | null,
  campaignVars: Record<string, string>
): string {
  let value: string | null = null;
  
  switch (mapping.source) {
    case 'contact_field':
      if (!contact) break;
      
      if (mapping.sourceKey === 'first_name') {
        value = extractFirstName(contact.name);
      } else if (mapping.sourceKey === 'name' || mapping.sourceKey === 'full_name') {
        value = normalizeParam(contact.name);
      } else if (mapping.sourceKey === 'phone') {
        value = normalizeParam(contact.phone);
      } else if (mapping.sourceKey === 'email') {
        value = normalizeParam(contact.email);
      }
      break;
      
    case 'fixed_value':
      value = normalizeParam(mapping.sourceKey);
      break;
      
    case 'campaign_variable':
      value = normalizeParam(campaignVars[mapping.sourceKey]);
      break;
  }
  
  // Aplicar fallback
  return value !== null ? value : mapping.fallback;
}

/**
 * Constrói preview do template com valores resolvidos.
 */
export function buildTemplatePreview(
  components: unknown,
  mappings: ParamMapping[],
  contact: ContactData | null,
  campaignVars: Record<string, string>
): string {
  if (!Array.isArray(components)) {
    return '';
  }
  
  // Encontrar componente BODY
  const bodyComponent = components.find(
    (c: TemplateComponent) => String(c.type).toUpperCase() === 'BODY'
  ) as TemplateComponent | undefined;
  
  if (!bodyComponent?.text) {
    return '';
  }
  
  let text = bodyComponent.text;
  
  // Substituir variáveis pelos valores resolvidos
  for (const mapping of mappings) {
    if (mapping.component !== 'body') continue;
    
    const value = resolveParamValue(mapping, contact, campaignVars);
    const placeholder = `{{${mapping.paramIndex}}}`;
    text = text.replace(placeholder, value);
  }
  
  return text;
}

/**
 * Valida se todos os parâmetros necessários estão preenchidos.
 */
export function validateMappings(
  mappings: ParamMapping[],
  campaignVars: Record<string, string>
): {
  valid: boolean;
  missingParams: ParamMapping[];
  warnings: string[];
} {
  const missingParams: ParamMapping[] = [];
  const warnings: string[] = [];
  
  for (const mapping of mappings) {
    // Para variáveis de campanha, verificar se está preenchida
    if (mapping.source === 'campaign_variable') {
      const value = normalizeParam(campaignVars[mapping.sourceKey]);
      
      if (value === null && !mapping.fallback) {
        missingParams.push(mapping);
      } else if (value === null && mapping.fallback) {
        warnings.push(`${mapping.label}: usando fallback "${mapping.fallback}"`);
      }
    }
  }
  
  return {
    valid: missingParams.length === 0,
    missingParams,
    warnings,
  };
}

/**
 * Opções de campos do contato disponíveis para mapeamento.
 */
export const CONTACT_FIELD_OPTIONS = [
  { value: 'first_name', label: 'Primeiro Nome' },
  { value: 'name', label: 'Nome Completo' },
  { value: 'phone', label: 'Telefone' },
  { value: 'email', label: 'E-mail' },
] as const;

/**
 * Opções de source para mapeamento.
 */
export const SOURCE_OPTIONS = [
  { value: 'contact_field', label: 'Campo do Contato' },
  { value: 'fixed_value', label: 'Valor Fixo' },
  { value: 'campaign_variable', label: 'Variável da Campanha' },
] as const;
