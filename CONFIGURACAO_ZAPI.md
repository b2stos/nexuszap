# 📱 Configuração Z-API - Guia Completo

## ⚠️ PROBLEMA 1: Mensagem de Trial

**Sintoma:** Mensagens chegam com prefixo:
```
"Mensagem de teste. Essa mensagem foi enviada por uma conta em trial. Favor desconsiderar"
```

**Causa:** Conta Z-API em modo trial/gratuito

**Solução:** 
1. Acesse: https://developer.z-api.io/
2. Vá em **Planos** ou **Billing**
3. Faça upgrade para plano pago
4. Após upgrade, o prefixo será removido automaticamente

**Alternativa temporária:** 
- Enquanto não fizer upgrade, avise seus contatos que ignorem o prefixo
- O conteúdo real da mensagem está após esse aviso

---

## ✅ PROBLEMA 2: Dashboard - Taxa de Entrega/Leitura

**O que foi feito:**
✅ Criada edge function `zapi-webhook` para receber status em tempo real
✅ Atualização automática de status: SENT → DELIVERED → READ

**Como configurar webhooks Z-API:**

### 1️⃣ Pegar URL do Webhook

Sua URL de webhook é:
```
https://xaypooqwcrhytkfqyzha.supabase.co/functions/v1/zapi-webhook
```

### 2️⃣ Configurar no Painel Z-API

1. Acesse: https://developer.z-api.io/instances
2. Clique na sua instância
3. Vá em **"Webhooks"** ou **"Configurações"**
4. Cole a URL acima no campo **"Webhook URL"** ou **"Notification URL"**
5. Selecione os eventos:
   - ✅ **Message Status** (status de mensagem)
   - ✅ **Message Delivery** (entrega)
   - ✅ **Message Read** (leitura)
6. Salve as configurações

### 3️⃣ Testar

1. Envie uma mensagem de teste
2. Aguarde alguns segundos
3. Verifique o dashboard - os status devem atualizar automaticamente:
   - 📤 **Enviada** (sent)
   - ✅ **Entregue** (delivered)
   - 👁️ **Lida** (read)

---

## 🔍 Verificar se está funcionando

**Logs da Edge Function:**
1. Abra o backend
2. Vá em **Edge Functions** → **zapi-webhook**
3. Veja os logs em tempo real

**Deve aparecer:**
```
Webhook received: {...}
Status update for 5511999999999: DELIVERED
Message abc-123 updated: { status: 'delivered', delivered_at: '...' }
```

---

## 📊 Status Possíveis

| Status Z-API | Status no Sistema | Quando Acontece |
|--------------|-------------------|-----------------|
| SENT         | sent              | Enviada para WhatsApp |
| DELIVERED    | delivered         | Entregue no celular |
| READ         | read              | Visualizada pelo destinatário |
| FAILED       | failed            | Falha no envio |

---

## 🆘 Problemas Comuns

**Status não atualiza:**
- ✅ Verifique se configurou o webhook no painel Z-API
- ✅ Confirme que a URL está correta (com https://)
- ✅ Veja os logs da edge function para confirmar recebimento

**Webhook não recebe nada:**
- ✅ Teste a URL manualmente: `curl https://xaypooqwcrhytkfqyzha.supabase.co/functions/v1/zapi-webhook`
- ✅ Deve retornar: `{"received":true}`
- ✅ Se retornar erro, entre em contato com suporte

---

## 📞 Suporte Z-API

- **Documentação:** https://developer.z-api.io/webhooks
- **Suporte:** suporte@z-api.io
- **WhatsApp:** Verifique no painel Z-API

---

## ✨ Após Configurar

Com webhooks configurados:
- ✅ Dashboard mostra métricas em tempo real
- ✅ Taxa de entrega precisa
- ✅ Taxa de visualização automática
- ✅ Acompanhamento detalhado de cada campanha
