# PROMPT PARA IA DO VPS HOSTINGER — ENVOX Intelligence

> Cole este prompt completo na IA do painel Hostinger (ou no terminal interativo).
> Ele foi escrito para ser executado com segurança em um servidor que já tem
> o projeto `proposta.envox.com.br` rodando — NADA será tocado nele.

---

## ✂️ INÍCIO DO PROMPT — COPIE A PARTIR DAQUI ↓

---

Olá! Preciso que você me ajude a instalar um segundo projeto no servidor, sem interferir em nada que já está rodando.

**CONTEXTO IMPORTANTE — leia antes de executar qualquer coisa:**
- Este servidor já tem um projeto rodando: `proposta.envox.com.br`
- Não sei exatamente como ele está configurado (pode ser Docker, PM2 ou Nginx direto)
- **Você NÃO deve parar, reiniciar, modificar ou tocar em nenhum container, serviço, processo ou arquivo que não seja do novo projeto `envox-intel`**
- Antes de executar qualquer comando que afete o sistema globalmente (como `docker system prune`, `apt upgrade`, `ufw reset`, reiniciar Nginx, etc.), me pergunte primeiro

---

## FASE 0 — DIAGNÓSTICO DO SERVIDOR (execute tudo antes de instalar qualquer coisa)

Antes de instalar qualquer coisa, preciso entender o que já existe no servidor.
Execute os comandos abaixo e me mostre o resultado completo de cada um:

```bash
# 1. Ver todos os containers Docker que estão rodando
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"

# 2. Ver todos os containers (incluindo parados)
docker ps -a --format "table {{.Names}}\t{{.Image}}\t{{.Status}}"

# 3. Ver quais redes Docker existem
docker network ls

# 4. Ver quais volumes Docker existem
docker volume ls

# 5. Ver quais portas estão em uso no servidor
ss -tlnp | grep -E ":(80|443|3000|3001|8000|8001|5432|5433)\s"

# 6. Ver se existe Nginx instalado no host (fora do Docker)
nginx -v 2>&1 || echo "Nginx não instalado no host"

# 7. Listar sites Nginx ativos (se existir)
ls /etc/nginx/sites-enabled/ 2>/dev/null || echo "Sem sites-enabled"

# 8. Ver processos relevantes rodando
ps aux | grep -E "nginx|node|python|uvicorn|gunicorn|pm2" | grep -v grep

# 9. Ver espaço em disco
df -h /

# 10. Ver memória disponível
free -h

# 11. Ver se já existe a pasta do projeto
ls /opt/ 2>/dev/null
```

**Aguarde minha autorização para continuar após ver esse diagnóstico.**

---

## FASE 1 — VERIFICAÇÕES DE SEGURANÇA

Com base no diagnóstico acima, confirme comigo:

1. Qual porta está usando o projeto `proposta.envox.com.br`? (80, 443, outra?)
2. Existe algum container com nome que contenha "proposta" ou "envox"?
3. O Nginx está instalado no host ou dentro de um container?
4. As portas `8000` e `3001` estão livres? (usaremos essas para o novo projeto)

**Só continue para a FASE 2 depois que eu confirmar.**

---

## FASE 2 — PREPARAR O AMBIENTE (sem tocar no que existe)

### 2.1 — Verificar se Git está instalado

```bash
git --version || apt install -y git
```

### 2.2 — Verificar se Docker está instalado

```bash
docker --version && docker compose version
```

Se Docker NÃO estiver instalado:
```bash
curl -fsSL https://get.docker.com | sh
```

Se Docker Compose plugin NÃO estiver disponível:
```bash
apt install -y docker-compose-plugin
```

### 2.3 — Criar pasta do projeto (isolada, não interfere em nada)

```bash
mkdir -p /opt/envox-intel
mkdir -p /opt/backups/envox-intel
```

---

## FASE 3 — CLONAR O REPOSITÓRIO

```bash
cd /opt/envox-intel
git clone https://github.com/farmaciasdemanipulacao/Envox-Termo-Clientes.git .
```

Se pedir autenticação, use seu token do GitHub (Personal Access Token com escopo `repo`).

Verificar se clonou corretamente:
```bash
ls /opt/envox-intel
# Deve mostrar: backend/ frontend/ infra/ docs/ seeds/ docker-compose.yml README.md ...
```

---

## FASE 4 — CONFIGURAR VARIÁVEIS DE AMBIENTE

```bash
cd /opt/envox-intel
cp .env.example .env
```

Agora edite o `.env`. **Me mostre o conteúdo do `.env.example` primeiro** para eu confirmar os valores antes de salvar:

```bash
cat .env.example
```

Após minha confirmação, edite o arquivo com os valores reais:

```bash
nano .env
```

**Valores que você DEVE alterar — me pergunte se tiver dúvida:**

```
# Banco de dados (senha forte, sem caracteres especiais problemáticos)
POSTGRES_USER=envox
POSTGRES_PASSWORD=<<DEFINA_UMA_SENHA_FORTE_AQUI>>
POSTGRES_DB=envox_intel
DATABASE_URL=postgresql+asyncpg://envox:<<MESMA_SENHA_ACIMA>>@postgres:5432/envox_intel

# Chave secreta JWT — gere assim:
# python3 -c "import secrets; print(secrets.token_hex(32))"
SECRET_KEY=<<COLE_AQUI_O_RESULTADO_DO_COMANDO_ACIMA>>

# Senha do painel de administração
ADMIN_PASSWORD=<<DEFINA_SENHA_DO_ADMIN>>

# API Key para ingestão de dados — gere assim:
# python3 -c "import secrets; print('envox_' + secrets.token_urlsafe(32))"
API_KEY_SECRET=<<COLE_AQUI_O_RESULTADO>>

# Ambiente
APP_ENV=production

# CORS — domínio que vai acessar o painel (ajuste depois)
ALLOWED_ORIGINS=http://localhost:3001,https://intel.envox.com.br
```

---

## FASE 5 — AJUSTAR O DOCKER-COMPOSE PARA NÃO CONFLITAR

**IMPORTANTE:** O `docker-compose.yml` original usa portas que podem conflitar.
Vamos verificar e ajustar ANTES de subir:

```bash
cat /opt/envox-intel/docker-compose.yml | grep -E "ports:|container_name:"
```

Se a porta `5432` já estiver em uso por outro PostgreSQL no servidor:
```bash
ss -tlnp | grep 5432
```

Se estiver em uso, edite o docker-compose.yml para usar porta diferente externamente:
```bash
# Trocar "5432:5432" por "5433:5432" para o PostgreSQL do envox-intel
sed -i 's/"5432:5432"/"5433:5432"/g' /opt/envox-intel/docker-compose.yml
```

Se a porta `8000` já estiver em uso:
```bash
ss -tlnp | grep 8000
```

Se estiver em uso, troque para `8001`:
```bash
sed -i 's/"8000:8000"/"8001:8000"/g' /opt/envox-intel/docker-compose.yml
```

Se a porta `3000` já estiver em uso (o projeto proposta pode estar usando):
```bash
ss -tlnp | grep 3000
```

Se estiver em uso, troque para `3001`:
```bash
sed -i 's/"3000:80"/"3001:80"/g' /opt/envox-intel/docker-compose.yml
```

Confirme as alterações:
```bash
cat /opt/envox-intel/docker-compose.yml | grep -E "ports:"
```

---

## FASE 6 — SUBIR OS CONTAINERS (apenas do envox-intel)

```bash
cd /opt/envox-intel

# Build e start — só afeta containers do envox-intel
docker compose up -d --build

# Verificar se os 3 containers subiram
docker compose ps
```

**O que esperar ver:**
```
NAME               STATUS          PORTS
envox-postgres     healthy         0.0.0.0:5432->5432/tcp  (ou 5433)
envox-backend      healthy         0.0.0.0:8000->8000/tcp  (ou 8001)
envox-frontend     Up              0.0.0.0:3000->80/tcp    (ou 3001)
```

Verificar logs do backend (aguardar ~30 segundos):
```bash
docker compose logs --tail=40 backend
```

Deve aparecer algo como:
```
INFO  app_starting name='ENVOX Intelligence'
INFO  tables_created_or_verified
INFO  admin_user_created
INFO  scheduler_started
INFO  Uvicorn running on http://0.0.0.0:8000
```

---

## FASE 7 — TESTAR SE ESTÁ FUNCIONANDO

```bash
# Substituir 8000 pela porta que configurou (8000 ou 8001)
curl -s http://localhost:8000/api/v1/health | python3 -m json.tool
```

Resposta esperada:
```json
{
  "status": "ok",
  "app": "ENVOX Intelligence",
  "version": "0.1.0"
}
```

Se retornar erro, me mostre os logs:
```bash
docker compose -f /opt/envox-intel/docker-compose.yml logs backend --tail=60
```

---

## FASE 8 — CONFIGURAR NGINX DO HOST (com cuidado total)

**⚠️ ATENÇÃO: Esta é a fase mais delicada. Siga exatamente como descrito.**

### 8.1 — Verificar configuração atual do Nginx

```bash
# Ver o que já existe — NÃO modificar nada ainda
cat /etc/nginx/sites-enabled/proposta.envox.com.br 2>/dev/null \
  || cat /etc/nginx/sites-enabled/default 2>/dev/null \
  || ls /etc/nginx/conf.d/ 2>/dev/null \
  || echo "Estrutura de configuração diferente — me mostre o resultado"

# Testar se nginx está OK agora (antes de qualquer mudança)
nginx -t
```

**Me mostre o resultado antes de continuar.**

### 8.2 — Criar configuração NOVA para o envox-intel (arquivo separado, não edita nada existente)

```bash
# Criar arquivo NOVO — não toca nos arquivos do proposta.envox.com.br
cat > /etc/nginx/sites-available/intel.envox.com.br << 'EOF'
server {
    listen 80;
    server_name intel.envox.com.br;

    # Logs separados — não mistura com outro projeto
    access_log /var/log/nginx/intel.envox.com.br.access.log;
    error_log  /var/log/nginx/intel.envox.com.br.error.log;

    # API Backend
    location /api/ {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        proxy_connect_timeout 10s;
    }

    # Swagger UI
    location /docs {
        proxy_pass http://localhost:8000/docs;
        proxy_set_header Host $host;
    }
    location /openapi.json {
        proxy_pass http://localhost:8000/openapi.json;
    }

    # Dashboard Frontend
    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
EOF
```

> **Nota:** Se você usou a porta padrão `3000` (não `3001`), troque `localhost:3001` por `localhost:3000` no bloco acima.

### 8.3 — Ativar e testar (SEM reiniciar — só reload)

```bash
# Ativar novo site
ln -s /etc/nginx/sites-available/intel.envox.com.br /etc/nginx/sites-enabled/

# Testar configuração — SE der erro, NÃO continue
nginx -t

# Se passou no teste, recarregar (reload é seguro — não derruba conexões)
systemctl reload nginx
```

### 8.4 — HTTPS com Let's Encrypt

```bash
# Instalar certbot se não tiver
apt install -y certbot python3-certbot-nginx

# Gerar certificado APENAS para o novo domínio
certbot --nginx -d intel.envox.com.br --non-interactive --agree-tos -m seu@email.com

# Verificar que proposta.envox.com.br continua OK
curl -s -o /dev/null -w "%{http_code}" https://proposta.envox.com.br
# Deve retornar 200
```

---

## FASE 9 — VERIFICAÇÃO FINAL DE SEGURANÇA

Execute tudo abaixo e me mostre os resultados:

```bash
# 1. Confirmar que os containers do envox-intel estão rodando
docker compose -f /opt/envox-intel/docker-compose.yml ps

# 2. Confirmar que o projeto proposta continua funcionando
curl -s -o /dev/null -w "proposta.envox.com.br: HTTP %{http_code}\n" https://proposta.envox.com.br

# 3. Confirmar que o novo projeto está funcionando
curl -s -o /dev/null -w "intel.envox.com.br: HTTP %{http_code}\n" https://intel.envox.com.br/api/v1/health

# 4. Confirmar que os containers do proposta NÃO foram reiniciados
docker ps --format "table {{.Names}}\t{{.Status}}" | grep -v envox-

# 5. Ver todos os containers rodando (visão geral final)
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
```

---

## FASE 10 — CARREGAR DADOS DE DEMONSTRAÇÃO (opcional)

```bash
# Carregar 450 mensagens simuladas para ver o dashboard funcionando
docker compose -f /opt/envox-intel/docker-compose.yml exec backend \
  python /seeds/seed_data.py
```

---

## FASE 11 — CONFIGURAR DEPLOY AUTOMÁTICO (opcional)

Para que o servidor atualize sozinho quando você fizer `git push`:

```bash
# Criar script de atualização
mkdir -p /opt/envox-intel/scripts

cat > /opt/envox-intel/scripts/deploy.sh << 'SCRIPT'
#!/bin/bash
set -e
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Iniciando deploy ENVOX Intelligence..."

cd /opt/envox-intel

# Puxar código novo do GitHub
git pull origin main

# Rebuild e restart APENAS do envox-intel — não toca em outros containers
docker compose build --no-cache backend
docker compose up -d --no-deps --force-recreate backend frontend

# Aguardar backend subir
sleep 15

# Health check
HTTP=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/v1/health)
if [ "$HTTP" = "200" ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Deploy OK — backend saudável"
else
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ❌ Deploy com problema — HTTP $HTTP"
  docker compose logs --tail=30 backend
  exit 1
fi
SCRIPT

chmod +x /opt/envox-intel/scripts/deploy.sh
echo "Script de deploy criado em /opt/envox-intel/scripts/deploy.sh"
```

Para atualizar manualmente a qualquer momento:
```bash
bash /opt/envox-intel/scripts/deploy.sh
```

---

## FASE 12 — BACKUP AUTOMÁTICO DO BANCO

```bash
# Criar diretório de backups
mkdir -p /opt/backups/envox-intel

# Adicionar ao crontab (backup diário às 3h da manhã)
(crontab -l 2>/dev/null; echo "0 3 * * * docker compose -f /opt/envox-intel/docker-compose.yml exec -T postgres pg_dump -U envox envox_intel | gzip > /opt/backups/envox-intel/backup_\$(date +\%Y\%m\%d_\%H\%M).sql.gz") | crontab -

# Limpeza de backups com mais de 30 dias
(crontab -l 2>/dev/null; echo "30 3 * * * find /opt/backups/envox-intel -name '*.sql.gz' -mtime +30 -delete") | crontab -

# Confirmar
crontab -l
```

---

## RESUMO FINAL — URLs e Comandos

Após concluir tudo, as URLs do sistema serão:

| Serviço | URL |
|---------|-----|
| Dashboard | https://intel.envox.com.br |
| API | https://intel.envox.com.br/api/v1 |
| Swagger UI | https://intel.envox.com.br/docs |
| Health Check | https://intel.envox.com.br/api/v1/health |

**Comandos do dia a dia no servidor:**
```bash
# Ver status
docker compose -f /opt/envox-intel/docker-compose.yml ps

# Ver logs
docker compose -f /opt/envox-intel/docker-compose.yml logs -f backend --tail=50

# Reiniciar só o backend
docker compose -f /opt/envox-intel/docker-compose.yml restart backend

# Atualizar após git push
bash /opt/envox-intel/scripts/deploy.sh
```

---

## ⚠️ REGRAS QUE A IA DEVE SEGUIR DURANTE TODA A EXECUÇÃO

1. **NUNCA execute** `docker system prune`, `docker volume prune` ou `docker network prune` sem minha autorização explícita
2. **NUNCA reinicie** o Nginx com `systemctl restart nginx` — use SEMPRE `systemctl reload nginx`
3. **NUNCA modifique** arquivos em `/etc/nginx/sites-enabled/` que não sejam `intel.envox.com.br`
4. **NUNCA pare** containers que não tenham o prefixo `envox-` (postgres, backend, frontend do envox-intel)
5. **SEMPRE mostre** o resultado do `nginx -t` antes de fazer reload
6. **SEMPRE verifique** se `proposta.envox.com.br` está respondendo após cada mudança no Nginx
7. **Se tiver dúvida** sobre qualquer comando que possa afetar o servidor globalmente, PERGUNTE antes

---

✂️ FIM DO PROMPT
