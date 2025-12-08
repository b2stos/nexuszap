# 📱 Configuração UAZAPI - Guia Completo

## ✅ Secrets Necessários

Configure as seguintes secrets no painel:

| Secret | Descrição | Exemplo |
|--------|-----------|---------|
| `UAZAPI_BASE_URL` | URL base da sua instância | `https://sua-instancia.uazapi.com` |
| `UAZAPI_INSTANCE_TOKEN` | Token de autenticação | `seu-token-aqui` |

**Onde encontrar:** Acesse seu painel UAZAPI em https://base360.uazapi.com

---

## 🔗 Configuração de Webhook

Para receber atualizações de status (entregue, lido, etc.), configure o webhook:

### URL do Webhook
```
https://xaypooqwcrhytkfqyzha.supabase.co/functions/v1/uazapi-webhook
```

### Como configurar:
1. Acesse seu painel UAZAPI
2. Vá em **Configurações** ou **Webhooks**
3. Cole a URL acima no campo de webhook
4. Selecione os eventos:
   - ✅ **Message Status** (status de mensagem)
   - ✅ **Message Delivery** (entrega)
   - ✅ **Message Read** (leitura)
5. Salve as configurações

---

## 📊 Mapeamento de Status

| Status UAZAPI | Status no Sistema | Descrição |
|---------------|-------------------|-----------|
| SENT | sent | Enviada para WhatsApp |
| DELIVERED | delivered | Entregue no celular |
| READ | read | Visualizada pelo destinatário |
| FAILED | failed | Falha no envio |

---

## 🔍 Verificar se está funcionando

### Testar conexão
1. Acesse a página de **Conexão WhatsApp** no dashboard
2. Clique em **Verificar Status**
3. Deve mostrar "Conectado" se tudo estiver correto

### Testar envio
1. Vá em **Enviar Mensagem**
2. Digite um número de teste
3. Envie uma mensagem de teste
4. Verifique os logs da edge function para confirmar

---

## 🆘 Problemas Comuns

### ❌ Erro "API não configurada"
- **Causa:** Secrets não configurados
- **Solução:** Configure `UAZAPI_BASE_URL` e `UAZAPI_INSTANCE_TOKEN`

### ❌ Status "Desconectado"
- **Causa:** WhatsApp não conectado na instância
- **Solução:** Escaneie o QR Code na página de conexão

### ❌ Mensagens não enviam
- **Causa:** Endpoint incorreto ou token inválido
- **Solução:** Verifique os logs da edge function para detalhes do erro

### ❌ Status não atualiza
- **Causa:** Webhook não configurado
- **Solução:** Configure a URL do webhook no painel UAZAPI

---

## 📞 Suporte

- **Painel UAZAPI:** https://base360.uazapi.com
- **Documentação:** Consulte o painel UAZAPI para documentação completa
