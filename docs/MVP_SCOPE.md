# 📋 NEXUS ZAP - Escopo MVP v1.0

**Data:** 09/01/2026  
**Versão:** 1.0  
**Status:** Em Definição

---

## 🎯 VISÃO GERAL

Plataforma SaaS multi-tenant para gestão de WhatsApp Business API via BSP (NotificaMe), oferecendo Inbox unificado com experiência similar ao WhatsApp Web, campanhas via templates e gestão de contatos.

---

## ✅ ESCOPO DO MVP (Obrigatório)

### 1. Conector WhatsApp Oficial (NotificaMe BSP)

| Item | Descrição |
|------|-----------|
| 1.1 | Tela de configuração do canal (API Token, Phone Number ID, WABA ID) |
| 1.2 | Teste de conexão com feedback visual |
| 1.3 | Status do canal (connected/disconnected/error) |
| 1.4 | Configuração de webhook URL para o BSP |

**Critérios de Aceite:**
- [ ] Usuário consegue salvar credenciais do NotificaMe
- [ ] Botão "Testar Conexão" retorna sucesso/falha com mensagem clara
- [ ] Status atualiza em tempo real via polling ou realtime
- [ ] Webhook URL é gerado automaticamente por tenant

---

### 2. Webhook Endpoint Público

| Item | Descrição |
|------|-----------|
| 2.1 | Endpoint `/webhooks/notificame/:tenant_id` |
| 2.2 | Validação de assinatura (X-Hub-Signature) |
| 2.3 | Processamento de eventos: `message`, `status` |
| 2.4 | Log de todos os eventos recebidos |

**Critérios de Aceite:**
- [ ] Webhook recebe POST do NotificaMe e responde 200 OK em < 3s
- [ ] Mensagens inbound são persistidas na tabela `messages`
- [ ] Status updates (sent/delivered/read/failed) atualizam mensagens existentes
- [ ] Eventos inválidos são logados mas não quebram o sistema
- [ ] Assinatura inválida retorna 401

---

### 3. Modelo de Dados Multi-Tenant

```
tenants
├── id (uuid, PK)
├── name
├── slug (unique)
├── created_at
└── settings (jsonb)

channels
├── id (uuid, PK)
├── tenant_id (FK → tenants)
├── provider ('notificame')
├── phone_number
├── phone_number_id
├── waba_id
├── api_token (encrypted)
├── webhook_secret
├── status ('active'|'inactive'|'error')
├── last_connected_at
└── created_at

contacts
├── id (uuid, PK)
├── tenant_id (FK → tenants)
├── phone (E.164 format)
├── name
├── profile_picture_url
├── is_blocked (opt-out)
├── metadata (jsonb)
├── created_at
└── updated_at

conversations
├── id (uuid, PK)
├── tenant_id (FK → tenants)
├── channel_id (FK → channels)
├── contact_id (FK → contacts)
├── status ('open'|'closed')
├── unread_count
├── last_message_at
├── last_inbound_at (para janela 24h)
├── assigned_to (FK → profiles, nullable)
└── created_at

messages
├── id (uuid, PK)
├── tenant_id (FK → tenants)
├── conversation_id (FK → conversations)
├── contact_id (FK → contacts)
├── channel_id (FK → channels)
├── direction ('inbound'|'outbound')
├── type ('text'|'image'|'document'|'template')
├── content (text)
├── media_url
├── template_name
├── template_params (jsonb)
├── wamid (WhatsApp Message ID)
├── status ('pending'|'sent'|'delivered'|'read'|'failed')
├── error_message
├── sent_at
├── delivered_at
├── read_at
└── created_at

templates
├── id (uuid, PK)
├── tenant_id (FK → tenants)
├── channel_id (FK → channels)
├── name
├── language
├── category ('marketing'|'utility'|'authentication')
├── status ('pending'|'approved'|'rejected')
├── components (jsonb)
├── synced_at
└── created_at

campaigns
├── id (uuid, PK)
├── tenant_id (FK → tenants)
├── channel_id (FK → channels)
├── template_id (FK → templates)
├── name
├── status ('draft'|'scheduled'|'sending'|'completed'|'failed')
├── total_contacts
├── sent_count
├── delivered_count
├── read_count
├── failed_count
├── scheduled_at
├── started_at
├── completed_at
└── created_at

campaign_recipients
├── id (uuid, PK)
├── campaign_id (FK → campaigns)
├── contact_id (FK → contacts)
├── message_id (FK → messages, nullable)
├── status ('pending'|'sent'|'delivered'|'read'|'failed')
├── error_message
└── processed_at

webhook_logs
├── id (uuid, PK)
├── tenant_id (FK → tenants)
├── event_type
├── payload (jsonb)
├── processed
├── error_message
└── created_at
```

**Critérios de Aceite:**
- [ ] Todas as tabelas têm `tenant_id` com RLS policies
- [ ] Índices em colunas de busca frequente
- [ ] Cascade delete apropriado
- [ ] Realtime habilitado para `messages` e `conversations`

---

### 4. Inbox (3 Colunas)

| Coluna | Funcionalidade |
|--------|----------------|
| **Lista de Conversas** | Ordenada por última mensagem, badge de não lidas, busca por nome/telefone |
| **Chat** | Timeline de mensagens, campo de resposta, ticks de status, indicador 24h |
| **Painel do Contato** | Nome, telefone, foto, botão opt-out, metadados |

**Regras de Negócio:**
- **Dentro da janela 24h:** Texto livre permitido
- **Fora da janela 24h:** Campo de texto bloqueado, apenas seletor de templates
- **Janela 24h:** Calculada a partir de `conversations.last_inbound_at`

**Critérios de Aceite:**
- [ ] Lista atualiza em tempo real (nova mensagem sobe para o topo)
- [ ] Badge de não lidas atualiza ao receber inbound
- [ ] Marcar como lida ao abrir conversa
- [ ] Ticks: ✓ (sent), ✓✓ (delivered), ✓✓ azul (read), ❌ (failed)
- [ ] Indicador visual "Fora da janela de 24h" quando aplicável
- [ ] Campo de texto desabilitado fora da janela
- [ ] Seletor de template aparece fora da janela
- [ ] Mensagens ordenadas por timestamp (antigas em cima)
- [ ] Scroll infinito ou paginação para histórico

---

### 5. Templates

| Item | Descrição |
|------|-----------|
| 5.1 | Listagem de templates sincronizados do BSP |
| 5.2 | Visualização de template (componentes) |
| 5.3 | Botão "Sincronizar Templates" |
| 5.4 | Envio de template via Inbox (com variáveis) |

**Critérios de Aceite:**
- [ ] Sincronização traz templates aprovados do NotificaMe
- [ ] Preview mostra header, body, footer, buttons
- [ ] Formulário de variáveis dinâmico baseado no template
- [ ] Envio de template atualiza status via webhook

---

### 6. Campanhas (Broadcast)

| Item | Descrição |
|------|-----------|
| 6.1 | Criar campanha: nome, template, lista de contatos |
| 6.2 | Importar contatos para campanha (CSV ou selecionar existentes) |
| 6.3 | Preview antes de enviar |
| 6.4 | Fila de envio com rate limiting (respeitando limites do BSP) |
| 6.5 | Dashboard de progresso (enviados/entregues/lidos/falhas) |

**Rate Limiting:**
- Máximo 80 mensagens/segundo (limite BSP típico)
- Retry automático para erros 429
- Pause/Resume de campanha

**Critérios de Aceite:**
- [ ] Campanha só permite template aprovado
- [ ] Contatos com opt-out são excluídos automaticamente
- [ ] Progresso atualiza em tempo real
- [ ] Possibilidade de pausar/cancelar campanha em andamento
- [ ] Relatório final com breakdown de status

---

### 7. Dashboard

| Métrica | Fonte |
|---------|-------|
| Mensagens enviadas (hoje/semana/mês) | `messages` WHERE direction='outbound' |
| Taxa de entrega | delivered / sent |
| Taxa de leitura | read / delivered |
| Conversas ativas | `conversations` WHERE status='open' |
| Campanhas ativas | `campaigns` WHERE status='sending' |
| Últimos eventos de webhook | `webhook_logs` |

**Critérios de Aceite:**
- [ ] Métricas calculadas a partir de dados reais
- [ ] Filtro por período (hoje, 7d, 30d)
- [ ] Gráfico de tendência
- [ ] Refresh automático ou manual

---

### 8. Opt-Out (Blacklist)

| Item | Descrição |
|------|-----------|
| 8.1 | Flag `is_blocked` na tabela contacts |
| 8.2 | Botão "Bloquear Contato" no painel do contato |
| 8.3 | Lista de bloqueados em Contatos |
| 8.4 | Verificação antes de qualquer envio |

**Critérios de Aceite:**
- [ ] Contato bloqueado não recebe mensagens de campanhas
- [ ] Contato bloqueado não recebe mensagens do inbox
- [ ] Feedback claro ao tentar enviar para bloqueado
- [ ] Possibilidade de desbloquear

---

## 🚫 FORA DO ESCOPO (MVP)

| Item | Motivo |
|------|--------|
| IA / Chatbots automáticos | Complexidade; fase 2 |
| Automações / Flows | Complexidade; fase 2 |
| Áudio/Vídeo (envio/recebimento) | Simplificação; fase 2 |
| Chamadas de voz/vídeo | Não suportado pela API oficial |
| Múltiplos usuários por tenant | Simplificação; fase 2 |
| Atribuição de conversas (assignment) | Simplificação; MVP tem 1 operador |
| Respostas rápidas (canned responses) | Nice-to-have; fase 2 |
| Tags em contatos | Nice-to-have; fase 2 |
| Integrações externas (Zapier, etc) | Fase 2 |
| Aplicativo mobile | Fora de escopo total |

---

## ⚠️ RISCOS E SUPOSIÇÕES

### Riscos

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Limites de rate do BSP | Campanhas lentas | Implementar queue com backoff |
| Webhook fora do ar | Perda de status | Logs + retry mechanism |
| Template rejeitado | Campanha não envia | Validação antes de criar campanha |
| Janela 24h mal calculada | Mensagens bloqueadas erroneamente | Teste extensivo com mocks |

### Suposições

| Suposição | Validação |
|-----------|-----------|
| NotificaMe fornece webhook de status | Verificar documentação |
| API suporta envio de template com variáveis | Testar manualmente |
| Limite de 80 msg/s é suficiente | Monitorar em produção |
| Formato E.164 para telefones | Normalizar na importação |

---

## 📱 LISTA DE TELAS

| Tela | Rota | Objetivo |
|------|------|----------|
| **Dashboard** | `/dashboard` | Visão geral de métricas e atividade |
| **Inbox** | `/dashboard/inbox` | Chat 3 colunas para atendimento |
| **Contatos** | `/dashboard/contacts` | CRUD de contatos + opt-out |
| **Campanhas** | `/dashboard/campaigns` | Listagem e gestão de campanhas |
| **Nova Campanha** | `/dashboard/campaigns/new` | Wizard de criação de campanha |
| **Templates** | `/dashboard/templates` | Listagem e sync de templates |
| **Canais** | `/dashboard/channels` | Configuração do NotificaMe |
| **Logs/Webhooks** | `/dashboard/admin/webhooks` | Visualização de eventos (admin) |
| **Configurações** | `/dashboard/settings` | Configurações gerais do tenant |

---

## 🧪 CHECKLIST DE TESTES DO MVP

### Cenário 1: Receber Inbound
```
DADO que o webhook está configurado
QUANDO o NotificaMe envia uma mensagem inbound
ENTÃO a mensagem aparece no inbox em tempo real
E a conversa sobe para o topo da lista
E o badge de não lidas incrementa
```

### Cenário 2: Enviar Texto (dentro de 24h)
```
DADO que a última mensagem inbound foi há menos de 24h
QUANDO o operador digita e envia uma mensagem
ENTÃO a mensagem aparece no chat com tick ✓
E o status atualiza para ✓✓ quando entregue
E o status atualiza para ✓✓ azul quando lida
```

### Cenário 3: Bloquear Texto (fora de 24h)
```
DADO que a última mensagem inbound foi há mais de 24h
QUANDO o operador tenta enviar texto
ENTÃO o campo de texto está desabilitado
E aparece mensagem "Use um template para iniciar conversa"
E o seletor de templates está disponível
```

### Cenário 4: Enviar Template
```
DADO que estou fora da janela de 24h
QUANDO seleciono um template e preencho variáveis
E clico em enviar
ENTÃO o template é enviado com status pendente
E o webhook atualiza o status corretamente
```

### Cenário 5: Criar e Disparar Campanha
```
DADO que tenho um template aprovado
E tenho uma lista de 100 contatos
QUANDO crio uma campanha e clico em "Iniciar"
ENTÃO a campanha entra em status "sending"
E os contatos recebem mensagens progressivamente
E o dashboard mostra progresso em tempo real
E contatos com opt-out são ignorados
```

### Cenário 6: Opt-Out
```
DADO que bloqueei um contato
QUANDO uma campanha tenta enviar para ele
ENTÃO a mensagem não é enviada
E o contato aparece como "skipped" no relatório
```

### Cenário 7: Webhook de Status
```
DADO que enviei uma mensagem
QUANDO o webhook recebe evento "delivered"
ENTÃO a mensagem atualiza de ✓ para ✓✓
E o dashboard incrementa "delivered_count"
```

### Cenário 8: Sincronização de Templates
```
DADO que tenho templates aprovados no NotificaMe
QUANDO clico em "Sincronizar Templates"
ENTÃO a lista atualiza com todos os templates aprovados
E templates rejeitados são marcados adequadamente
```

---

## 📊 DEFINIÇÃO DE PRONTO (DoD)

Um item está PRONTO quando:

1. ✅ Código implementado e funcionando
2. ✅ Critérios de aceite verificados
3. ✅ RLS policies configuradas (multi-tenant)
4. ✅ Tratamento de erros implementado
5. ✅ Loading states e feedback visual
6. ✅ Responsivo (desktop-first, mas funcional em tablet)
7. ✅ Logs de debug adequados

---

## 🔄 PRÓXIMOS PASSOS

1. **Aprovar este escopo** com stakeholders
2. **Criar tabelas** no banco via migrations
3. **Implementar webhook** endpoint
4. **Construir tela de Canais** (configuração NotificaMe)
5. **Construir Inbox** (3 colunas)
6. **Implementar Templates** (sync + envio)
7. **Implementar Campanhas** (queue + broadcast)
8. **Construir Dashboard** com métricas reais

---

*Documento gerado em 09/01/2026 - NexusZap MVP v1.0*
