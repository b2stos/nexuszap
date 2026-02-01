
# Plano: Envio em Background + Visualizacao de Progresso

## Problema Identificado

O processamento de campanhas esta vinculado ao componente `CampaignDetail.tsx`. Quando o usuario sai da pagina:
1. O componente desmonta
2. O `useEffect` que dispara os batches para de executar
3. A campanha "trava" ate o usuario voltar

## Solucao

### Arquitetura Proposta

```text
+----------------------------------------------------------+
|  App.tsx                                                 |
|  +----------------------------------------------------+  |
|  |  CampaignBackgroundProvider                        |  |
|  |  - Monitora campanhas com status='running'         |  |
|  |  - Dispara batches automaticamente                 |  |
|  |  - Funciona em qualquer pagina do dashboard        |  |
|  +----------------------------------------------------+  |
|                                                          |
|  +------------------+  +------------------------------+  |
|  | DashboardSidebar |  | Qualquer Pagina (Inbox, etc) |  |
|  | + Badge "2 ativo"|  | (nao precisa processar)      |  |
|  | + Mini Progress  |  |                              |  |
|  +------------------+  +------------------------------+  |
+----------------------------------------------------------+
```

### 1. Criar CampaignBackgroundProvider

Novo contexto React que:
- Busca campanhas `running` do tenant a cada 10s
- Para cada campanha ativa, dispara `campaign-process-queue` a cada 5s
- Expoe estado das campanhas ativas para outros componentes

| Arquivo | Alteracao |
|---------|-----------|
| `src/contexts/CampaignBackgroundContext.tsx` | **NOVO** - Provider para processamento em background |
| `src/hooks/useActiveCampaigns.ts` | **NOVO** - Hook para acessar campanhas ativas |

### 2. Integrar Provider no App.tsx

Envolver as rotas protegidas com o provider:

```tsx
<CampaignBackgroundProvider>
  <Routes>
    {/* rotas do dashboard */}
  </Routes>
</CampaignBackgroundProvider>
```

### 3. Indicador Visual na Sidebar

Adicionar badge e mini-painel no `DashboardSidebar`:
- Badge vermelho pulsante no item "Campanhas" quando ha envios ativos
- Clique expande mini-painel com progresso resumido
- Link direto para pagina de detalhes

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/dashboard/DashboardSidebar.tsx` | Adicionar badge e mini-painel |
| `src/components/dashboard/ActiveCampaignIndicator.tsx` | **NOVO** - Componente do indicador |

### 4. Melhorar Visibilidade no Grid de Campanhas

| Melhoria | Descricao |
|----------|-----------|
| Ordenacao | Campanhas `running` sempre no topo |
| Destaque visual | Borda animada para campanhas ativas |
| Link rapido | Botao "Ver Progresso" mais destacado |

---

## Fluxo do Usuario Apos Implementacao

```text
1. Usuario inicia campanha na tela de detalhes
2. Sai para verificar Inbox
3. >>> CampaignBackgroundProvider continua disparando batches <<<
4. Badge na sidebar mostra "1 ativo" com progresso
5. Usuario clica no badge → ve mini-painel com progresso
6. Clica "Ver detalhes" → volta para CampaignDetail
7. Campanha continua ate concluir (mesmo navegando entre paginas)
```

---

## Detalhes Tecnicos

### CampaignBackgroundContext

```typescript
interface CampaignBackgroundState {
  activeCampaigns: Array<{
    id: string;
    name: string;
    progress: number; // 0-100
    sent: number;
    total: number;
    status: 'running' | 'paused';
  }>;
  isProcessing: boolean;
}

// Polling a cada 10s para campanhas ativas
// Disparo de batch a cada 5s para cada campanha running
// Controle de concorrencia para evitar multiplos disparos
```

### Logica de Processamento

```typescript
// Hook interno do provider
useEffect(() => {
  if (runningCampaigns.length === 0) return;
  
  const interval = setInterval(() => {
    runningCampaigns.forEach(campaign => {
      // Evitar disparar se ja esta processando
      if (!processingCampaigns.has(campaign.id)) {
        processBatch(campaign.id);
      }
    });
  }, 5000);
  
  return () => clearInterval(interval);
}, [runningCampaigns]);
```

### Indicador na Sidebar

```tsx
// Dentro de SidebarContent, no item Campanhas
<NavLink to="/dashboard/campaigns">
  <Send className="h-6 w-6" />
  Campanhas
  {activeCampaigns.length > 0 && (
    <Badge className="bg-green-500 animate-pulse ml-auto">
      {activeCampaigns.length} ativo
    </Badge>
  )}
</NavLink>

{/* Mini painel expansivel */}
{showMiniPanel && (
  <ActiveCampaignIndicator campaigns={activeCampaigns} />
)}
```

---

## Arquivos a Modificar/Criar

| Arquivo | Tipo | Descricao |
|---------|------|-----------|
| `src/contexts/CampaignBackgroundContext.tsx` | NOVO | Provider de processamento |
| `src/hooks/useActiveCampaigns.ts` | NOVO | Hook para consumir o contexto |
| `src/components/dashboard/ActiveCampaignIndicator.tsx` | NOVO | Mini-painel de progresso |
| `src/components/dashboard/DashboardSidebar.tsx` | EDITAR | Integrar indicador |
| `src/components/campaigns/MTCampaignsGrid.tsx` | EDITAR | Destacar campanhas ativas |
| `src/App.tsx` | EDITAR | Envolver rotas com provider |
| `src/pages/CampaignDetail.tsx` | EDITAR | Remover useEffect de auto-trigger (agora no provider) |

---

## Beneficios

1. **Envio continuo**: Campanha nao para quando usuario navega
2. **Visibilidade**: Badge + mini-painel mostram progresso em qualquer tela
3. **Acesso rapido**: Um clique para ver detalhes da campanha ativa
4. **Robustez**: Se a aba for fechada, campanha para (comportamento esperado em SPA)

