# Painel Supervisor WhatsApp Multi-Loja

PWA para supervisão operacional de mensagens WhatsApp Business de múltiplas lojas.

> **🔒 Modo Gratuito Ativo** — O sistema não permite envio de templates, marketing, iniciar conversa ou qualquer ação que gere cobrança na Meta. Somente respostas manuais em texto dentro da janela gratuita de 24h.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Backend | Node.js + Express.js |
| Banco | MySQL / MariaDB + Prisma ORM |
| Auth | JWT |
| Tempo real | Server-Sent Events (SSE) |
| Push | Web Push VAPID |
| Frontend | React 18 + Vite |
| PWA | vite-plugin-pwa + Workbox |
| Deploy | GitHub Actions → Hostinger |

---

## Configuração inicial

### 1. Clonar o repositório

```bash
git clone https://github.com/SEU_USUARIO/CrispeSupervisorLojas.git
cd CrispeSupervisorLojas
```

### 2. Configurar variáveis de ambiente do backend

```bash
cp backend/.env.example backend/.env
```

Editar `backend/.env` com suas credenciais reais:

```env
META_GRAPH_API_VERSION=v20.0
META_ACCESS_TOKEN=SEU_TOKEN_META
META_VERIFY_TOKEN=SEU_VERIFY_TOKEN_CUSTOMIZADO
META_APP_ID=SEU_APP_ID
META_APP_SECRET=SEU_APP_SECRET
DEFAULT_WABA_ID=SEU_WABA_ID
DATABASE_URL="mysql://usuario:senha@localhost:3306/whatsapp_supervisor"
JWT_SECRET=gere-uma-chave-longa-aleatoria-aqui
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@seudominio.com
APP_BASE_URL=https://seudominio.com
PORT=3001
```

### 3. Gerar chaves VAPID (uma única vez)

```bash
cd backend
npx web-push generate-vapid-keys
```

Copiar as chaves para o `.env`.

### 4. Instalar dependências e configurar banco

```bash
cd backend
npm install
npx prisma migrate dev --name init
npm run db:seed
```

### 5. Instalar e rodar o frontend

```bash
cd frontend
npm install
npm run dev
```

### 6. Iniciar o backend

```bash
cd backend
npm run dev
```

---

## Configurar Webhook na Meta

1. Acessar [developers.facebook.com](https://developers.facebook.com)
2. Ir em **WhatsApp > Configuration > Webhooks**
3. URL do webhook: `https://seudominio.com/webhook/whatsapp`
4. Verify Token: o valor de `META_VERIFY_TOKEN` no seu `.env`
5. Campos a assinar: `messages`

---

## Deploy na Hostinger

### Secrets do GitHub (Settings → Secrets → Actions)

| Secret | Valor |
|---|---|
| `HOSTINGER_HOST` | IP ou domínio do servidor |
| `HOSTINGER_USER` | Usuário SSH |
| `HOSTINGER_SSH_KEY` | Chave privada SSH (conteúdo completo) |
| `HOSTINGER_PORT` | Porta SSH (padrão: 22) |
| `HOSTINGER_PATH` | Caminho no servidor (ex: `/home/user/app`) |

### Variáveis de ambiente na Hostinger

Configure as variáveis diretamente no painel da Hostinger ou via SSH no arquivo `.env` do servidor. **Nunca suba o `.env` para o GitHub.**

### PM2 (gerenciador de processo)

```bash
npm install -g pm2
pm2 start backend/src/server.js --name whatsapp-supervisor --env production
pm2 startup
pm2 save
```

---

## Estrutura do projeto

```
whatsapp-supervisor/
├── backend/
│   ├── prisma/schema.prisma
│   ├── src/
│   │   ├── config/       — env, freeMode (custo zero)
│   │   ├── controllers/  — auth, webhook, conversations, messages, stores, push, reports
│   │   ├── services/     — metaWhatsApp, messageGuard, webhookParser, push, realtime, audit
│   │   ├── middlewares/  — auth, role, error, rateLimiter
│   │   ├── routes/
│   │   ├── jobs/         — cron de alerta de sem resposta
│   │   ├── db/
│   │   ├── app.js
│   │   └── server.js
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/   — ConversationList, ConversationView, FreeWindowBadge, StatusBadge, DashboardCards
│   │   ├── pages/        — Login, Dashboard, Stores, Reports
│   │   ├── services/     — apiClient, realtimeClient (SSE), pushClient
│   │   ├── context/      — AuthContext
│   │   └── sw.js         — Service Worker (push + cache)
│   └── vite.config.js
└── .github/workflows/deploy.yml
```

---

## Usuário padrão (seed)

| Campo | Valor |
|---|---|
| Email | `admin@example.com` |
| Senha | `Admin@1234` |
| Role | `owner` |

> ⚠️ **Troque a senha imediatamente após o primeiro login.**

---

## Roles de usuário

| Role | Permissões |
|---|---|
| `owner` | Todas as lojas, configurações, relatórios |
| `manager` | Lojas atribuídas, responder, relatórios das lojas |
| `admin` | Configuração técnica |

---

## Regra de custo zero (freeOnlyMode)

O sistema opera em modo **freeOnlyMode = true** permanentemente no MVP. Isso significa:

- ✅ Permitido: resposta manual em texto dentro da janela de 24h após mensagem do cliente
- ❌ Bloqueado: templates, marketing, iniciar conversa, disparo em massa, automação, mensagens após 24h

Toda tentativa de envio bloqueada é registrada no `audit_logs`.

---

## Licença

Proprietário — uso interno.
