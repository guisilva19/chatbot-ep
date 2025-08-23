# 🚀 Deploy no Render - WhatsApp Bot

## Passo a Passo para Deploy Gratuito

### 1. Preparar o Código
✅ **Já feito!** O arquivo `render.yaml` foi criado com todas as configurações.

### 2. Criar Conta no Render
1. Acesse [render.com](https://render.com)
2. Clique em "Get Started for Free"
3. Faça login com GitHub (recomendado)

### 3. Conectar o Repositório
1. No dashboard do Render, clique em "New +"
2. Selecione "Blueprint"
3. Conecte seu repositório GitHub
4. O Render detectará automaticamente o arquivo `render.yaml`

### 4. Configurar Variáveis de Ambiente
No Render, você precisará configurar:

**Variáveis Obrigatórias:**
- `DATABASE_URL` - Será criado automaticamente pelo banco PostgreSQL
- `WEBHOOK_URL` - URL do seu serviço no Render (será fornecida após deploy)
- `SESSION_SECRET` - Uma string aleatória para sessões

**Outras variáveis que você pode ter:**
- Tokens de API do WhatsApp (se houver)
- Chaves de integração específicas do seu negócio

### 5. Deploy Automático
1. Clique em "Apply"
2. O Render criará:
   - ✅ Banco PostgreSQL gratuito (1GB)
   - ✅ Aplicação web gratuita
   - ✅ SSL/HTTPS automático

### 6. Configurar Webhook (Após Deploy)
1. Após o deploy, você receberá uma URL como: `https://seu-bot.onrender.com`
2. Configure esta URL no seu webhook do WhatsApp

### 🎉 Resultado Final
- **Custo: $0/mês** (vs $50/mês no Railway)
- **SSL automático**
- **Deploy automático a cada push**
- **Banco PostgreSQL incluído**

### ⚠️ Limitações do Plano Gratuito
- Sleep após 15min inatividade (acorda automaticamente)
- Banco expira em 30 dias (mas renova gratuitamente)
- 750 horas/mês (suficiente para 24/7)

### 🔄 Renovar Banco (Todo Mês)
1. Acesse o dashboard do Render
2. Vá em Databases → "whatsapp-bot-db"
3. Clique em "Extend Free Database"
4. Pronto! Mais 30 dias grátis

## Comandos Úteis

```bash
# Testar localmente
yarn dev

# Build para produção
yarn build

# Executar migração (se necessário)
yarn db:deploy
```

## 🆘 Problemas Comuns

**Bot não responde após 15min:**
- Normal! É o sleep do plano gratuito
- Bot acorda automaticamente na próxima mensagem

**Erro de banco:**
- Verifique se DATABASE_URL está configurada
- Banco pode ter expirado (renove gratuitamente)

**Build falhou:**
- Verifique se todas as dependências estão no package.json
- Rode `yarn build` localmente para testar
