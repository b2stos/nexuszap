/**
 * Demo Templates Data
 * 
 * Dados fictícios para o Demo Mode da página de Templates
 * 12 templates com status variados (7 approved, 3 pending, 2 rejected)
 */

import { Template, TemplateVariablesSchema } from '@/hooks/useTemplates';

// Helper para datas fictícias (últimos 60 dias)
const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

const baseTenantId = 'demo-tenant';
const baseProviderId = 'demo-provider';

// ============================================
// TEMPLATES FICTÍCIOS (12)
// ============================================

export const demoTemplates: Template[] = [
  // 1. Boas-vindas (approved)
  {
    id: 'demo-template-1',
    tenant_id: baseTenantId,
    provider_id: baseProviderId,
    name: 'boas_vindas_01',
    language: 'pt_BR',
    category: 'MARKETING',
    status: 'approved',
    components: [],
    variables_schema: {
      body: [
        { key: 'nome', label: 'Nome do cliente', required: true },
        { key: 'empresa', label: 'Nome da empresa', required: false },
      ],
    } as TemplateVariablesSchema,
    provider_template_id: 'waba-template-001',
    rejection_reason: null,
    created_at: daysAgo(45),
    updated_at: daysAgo(45),
  },
  
  // 2. Confirmação de agendamento (approved)
  {
    id: 'demo-template-2',
    tenant_id: baseTenantId,
    provider_id: baseProviderId,
    name: 'confirmacao_agendamento',
    language: 'pt_BR',
    category: 'UTILITY',
    status: 'approved',
    components: [],
    variables_schema: {
      body: [
        { key: 'nome', label: 'Nome', required: true },
        { key: 'data', label: 'Data do agendamento', required: true },
        { key: 'horario', label: 'Horário', required: true },
        { key: 'servico', label: 'Serviço', required: false },
      ],
    } as TemplateVariablesSchema,
    provider_template_id: 'waba-template-002',
    rejection_reason: null,
    created_at: daysAgo(40),
    updated_at: daysAgo(38),
  },
  
  // 3. Lembrete de pagamento (approved)
  {
    id: 'demo-template-3',
    tenant_id: baseTenantId,
    provider_id: baseProviderId,
    name: 'lembrete_pagamento',
    language: 'pt_BR',
    category: 'UTILITY',
    status: 'approved',
    components: [],
    variables_schema: {
      body: [
        { key: 'nome', label: 'Nome', required: true },
        { key: 'valor', label: 'Valor', required: true, type: 'currency' },
        { key: 'vencimento', label: 'Data de vencimento', required: true, type: 'date_time' },
        { key: 'link_pagamento', label: 'Link de pagamento', required: false },
      ],
    } as TemplateVariablesSchema,
    provider_template_id: 'waba-template-003',
    rejection_reason: null,
    created_at: daysAgo(35),
    updated_at: daysAgo(35),
  },
  
  // 4. Pós-venda satisfação (approved)
  {
    id: 'demo-template-4',
    tenant_id: baseTenantId,
    provider_id: baseProviderId,
    name: 'pos_venda_satisfacao',
    language: 'pt_BR',
    category: 'MARKETING',
    status: 'approved',
    components: [],
    variables_schema: {
      body: [
        { key: 'nome', label: 'Nome', required: true },
        { key: 'produto', label: 'Produto adquirido', required: true },
        { key: 'link_avaliacao', label: 'Link para avaliação', required: false },
      ],
    } as TemplateVariablesSchema,
    provider_template_id: 'waba-template-004',
    rejection_reason: null,
    created_at: daysAgo(30),
    updated_at: daysAgo(28),
  },
  
  // 5. Envio de catálogo (approved)
  {
    id: 'demo-template-5',
    tenant_id: baseTenantId,
    provider_id: baseProviderId,
    name: 'envio_catalogo',
    language: 'pt_BR',
    category: 'MARKETING',
    status: 'approved',
    components: [],
    variables_schema: {
      header: [
        { key: 'nome_catalogo', label: 'Nome do catálogo', required: true },
      ],
      body: [
        { key: 'nome', label: 'Nome', required: true },
        { key: 'link_catalogo', label: 'Link do catálogo', required: true },
      ],
    } as TemplateVariablesSchema,
    provider_template_id: 'waba-template-005',
    rejection_reason: null,
    created_at: daysAgo(25),
    updated_at: daysAgo(25),
  },
  
  // 6. Reativação de cliente (approved)
  {
    id: 'demo-template-6',
    tenant_id: baseTenantId,
    provider_id: baseProviderId,
    name: 'reativacao_cliente',
    language: 'pt_BR',
    category: 'MARKETING',
    status: 'approved',
    components: [],
    variables_schema: {
      body: [
        { key: 'nome', label: 'Nome', required: true },
        { key: 'desconto', label: 'Percentual de desconto', required: false },
        { key: 'validade', label: 'Validade da oferta', required: false },
      ],
    } as TemplateVariablesSchema,
    provider_template_id: 'waba-template-006',
    rejection_reason: null,
    created_at: daysAgo(20),
    updated_at: daysAgo(18),
  },
  
  // 7. Suporte protocolo (approved)
  {
    id: 'demo-template-7',
    tenant_id: baseTenantId,
    provider_id: baseProviderId,
    name: 'suporte_protocolo',
    language: 'pt_BR',
    category: 'UTILITY',
    status: 'approved',
    components: [],
    variables_schema: {
      body: [
        { key: 'nome', label: 'Nome', required: true },
        { key: 'protocolo', label: 'Número do protocolo', required: true },
        { key: 'previsao', label: 'Previsão de resposta', required: false },
      ],
    } as TemplateVariablesSchema,
    provider_template_id: 'waba-template-007',
    rejection_reason: null,
    created_at: daysAgo(15),
    updated_at: daysAgo(15),
  },
  
  // 8. Confirmação de pedido (pending)
  {
    id: 'demo-template-8',
    tenant_id: baseTenantId,
    provider_id: baseProviderId,
    name: 'confirmacao_pedido',
    language: 'pt_BR',
    category: 'UTILITY',
    status: 'pending',
    components: [],
    variables_schema: {
      body: [
        { key: 'nome', label: 'Nome', required: true },
        { key: 'numero_pedido', label: 'Número do pedido', required: true },
        { key: 'valor_total', label: 'Valor total', required: true, type: 'currency' },
        { key: 'previsao_entrega', label: 'Previsão de entrega', required: false },
      ],
    } as TemplateVariablesSchema,
    provider_template_id: null,
    rejection_reason: null,
    created_at: daysAgo(10),
    updated_at: daysAgo(10),
  },
  
  // 9. Horário de funcionamento (pending)
  {
    id: 'demo-template-9',
    tenant_id: baseTenantId,
    provider_id: baseProviderId,
    name: 'horario_funcionamento',
    language: 'pt_BR',
    category: 'UTILITY',
    status: 'pending',
    components: [],
    variables_schema: {
      body: [
        { key: 'nome', label: 'Nome', required: true },
      ],
    } as TemplateVariablesSchema,
    provider_template_id: null,
    rejection_reason: null,
    created_at: daysAgo(7),
    updated_at: daysAgo(7),
  },
  
  // 10. Novidades e lançamentos (pending)
  {
    id: 'demo-template-10',
    tenant_id: baseTenantId,
    provider_id: baseProviderId,
    name: 'novidades_lancamentos',
    language: 'pt_BR',
    category: 'MARKETING',
    status: 'pending',
    components: [],
    variables_schema: {
      header: [
        { key: 'titulo', label: 'Título da novidade', required: true },
      ],
      body: [
        { key: 'nome', label: 'Nome', required: true },
        { key: 'descricao', label: 'Descrição', required: true },
        { key: 'link', label: 'Link para saber mais', required: false },
      ],
    } as TemplateVariablesSchema,
    provider_template_id: null,
    rejection_reason: null,
    created_at: daysAgo(5),
    updated_at: daysAgo(5),
  },
  
  // 11. Promoção relâmpago (rejected)
  {
    id: 'demo-template-11',
    tenant_id: baseTenantId,
    provider_id: baseProviderId,
    name: 'promocao_relampago',
    language: 'pt_BR',
    category: 'MARKETING',
    status: 'rejected',
    components: [],
    variables_schema: {
      body: [
        { key: 'nome', label: 'Nome', required: true },
        { key: 'desconto', label: 'Desconto', required: true },
        { key: 'codigo', label: 'Código promocional', required: true },
      ],
    } as TemplateVariablesSchema,
    provider_template_id: null,
    rejection_reason: 'Template contains promotional content that violates policy. Please remove urgency language like "URGENTE" or "ÚLTIMA CHANCE".',
    created_at: daysAgo(12),
    updated_at: daysAgo(11),
  },
  
  // 12. Código de verificação (rejected)
  {
    id: 'demo-template-12',
    tenant_id: baseTenantId,
    provider_id: baseProviderId,
    name: 'codigo_verificacao_v1',
    language: 'pt_BR',
    category: 'AUTHENTICATION',
    status: 'rejected',
    components: [],
    variables_schema: {
      body: [
        { key: 'codigo', label: 'Código de verificação', required: true },
      ],
    } as TemplateVariablesSchema,
    provider_template_id: null,
    rejection_reason: 'Authentication templates must use the official OTP button format. Please resubmit using the correct template structure.',
    created_at: daysAgo(8),
    updated_at: daysAgo(6),
  },
];

// Helper para obter todos os templates demo
export function getDemoTemplates(): Template[] {
  return demoTemplates;
}

// Helper para obter apenas templates aprovados (demo)
export function getApprovedDemoTemplates(): Template[] {
  return demoTemplates.filter(t => t.status === 'approved');
}

// Estatísticas dos templates demo
export const demoTemplateStats = {
  total: demoTemplates.length,
  approved: demoTemplates.filter(t => t.status === 'approved').length,
  pending: demoTemplates.filter(t => t.status === 'pending').length,
  rejected: demoTemplates.filter(t => t.status === 'rejected').length,
};
