/**
 * Template Parameters Utilities
 * 
 * Utilitários para normalização, mapeamento e validação de parâmetros de templates WhatsApp.
 * Resolve o erro 132000 garantindo que N params = N esperados.
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
  source: 'contact_field' | 'fixed_value' | 'variable';
  field?: string; // ex: 'name', 'phone', 'email', 'first_name'
  value?: string; // valor fixo ou key da variável
  fallback: string; // valor padrão se source retornar null
}

export interface ContactData {
  id: string;
  phone: string;
  name: string | null;
  email?: string | null;
  metadata?: Record<string, unknown>;
}

export interface BuildParamsResult {
  success: boolean;
  params: string[];
  expectedCount: number;
  actualCount: number;
  warnings: string[];
  errors: string[];
  debug: {
    rawValues: (string | null)[];
    normalizedValues: (string | null)[];
    fallbacksUsed: boolean[];
  };
}

// ============================================
// NORMALIZAÇÃO
// ============================================

/**
 * Normaliza um valor de parâmetro.
 * - null/undefined → null (para cair no fallback)
 * - string → trim
 * - vazio após trim → null
 * - outros → String(value)
 */
export function normalizeParam(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  
  // Para outros tipos, converter para string
  const stringValue = String(value).trim();
  return stringValue.length > 0 ? stringValue : null;
}

/**
 * Extrai o primeiro nome de um nome completo.
 * "Bruno Bastos" → "Bruno"
 * "Maria" → "Maria"
 * null/empty → null
 */
export function extractFirstName(fullName: string | null | undefined): string | null {
  const normalized = normalizeParam(fullName);
  if (!normalized) return null;
  
  // Dividir por espaço e pegar a primeira parte
  const parts = normalized.split(/\s+/);
  const firstName = parts[0];
  
  // Capitalizar primeira letra
  if (firstName && firstName.length > 0) {
    return firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
  }
  
  return null;
}

/**
 * Aplica fallback a um valor normalizado.
 * Se value é null, retorna o fallback.
 */
export function applyFallback(value: string | null, fallback: string): string {
  return value !== null ? value : fallback;
}

// ============================================
// EXTRAÇÃO DE SCHEMA DO TEMPLATE
// ============================================

/**
 * Conta o número de variáveis esperadas em cada componente do template.
 * Analisa os components do template da Meta para encontrar {{1}}, {{2}}, etc.
 */
export function countTemplateVariables(components: unknown): {
  header: number;
  body: number;
  button: number;
  total: number;
} {
  const counts = { header: 0, body: 0, button: 0, total: 0 };
  
  if (!Array.isArray(components)) {
    return counts;
  }
  
  for (const component of components) {
    if (typeof component !== 'object' || component === null) continue;
    
    const comp = component as Record<string, unknown>;
    const type = String(comp.type || '').toUpperCase();
    const text = String(comp.text || '');
    
    // Contar placeholders {{N}} no texto
    const matches = text.match(/\{\{(\d+)\}\}/g);
    const count = matches ? matches.length : 0;
    
    if (type === 'HEADER') {
      counts.header = count;
    } else if (type === 'BODY') {
      counts.body = count;
    } else if (type === 'BUTTONS') {
      // Botões podem ter variáveis em URLs dinâmicas
      const buttons = comp.buttons as Array<Record<string, unknown>> | undefined;
      if (Array.isArray(buttons)) {
        for (const btn of buttons) {
          const btnUrl = String(btn.url || '');
          const btnMatches = btnUrl.match(/\{\{(\d+)\}\}/g);
          counts.button += btnMatches ? btnMatches.length : 0;
        }
      }
    }
  }
  
  counts.total = counts.header + counts.body + counts.button;
  return counts;
}

/**
 * Extrai as posições das variáveis do template.
 * Retorna um mapa de {1: 'body', 2: 'body', ...}
 */
export function extractVariablePositions(components: unknown): Map<number, 'header' | 'body' | 'button'> {
  const positions = new Map<number, 'header' | 'body' | 'button'>();
  
  if (!Array.isArray(components)) {
    return positions;
  }
  
  for (const component of components) {
    if (typeof component !== 'object' || component === null) continue;
    
    const comp = component as Record<string, unknown>;
    const type = String(comp.type || '').toUpperCase();
    const text = String(comp.text || '');
    
    // Extrair números dos placeholders
    const regex = /\{\{(\d+)\}\}/g;
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      const position = parseInt(match[1], 10);
      if (type === 'HEADER') {
        positions.set(position, 'header');
      } else if (type === 'BODY') {
        positions.set(position, 'body');
      }
    }
    
    // Botões
    if (type === 'BUTTONS') {
      const buttons = comp.buttons as Array<Record<string, unknown>> | undefined;
      if (Array.isArray(buttons)) {
        for (const btn of buttons) {
          const btnUrl = String(btn.url || '');
          let btnMatch;
          while ((btnMatch = regex.exec(btnUrl)) !== null) {
            positions.set(parseInt(btnMatch[1], 10), 'button');
          }
        }
      }
    }
  }
  
  return positions;
}

// ============================================
// MAPEAMENTO DE PARÂMETROS
// ============================================

/**
 * Gera mapeamento padrão para parâmetros de template.
 * - Param 1: primeiro nome do contato
 * - Outros: variáveis mapeadas por key
 */
export function generateDefaultMapping(
  variablesSchema: TemplateSchema | null,
  expectedCount: { header: number; body: number; button: number }
): Map<string, ParamMapping> {
  const mappings = new Map<string, ParamMapping>();
  
  // Gerar mapeamentos para BODY
  for (let i = 0; i < expectedCount.body; i++) {
    const key = `body_${i + 1}`;
    const schemaVar = variablesSchema?.body?.[i];
    
    // Param 1 do body: usar primeiro nome por padrão
    if (i === 0) {
      mappings.set(key, {
        source: 'contact_field',
        field: 'first_name',
        fallback: schemaVar?.fallback || 'Olá',
      });
    } else {
      // Outros params: usar schema se disponível
      mappings.set(key, {
        source: 'variable',
        value: schemaVar?.key || `var_${i + 1}`,
        fallback: schemaVar?.fallback || '',
      });
    }
  }
  
  // Gerar mapeamentos para HEADER
  for (let i = 0; i < expectedCount.header; i++) {
    const key = `header_${i + 1}`;
    const schemaVar = variablesSchema?.header?.[i];
    
    mappings.set(key, {
      source: 'variable',
      value: schemaVar?.key || `header_var_${i + 1}`,
      fallback: schemaVar?.fallback || '',
    });
  }
  
  // Gerar mapeamentos para BUTTON
  for (let i = 0; i < expectedCount.button; i++) {
    const key = `button_${i + 1}`;
    const schemaVar = variablesSchema?.button?.[i];
    
    mappings.set(key, {
      source: 'variable',
      value: schemaVar?.key || `button_var_${i + 1}`,
      fallback: schemaVar?.fallback || '',
    });
  }
  
  return mappings;
}

/**
 * Resolve o valor de um parâmetro a partir do mapeamento e dados do contato.
 */
export function resolveParamValue(
  mapping: ParamMapping,
  contact: ContactData,
  campaignVars: Record<string, string> | null,
  recipientVars: Record<string, string> | null
): string | null {
  let rawValue: string | null = null;
  
  switch (mapping.source) {
    case 'contact_field':
      if (mapping.field === 'first_name') {
        rawValue = extractFirstName(contact.name);
      } else if (mapping.field === 'name' || mapping.field === 'full_name') {
        rawValue = normalizeParam(contact.name);
      } else if (mapping.field === 'phone') {
        rawValue = normalizeParam(contact.phone);
      } else if (mapping.field === 'email') {
        rawValue = normalizeParam(contact.email);
      } else if (mapping.field && contact.metadata) {
        rawValue = normalizeParam(contact.metadata[mapping.field]);
      }
      break;
      
    case 'fixed_value':
      rawValue = normalizeParam(mapping.value);
      break;
      
    case 'variable':
      // Prioridade: recipientVars > campaignVars
      const key = mapping.value || '';
      rawValue = normalizeParam(recipientVars?.[key]) || normalizeParam(campaignVars?.[key]);
      break;
  }
  
  return rawValue;
}

// ============================================
// CONSTRUÇÃO FINAL DOS PARÂMETROS
// ============================================

/**
 * Constrói os parâmetros do template garantindo N params = N esperados.
 * Aplica normalização, fallbacks e valida a contagem.
 */
export function buildParamsFromMapping(
  components: unknown,
  variablesSchema: TemplateSchema | null,
  contact: ContactData,
  campaignVars: Record<string, string> | null,
  recipientVars: Record<string, string> | null
): BuildParamsResult {
  const result: BuildParamsResult = {
    success: false,
    params: [],
    expectedCount: 0,
    actualCount: 0,
    warnings: [],
    errors: [],
    debug: {
      rawValues: [],
      normalizedValues: [],
      fallbacksUsed: [],
    },
  };
  
  // 1. Contar variáveis esperadas do template
  const counts = countTemplateVariables(components);
  result.expectedCount = counts.body; // Foco em BODY por agora (mais comum)
  
  // 2. Gerar mapeamento padrão
  const mappings = generateDefaultMapping(variablesSchema, counts);
  
  // 3. Construir parâmetros para BODY
  const bodyParams: string[] = [];
  
  for (let i = 0; i < counts.body; i++) {
    const key = `body_${i + 1}`;
    const mapping = mappings.get(key);
    
    if (!mapping) {
      // Fallback extremo: usar primeiro nome ou "Olá"
      const fallbackValue = i === 0 
        ? (extractFirstName(contact.name) || 'Olá')
        : '';
      bodyParams.push(fallbackValue);
      result.debug.rawValues.push(null);
      result.debug.normalizedValues.push(fallbackValue);
      result.debug.fallbacksUsed.push(true);
      result.warnings.push(`Param ${i + 1}: usando fallback (mapping não encontrado)`);
      continue;
    }
    
    // Resolver valor
    const rawValue = resolveParamValue(mapping, contact, campaignVars, recipientVars);
    result.debug.rawValues.push(rawValue);
    
    // Aplicar fallback se necessário
    const finalValue = applyFallback(rawValue, mapping.fallback);
    result.debug.normalizedValues.push(finalValue);
    result.debug.fallbacksUsed.push(rawValue === null);
    
    if (rawValue === null) {
      result.warnings.push(`Param ${i + 1}: usando fallback "${mapping.fallback}"`);
    }
    
    bodyParams.push(finalValue);
  }
  
  result.params = bodyParams;
  result.actualCount = bodyParams.length;
  
  // 4. Validar contagem
  if (result.actualCount !== result.expectedCount) {
    result.errors.push(
      `Contagem de parâmetros inválida: esperado=${result.expectedCount}, enviado=${result.actualCount}`
    );
    result.success = false;
  } else {
    result.success = true;
  }
  
  return result;
}

/**
 * Formata os parâmetros no formato esperado pelo provider (TemplateVariable[]).
 */
export function formatParamsForProvider(
  params: string[],
  component: 'body' | 'header' | 'button' = 'body'
): Array<{ type: 'text'; value: string }> {
  return params.map(value => ({
    type: 'text' as const,
    value: value,
  }));
}

// ============================================
// VALIDAÇÃO PRÉ-DISPARO
// ============================================

/**
 * Valida se os parâmetros podem ser construídos corretamente para um contato.
 * Útil para pré-validação antes do disparo.
 */
export function validateContactParams(
  components: unknown,
  variablesSchema: TemplateSchema | null,
  contact: ContactData,
  campaignVars: Record<string, string> | null
): {
  valid: boolean;
  missingParams: number[];
  willUseFallback: number[];
  errors: string[];
} {
  const result = buildParamsFromMapping(
    components,
    variablesSchema,
    contact,
    campaignVars,
    null
  );
  
  const missingParams: number[] = [];
  const willUseFallback: number[] = [];
  
  result.debug.fallbacksUsed.forEach((used, idx) => {
    if (used) {
      willUseFallback.push(idx + 1);
    }
  });
  
  result.debug.normalizedValues.forEach((value, idx) => {
    if (value === null || value === '') {
      missingParams.push(idx + 1);
    }
  });
  
  return {
    valid: result.success && missingParams.length === 0,
    missingParams,
    willUseFallback,
    errors: result.errors,
  };
}

/**
 * Gera relatório de validação para um batch de contatos.
 */
export function generateBatchValidationReport(
  components: unknown,
  variablesSchema: TemplateSchema | null,
  contacts: ContactData[],
  campaignVars: Record<string, string> | null
): {
  totalContacts: number;
  validContacts: number;
  invalidContacts: number;
  contactsWithFallback: number;
  invalidContactIds: string[];
  summary: string;
} {
  let validCount = 0;
  let invalidCount = 0;
  let fallbackCount = 0;
  const invalidIds: string[] = [];
  
  for (const contact of contacts) {
    const validation = validateContactParams(components, variablesSchema, contact, campaignVars);
    
    if (validation.valid) {
      validCount++;
    } else {
      invalidCount++;
      invalidIds.push(contact.id);
    }
    
    if (validation.willUseFallback.length > 0) {
      fallbackCount++;
    }
  }
  
  const summary = `${validCount}/${contacts.length} válidos | ${fallbackCount} com fallback | ${invalidCount} inválidos`;
  
  return {
    totalContacts: contacts.length,
    validContacts: validCount,
    invalidContacts: invalidCount,
    contactsWithFallback: fallbackCount,
    invalidContactIds: invalidIds,
    summary,
  };
}
