#!/usr/bin/env bash
# deploy-frontend-manual.sh
# Use este script SE você quiser copiar os arquivos manualmente via SCP/SFTP.
# Ele apenas gera o tar.gz local e imprime os comandos exatos a executar.

set -euo pipefail

SERVER_USER="root"
SERVER_HOST="187.127.6.191"
SERVER_PATH="/opt/envox-intel/frontend/public"
LOCAL_SRC="/home/user/webapp/envox-intel/frontend/public"
ARCHIVE="/tmp/envox-frontend.tar.gz"

echo "=== Gerando pacote de deploy ==="
tar -czf "${ARCHIVE}" \
  -C "${LOCAL_SRC}" \
  index.html \
  tc-data.js \
  tc-shared.jsx \
  tc-screens-a.jsx \
  tc-screens-b.jsx \
  tc-wpp.jsx \
  tc-app.jsx \
  _ds

echo "Pacote criado: ${ARCHIVE} ($(du -sh "${ARCHIVE}" | cut -f1))"
echo ""
echo "=== Comandos para executar no servidor ==="
echo ""
echo "# 1. Copiar o pacote para o servidor:"
echo "scp ${ARCHIVE} ${SERVER_USER}@${SERVER_HOST}:/tmp/"
echo ""
echo "# 2. Conectar no servidor:"
echo "ssh ${SERVER_USER}@${SERVER_HOST}"
echo ""
echo "# 3. No servidor, executar:"
cat <<'EOF'
  # Fazer backup do index antigo
  cp /opt/envox-intel/frontend/public/index.html \
     /opt/envox-intel/frontend/public/index.html.bak

  # Extrair novos arquivos
  tar -xzf /tmp/envox-frontend.tar.gz \
      -C /opt/envox-intel/frontend/public/

  # Verificar arquivos
  ls -lh /opt/envox-intel/frontend/public/

  # Reiniciar container frontend
  cd /opt/envox-intel
  docker compose restart frontend

  # Testar
  sleep 3
  curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:8080/
  
  # Limpar
  rm /tmp/envox-frontend.tar.gz
EOF

echo ""
echo "=== Ou use rsync (mais rápido em futuros deploys) ==="
echo "rsync -avz --progress \\"
echo "  ${LOCAL_SRC}/ \\"
echo "  ${SERVER_USER}@${SERVER_HOST}:${SERVER_PATH}/"
echo ""
echo "  Depois: ssh ${SERVER_USER}@${SERVER_HOST} 'cd /opt/envox-intel && docker compose restart frontend'"
