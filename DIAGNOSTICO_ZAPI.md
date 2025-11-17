# 🔍 Diagnóstico Z-API - WhatsApp Connection

## ✅ Checklist de Verificação

### 1. Secrets Configuradas
Verifique se as 3 secrets Z-API estão corretas no painel de Secrets:

- ✓ `ZAPI_INSTANCE_ID` - ID da sua instância Z-API
- ✓ `ZAPI_TOKEN` - Token de autenticação
- ✓ `ZAPI_CLIENT_TOKEN` - Token do cliente

**Onde encontrar:** https://developer.z-api.io/instances

### 2. Formato das Credenciais

**ZAPI_INSTANCE_ID**: Deve ser algo como `3XXXXXXXXXXXXX` (número de 14-16 dígitos)
**ZAPI_TOKEN**: Deve ser algo como `C12AXXXXXXXXXXXXXXXXXX` (string alfanumérica)
**ZAPI_CLIENT_TOKEN**: Deve ser algo como `Fxxxxxxxxxxxxxx` (string alfanumérica)

### 3. Status da Instância Z-API

Acesse: `https://api.z-api.io/instances/[SEU_INSTANCE_ID]/token/[SEU_TOKEN]/status`

Você deve receber uma resposta JSON como:
```json
{
  "connected": false,
  "session": "disconnected"
}
```

### 4. Erros Comuns

#### ❌ Erro 401 (Unauthorized)
- **Causa**: Credenciais inválidas
- **Solução**: Verifique se copiou corretamente as 3 secrets

#### ❌ Erro 404 (Not Found)  
- **Causa**: INSTANCE_ID incorreto
- **Solução**: Verifique o ID da instância no painel Z-API

#### ❌ Erro 500 (Internal Server Error)
- **Causa**: Instância pode estar inativa ou expirada
- **Solução**: Acesse o painel Z-API e verifique se a instância está ativa

### 5. Teste Manual

Para testar se suas credenciais estão funcionando, execute este comando no terminal:

```bash
curl -X GET \
  'https://api.z-api.io/instances/[INSTANCE_ID]/token/[TOKEN]/status' \
  -H 'Client-Token: [CLIENT_TOKEN]'
```

Se retornar um JSON com status, as credenciais estão corretas!

## 🐛 Logs Melhorados

Agora com mensagens de erro detalhadas que mostrarão:
- Código de status HTTP
- Mensagem de erro da API
- Stack trace para debugging

## 📝 Próximos Passos

1. Verifique as secrets no painel
2. Teste suas credenciais manualmente
3. Tente conectar novamente no app
4. Veja os logs da edge function no backend para detalhes do erro
