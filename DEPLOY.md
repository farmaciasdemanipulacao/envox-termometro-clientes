# ENVOX Intelligence — DEPLOY GUIDE

> Última atualização: 2026-06-16

---

## 1. Requisitos do Servidor

```
VPS Linux (Ubuntu 22.04 recomendado)
├── 2+ vCPU
├── 4+ GB RAM
├── 20+ GB disco
└── Docker + docker-compose instalados
```

### Instalar Docker no Ubuntu
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Fazer logout e login novamente
docker --version
docker compose version
```

---

## 2. Variáveis de Ambiente

Copie `.env.example` para `.env` e configure:

```bash
cp .env.example .env
nano .env
```

### Variáveis obrigatórias

```env
# === BANCO DE DADOS ===
POSTGRES_USER=envox
POSTGRES_PASSWORD=TROQUE_ESSA_SENHA_FORTE
POSTGRES_DB=envox_intel
DATABASE_URL=postgresql+asyncpg://envox:TROQUE_ESSA_SENHA_FORTE@postgres:5432/envox_intel

# === SEGURANÇA ===
SECRET_KEY=gere_uma_chave_de_64_chars_aleatorios_aqui
API_KEY_HASH=hash_da_api_key_para_ingestao  # gerado via script

# === APP ===
APP_ENV=production
APP_HOST=0.0.0.0
APP_PORT=8000
AUTO_MIGRATE=true
LOG_LEVEL=INFO

# === ANÁLISE ===
DATA_RETENTION_DAYS=90
SUMMARY_SCHEDULE_HOUR=6   # Job de resumo diário às 06:00
ALERT_SCAN_INTERVAL_MIN=15  # Scan de alertas a cada 15 min

# === IA (OPCIONAL) ===
OPENAI_API_KEY=              # Deixe vazio para usar só heurísticas
OPENAI_MODEL=gpt-4o-mini
LLM_ENABLED=false
```

### Gerar SECRET_KEY segura
```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

### Gerar API Key para ingestão
```bash
# Dentro do container backend (após subir):
docker compose exec backend python scripts/generate_api_key.py
# Anote a API Key gerada — não é recuperável
```

---

## 3. Subindo em Produção (VPS)

```bash
# 1. Clonar ou copiar o projeto no servidor
git clone <repo_url> envox-intel
cd envox-intel

# 2. Configurar ambiente
cp .env.example .env
nano .env  # Preencher todas as variáveis

# 3. Subir serviços
docker compose up -d

# 4. Verificar status
docker compose ps
docker compose logs -f backend --tail=50

# 5. Aplicar migrations (automático se AUTO_MIGRATE=true)
# Ou manualmente:
docker compose exec backend alembic upgrade head

# 6. Carregar seeds de teste (opcional)
docker compose exec backend python seeds/load_seeds.py

# 7. Acessar
# API: http://SEU_IP:8000
# Docs: http://SEU_IP:8000/docs
# Dashboard: http://SEU_IP:3000
```

---

## 4. Estrutura docker-compose

```yaml
services:
  postgres:    # Banco de dados
  backend:     # FastAPI app (porta 8000)
  frontend:    # Nginx servindo dashboard (porta 3000)
```

---

## 5. Nginx como Proxy Reverso (Recomendado)

Para expor tudo na porta 80/443 com domínio:

```nginx
# /etc/nginx/sites-available/envox-intel
server {
    listen 80;
    server_name painel.envox.com.br;

    location /api/ {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
    }
}
```

### TLS com Let's Encrypt
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d painel.envox.com.br
```

---

## 6. Comandos Úteis

```bash
# Ver logs em tempo real
docker compose logs -f backend

# Reiniciar backend
docker compose restart backend

# Acessar shell do container
docker compose exec backend bash
docker compose exec postgres psql -U envox envox_intel

# Backup do banco
docker compose exec postgres pg_dump -U envox envox_intel > backup_$(date +%Y%m%d).sql

# Restaurar backup
cat backup_20240616.sql | docker compose exec -T postgres psql -U envox envox_intel

# Ver migrations aplicadas
docker compose exec backend alembic history

# Aplicar nova migration
docker compose exec backend alembic upgrade head

# Gerar nova migration após mudança de model
docker compose exec backend alembic revision --autogenerate -m "descricao_da_mudanca"

# Parar tudo
docker compose down

# Parar e remover volumes (APAGA DADOS!)
docker compose down -v
```

---

## 7. Monitoramento Básico

```bash
# Healthcheck da API
curl http://localhost:8000/api/v1/health

# Status do banco
docker compose exec postgres pg_isready -U envox

# Uso de recursos
docker stats
```

---

## 8. Backup Automatizado (Cron)

```bash
# Adicionar ao crontab do servidor (crontab -e)
# Backup diário às 03:00
0 3 * * * cd /opt/envox-intel && docker compose exec -T postgres pg_dump -U envox envox_intel | gzip > /opt/backups/envox_$(date +\%Y\%m\%d).sql.gz

# Manter apenas 30 dias de backup
30 3 * * * find /opt/backups -name "envox_*.sql.gz" -mtime +30 -delete
```

---

## 9. Atualização do Sistema

```bash
# Fazer backup antes de atualizar
docker compose exec -T postgres pg_dump -U envox envox_intel > backup_pre_update.sql

# Puxar atualizações
git pull origin main

# Rebuild e restart
docker compose build --no-cache backend
docker compose up -d

# Aplicar migrations se houver
docker compose exec backend alembic upgrade head

# Verificar logs
docker compose logs -f backend --tail=100
```

---

## 10. Troubleshooting

### Backend não sobe
```bash
docker compose logs backend --tail=50
# Verificar: .env configurado? DATABASE_URL correto?
```

### Erro de conexão com banco
```bash
docker compose exec backend python -c "from app.db.session import engine; print('OK')"
# Se falhar: postgres está rodando? Credenciais corretas?
```

### Migrations falham
```bash
docker compose exec backend alembic current
docker compose exec backend alembic history
# Verificar schema do banco vs migrations
```
