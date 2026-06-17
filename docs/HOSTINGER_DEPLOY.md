# ENVOX Intelligence — Guia de Deploy: GitHub + Hostinger VPS

> Guia completo passo a passo para subir o projeto no GitHub e no servidor Hostinger.
> Última atualização: 2026-06-16

---

## ETAPA 1 — Criar repositório no GitHub

### 1.1 — Criar o repositório

1. Acesse **https://github.com/new**
2. Preencha:
   - **Repository name:** `envox-intel`
   - **Description:** `ENVOX Intelligence - Plataforma de Inteligência Operacional`
   - **Visibility:** `Private` (recomendado — dados sensíveis)
   - **NÃO marque** "Add a README file" (já temos)
3. Clique em **"Create repository"**
4. **Anote a URL** do repositório. Ex: `https://github.com/SEU_USUARIO/envox-intel.git`

---

## ETAPA 2 — Configurar o projeto localmente

### 2.1 — Extrair o projeto baixado

```bash
# Extraia o .tar.gz baixado do sandbox
tar -xzf envox-intel-mvp-v0.1.0.tar.gz
cd envox-intel
```

### 2.2 — Verificar que o .gitignore está correto
```bash
cat .gitignore
# Confirme que .env está listado — nunca suba senhas para o GitHub
```

### 2.3 — Inicializar e subir para o GitHub

```bash
# Entrar na pasta do projeto
cd envox-intel

# (Opcional) reinicializar o git se necessário
git init
git add .
git commit -m "feat: MVP ENVOX Intelligence v0.1.0"

# Conectar ao GitHub (substitua pela sua URL)
git remote add origin https://github.com/SEU_USUARIO/envox-intel.git

# Subir para a branch main
git branch -M main
git push -u origin main
```

> **Se pedir autenticação:** use seu usuário GitHub + um **Personal Access Token** (não a senha).
> Gere em: https://github.com/settings/tokens → New token (classic) → marque `repo`

---

## ETAPA 3 — Preparar o servidor Hostinger (VPS Linux)

### 3.1 — Acessar o VPS via SSH

No painel Hostinger, vá em **VPS → Gerenciar → Acesso SSH**.

```bash
ssh root@SEU_IP_HOSTINGER
# Ou com usuário não-root:
ssh usuario@SEU_IP_HOSTINGER
```

### 3.2 — Instalar dependências do servidor

```bash
# Atualizar pacotes
apt update && apt upgrade -y

# Instalar ferramentas essenciais
apt install -y git curl wget nano ufw

# Instalar Docker
curl -fsSL https://get.docker.com | sh

# Adicionar usuário ao grupo docker (se não for root)
usermod -aG docker $USER
newgrp docker

# Verificar instalação
docker --version
docker compose version
```

### 3.3 — Criar usuário dedicado (boa prática — não rodar como root)

```bash
# Criar usuário para a aplicação
adduser envox
usermod -aG docker envox
usermod -aG sudo envox

# Mudar para o novo usuário
su - envox
```

---

## ETAPA 4 — Clonar o projeto no servidor

### 4.1 — Configurar chave SSH para o GitHub (opcional mas recomendado)

```bash
# Gerar chave SSH no servidor
ssh-keygen -t ed25519 -C "server@envox" -f ~/.ssh/github_envox

# Ver a chave pública
cat ~/.ssh/github_envox.pub
```

Copie a saída e adicione no GitHub:
- Acesse: **https://github.com/settings/keys**
- Clique em **"New SSH key"**
- Cole a chave pública
- Salve

Configurar o SSH para usar essa chave:
```bash
cat >> ~/.ssh/config << 'EOF'
Host github.com
    HostName github.com
    User git
    IdentityFile ~/.ssh/github_envox
EOF
chmod 600 ~/.ssh/config
```

### 4.2 — Clonar o repositório

```bash
# Com SSH (se configurou a chave):
git clone git@github.com:SEU_USUARIO/envox-intel.git /opt/envox-intel

# OU com HTTPS (mais simples):
git clone https://github.com/SEU_USUARIO/envox-intel.git /opt/envox-intel

cd /opt/envox-intel
```

---

## ETAPA 5 — Configurar variáveis de ambiente no servidor

```bash
cd /opt/envox-intel

# Copiar o template
cp .env.example .env

# Editar com suas configurações REAIS
nano .env
```

### Variáveis obrigatórias de alterar no .env:

```env
# Trocar OBRIGATORIAMENTE:
POSTGRES_PASSWORD=SENHA_FORTE_BANCO_AQUI_123456
DATABASE_URL=postgresql+asyncpg://envox:SENHA_FORTE_BANCO_AQUI_123456@postgres:5432/envox_intel

# Gerar SECRET_KEY aleatória:
# python3 -c "import secrets; print(secrets.token_hex(32))"
SECRET_KEY=cole_aqui_a_chave_gerada_de_64_chars

# Trocar senha do admin:
ADMIN_PASSWORD=SENHA_FORTE_ADMIN_AQUI

# Trocar API Key de ingestão:
# python3 -c "import secrets; print('envox_' + secrets.token_urlsafe(32))"
API_KEY_SECRET=envox_cole_aqui_a_api_key_gerada

# Ambiente de produção:
APP_ENV=production

# CORS — domínio do seu painel:
ALLOWED_ORIGINS=https://painel.envox.com.br,https://seudominio.com
```

---

## ETAPA 6 — Subir os serviços com Docker Compose

```bash
cd /opt/envox-intel

# Subir tudo em background
docker compose up -d

# Verificar status dos containers
docker compose ps

# Acompanhar logs do backend (aguardar inicialização ~30s)
docker compose logs -f backend --tail=50
```

**O que deve aparecer nos logs:**
```
INFO app_starting name='ENVOX Intelligence' version='0.1.0'
INFO tables_created_or_verified
INFO default_source_created
INFO admin_user_created username='admin'
INFO scheduler_started jobs=['daily_summary', 'alert_scan', ...]
INFO app_ready host='0.0.0.0' port=8000
```

### Verificar se está funcionando:

```bash
# Testar API
curl http://localhost:8000/api/v1/health

# Deve retornar:
# {"status":"ok","app":"ENVOX Intelligence","version":"0.1.0",...}
```

---

## ETAPA 7 — Carregar dados de demonstração (opcional)

```bash
# Carregar seeds de dados realistas
docker compose exec backend python /seeds/seed_data.py

# Gerar primeiro resumo executivo
curl -X POST http://localhost:8000/api/v1/auth/token \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"SUA_SENHA_ADMIN"}'

# Use o token retornado para gerar o resumo:
curl -X POST http://localhost:8000/api/v1/summaries/generate \
  -H "Authorization: Bearer TOKEN_AQUI"
```

---

## ETAPA 8 — Configurar domínio e HTTPS (produção)

### 8.1 — Apontar domínio para o servidor

No seu provedor de DNS (Hostinger ou outro), crie um registro A:
```
painel.envox.com.br  →  SEU_IP_DO_SERVIDOR
```

### 8.2 — Configurar Nginx no servidor para usar domínio

Instalar Nginx no host (fora do Docker) para gerenciar TLS:

```bash
apt install -y nginx certbot python3-certbot-nginx

# Criar configuração
cat > /etc/nginx/sites-available/envox-intel << 'EOF'
server {
    listen 80;
    server_name painel.envox.com.br;

    # API Backend (porta 8000)
    location /api/ {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }

    # Swagger docs
    location /docs {
        proxy_pass http://localhost:8000/docs;
        proxy_set_header Host $host;
    }
    location /openapi.json {
        proxy_pass http://localhost:8000/openapi.json;
    }

    # Dashboard Frontend (porta 3000)
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
EOF

# Ativar configuração
ln -s /etc/nginx/sites-available/envox-intel /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# Gerar certificado SSL gratuito
certbot --nginx -d painel.envox.com.br
```

### 8.3 — Atualizar CORS no .env após configurar domínio

```bash
nano /opt/envox-intel/.env
# Trocar: ALLOWED_ORIGINS=https://painel.envox.com.br

# Reiniciar backend para aplicar
docker compose restart backend
```

---

## ETAPA 9 — Configurar Deploy Automático (CI/CD com GitHub)

Para que o servidor atualize automaticamente quando você fizer `git push`:

### 9.1 — Criar script de deploy no servidor

```bash
cat > /opt/envox-intel/scripts/deploy.sh << 'EOF'
#!/bin/bash
set -e

echo "[$(date)] Iniciando deploy ENVOX Intelligence..."
cd /opt/envox-intel

# Puxar atualizações do GitHub
git pull origin main

# Rebuild do backend se houver mudanças
docker compose build --no-cache backend

# Reiniciar com downtime mínimo
docker compose up -d --force-recreate backend

# Aplicar migrations se houver novas
docker compose exec -T backend alembic upgrade head 2>/dev/null || true

echo "[$(date)] Deploy concluído!"
EOF

chmod +x /opt/envox-intel/scripts/deploy.sh
```

### 9.2 — Opção A: Deploy manual simples (mais fácil)

```bash
# Na sua máquina local, sempre que quiser atualizar o servidor:
ssh usuario@SEU_IP "cd /opt/envox-intel && bash scripts/deploy.sh"
```

### 9.3 — Opção B: GitHub Actions (automático no push)

Crie o arquivo `.github/workflows/deploy.yml` no projeto:

```yaml
name: Deploy to Hostinger VPS

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd /opt/envox-intel
            bash scripts/deploy.sh
```

Configurar os secrets no GitHub:
- Acesse: **repo → Settings → Secrets → Actions**
- Adicione:
  - `VPS_HOST` = IP do servidor
  - `VPS_USER` = usuário SSH (ex: `envox`)
  - `VPS_SSH_KEY` = chave privada SSH do servidor

---

## ETAPA 10 — Firewall e Segurança

```bash
# Configurar UFW (firewall)
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh        # porta 22
ufw allow http       # porta 80
ufw allow https      # porta 443
ufw enable

# Verificar
ufw status
```

---

## ETAPA 11 — Manutenção e Monitoramento

### Ver logs em tempo real
```bash
# Todos os serviços
docker compose logs -f

# Só o backend
docker compose logs -f backend

# Só erros
docker compose logs backend | grep ERROR
```

### Backup do banco (adicionar ao crontab)
```bash
crontab -e
# Adicionar:
0 3 * * * cd /opt/envox-intel && docker compose exec -T postgres pg_dump -U envox envox_intel | gzip > /opt/backups/envox_$(date +\%Y\%m\%d).sql.gz
30 3 * * * find /opt/backups -name "envox_*.sql.gz" -mtime +30 -delete

# Criar pasta de backups
mkdir -p /opt/backups
```

### Atualizar o projeto

```bash
# No servidor:
cd /opt/envox-intel
git pull origin main
docker compose build --no-cache backend
docker compose up -d --force-recreate
```

---

## RESUMO RÁPIDO — Comandos Essenciais

```bash
# ===== NO SEU COMPUTADOR =====
# Subir código para o GitHub
git add . && git commit -m "minha mudança" && git push origin main

# ===== NO SERVIDOR HOSTINGER =====
# Atualizar servidor após push
cd /opt/envox-intel && bash scripts/deploy.sh

# Ver status
docker compose ps

# Ver logs
docker compose logs -f backend --tail=50

# Reiniciar
docker compose restart backend

# Parar tudo
docker compose down

# Subir tudo
docker compose up -d

# Backup manual do banco
docker compose exec -T postgres pg_dump -U envox envox_intel > backup.sql
```

---

## URLs após deploy

| Serviço | URL |
|---------|-----|
| Dashboard | https://painel.envox.com.br |
| API | https://painel.envox.com.br/api/v1 |
| Swagger UI | https://painel.envox.com.br/docs |
| Healthcheck | https://painel.envox.com.br/api/v1/health |

---

## Troubleshooting Comum

| Problema | Solução |
|---------|---------|
| Container não sobe | `docker compose logs backend` — verificar erro |
| Banco não conecta | `docker compose ps postgres` — verificar se healthcheck passou |
| Login não funciona | Verificar `ADMIN_PASSWORD` no `.env` |
| CORS error | Atualizar `ALLOWED_ORIGINS` no `.env` com o domínio correto |
| 502 Bad Gateway | `docker compose restart backend` |
| Porta já em uso | `fuser -k 8000/tcp` |
