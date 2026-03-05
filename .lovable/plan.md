

## Diagnóstico: Domínio nexuszap.online não abre

### Problema identificado

O domínio `nexuszap.online` não está respondendo. Não consegui acessar nem `nexuszap.online`, nem `www.nexuszap.online`, nem mesmo `nexuszap.lovable.app`.

### Causas prováveis

1. **Projeto não publicado (ou precisa de re-publicação)**: O frontend precisa ser publicado clicando no botão "Publish" / "Update" no canto superior direito do editor. Mudanças de backend (Edge Functions, migrations) são deployadas automaticamente, mas o **frontend não**.

2. **DNS do domínio custom**: Segundo a memória do projeto, o domínio `nexuszap.online` está configurado no IONOS com A records apontando para `185.158.133.1`. Possíveis problemas:
   - Os registros DNS podem ter sido alterados ou expirado
   - O registro TXT `_lovable` pode não estar mais válido
   - O domínio `www.nexuszap.online` pode não ter sido adicionado como entrada separada no Lovable

3. **SSL/Certificado**: Se o DNS mudou, o certificado SSL pode ter falhado na renovação.

### Ações recomendadas

1. **Publicar o projeto**: Clique no botão **Publish** no canto superior direito do editor e depois em **Update** para garantir que o frontend está deployado.

2. **Verificar status do domínio**: Vá em **Settings → Domains** no projeto Lovable e verifique o status do domínio `nexuszap.online`. Os possíveis status são:
   - **Active** = tudo ok
   - **Offline** = DNS mudou e não aponta mais para o Lovable
   - **Failed** = certificado SSL não foi provisionado
   - **Verifying** = aguardando propagação DNS

3. **Verificar DNS no IONOS**: Confirme que os registros estão corretos:
   - `A` record para `@` → `185.158.133.1`
   - `A` record para `www` → `185.158.133.1`
   - `TXT` record `_lovable` com o valor de verificação

4. **Adicionar `www` no Lovable**: Se apenas `nexuszap.online` foi adicionado, adicione também `www.nexuszap.online` em Settings → Domains.

### Sem alterações de código necessárias

Este é um problema de infraestrutura/configuração, não de código. A resolução envolve verificar o painel de domínios e republicar o projeto.

