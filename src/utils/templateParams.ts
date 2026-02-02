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
 * Procura por {{1}}, {{2}}, etc.
 */
export function countVariablesInText(text: string): number {
  const matches = text.match(/\{\{(\d+)\}\}/g);
  return matches ? matches.length : 0;
}

/**
 * Extrai informações de variáveis dos components do template.
 */
export function extractTemplateVariables(components: unknown): {
  header: { count: number; positions: number[] };
  body: { count: number; positions: number[] };
  button: { count: number; positions: number[] };
  total: number;
} {
  const result = {
    header: { count: 0, positions: [] as number[] },
    body: { count: 0, positions: [] as number[] },
    button: { count: 0, positions: [] as number[] },
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
    
    // Extrair posições das variáveis
    const regex = /\{\{(\d+)\}\}/g;
    let match;
    const positions: number[] = [];
    
    while ((match = regex.exec(text)) !== null) {
      positions.push(parseInt(match[1], 10));
    }
    
    if (type === 'HEADER') {
      result.header.count = positions.length;
      result.header.positions = positions;
    } else if (type === 'BODY') {
      result.body.count = positions.length;
      result.body.positions = positions;
    }
    
    // Botões com URLs dinâmicas
    if (type === 'BUTTONS' && Array.isArray(comp.buttons)) {
      for (const btn of comp.buttons) {
        const btnUrl = btn.url || '';
        let btnMatch;
        const btnRegex = /\{\{(\d+)\}\}/g;
        while ((btnMatch = btnRegex.exec(btnUrl)) !== null) {
          result.button.positions.push(parseInt(btnMatch[1], 10));
        }
      }
      result.button.count = result.button.positions.length;
    }
  }
  
  result.total = result.header.count + result.body.count + result.button.count;
  return result;
}

/**
 * Gera mapeamentos padrão para os parâmetros do template.
 * - Primeiro parâmetro do body: primeiro nome do contato
 * - Outros: variáveis a serem preenchidas
 */
export function generateDefaultMappings(
  components: unknown,
  variablesSchema: TemplateSchema | null
): ParamMapping[] {
  const variables = extractTemplateVariables(components);
  const mappings: ParamMapping[] = [];
  
  // Mapeamentos para BODY
  variables.body.positions.forEach((position, idx) => {
    const schemaVar = variablesSchema?.body?.[idx];
    
    if (idx === 0) {
      // Primeiro parâmetro: primeiro nome por padrão
      mappings.push({
        paramIndex: position,
        component: 'body',
        source: 'contact_field',
        sourceKey: 'first_name',
        fallback: 'Olá',
        label: schemaVar?.label || `Variável ${position}`,
      });
    } else {
      // Outros: variável de campanha
      mappings.push({
        paramIndex: position,
        component: 'body',
        source: 'campaign_variable',
        sourceKey: schemaVar?.key || `var_${position}`,
        fallback: schemaVar?.fallback || '',
        label: schemaVar?.label || `Variável ${position}`,
      });
    }
  });
  
  // Mapeamentos para HEADER
  variables.header.positions.forEach((position, idx) => {
    const schemaVar = variablesSchema?.header?.[idx];
    
    mappings.push({
      paramIndex: position,
      component: 'header',
      source: 'campaign_variable',
      sourceKey: schemaVar?.key || `header_${position}`,
      fallback: schemaVar?.fallback || '',
      label: schemaVar?.label || `Header ${position}`,
    });
  });
  
  // Mapeamentos para BUTTON
  variables.button.positions.forEach((position, idx) => {
    const schemaVar = variablesSchema?.button?.[idx];
    
    mappings.push({
      paramIndex: position,
      component: 'button',
      source: 'campaign_variable',
      sourceKey: schemaVar?.key || `button_${position}`,
      fallback: schemaVar?.fallback || '',
      label: schemaVar?.label || `Botão ${position}`,
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
