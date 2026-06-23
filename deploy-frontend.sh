#!/usr/bin/env bash
# deploy-frontend.sh
# Empacota os novos arquivos do frontend e os copia para o servidor via SCP.
# Execute: bash deploy-frontend.sh
# Pré-requisito: SSH configurado para o host remoto (chave ou senha).

set -euo pipefail

SERVER_USER="${SERVER_USER:-root}"
SERVER_HOST="${SERVER_HOST:-187.127.6.191}"
SERVER_PATH="/opt/envox-intel/frontend/public"
LOCAL_SRC="/home/user/webapp/envox-intel/frontend/public"
ARCHIVE="/tmp/envox-frontend-$(date +%Y%m%d%H%M%S).tar.gz"

echo "=== ENVOX Intel — Deploy Frontend ==="
echo "Servidor : ${SERVER_USER}@${SERVER_HOST}:${SERVER_PATH}"
echo "Origem   : ${LOCAL_SRC}"
echo ""

# 1. Criar arquivo tar.gz com os novos arquivos
echo "[1/4] Empacotando arquivos..."
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
echo "      → ${ARCHIVE} ($(du -sh "${ARCHIVE}" | cut -f1))"

# 2. Enviar arquivo para o servidor
echo "[2/4] Enviando para o servidor..."
scp "${ARCHIVE}" "${SERVER_USER}@${SERVER_HOST}:/tmp/"

REMOTE_ARCHIVE=$(basename "${ARCHIVE}")

# 3. Extrair no servidor e reiniciar container
echo "[3/4] Extraindo e reiniciando container no servidor..."
ssh "${SERVER_USER}@${SERVER_HOST}" bash <<REMOTE_SCRIPT
  set -e
  echo "  → Fazendo backup do index.html atual..."
  cp -f ${SERVER_PATH}/index.html ${SERVER_PATH}/index.html.bak 2>/dev/null || true

  echo "  → Extraindo arquivos novos..."
  tar -xzf /tmp/${REMOTE_ARCHIVE} -C ${SERVER_PATH}

  echo "  → Ajustando permissões..."
  chown -R root:root ${SERVER_PATH} 2>/dev/null || true
  chmod -R 644 ${SERVER_PATH}/*.html ${SERVER_PATH}/*.jsx ${SERVER_PATH}/*.js 2>/dev/null || true
  chmod 755 ${SERVER_PATH} ${SERVER_PATH}/_ds 2>/dev/null || true

  echo "  → Listando arquivos implantados:"
  ls -lh ${SERVER_PATH}/

  echo "  → Reiniciando container frontend..."
  cd /opt/envox-intel && docker compose restart frontend

  echo "  → Limpando arquivo temporário..."
  rm -f /tmp/${REMOTE_ARCHIVE}

  echo "  ✅ Deploy concluído!"
REMOTE_SCRIPT

# 4. Teste rápido
echo "[4/4] Testando acesso ao frontend..."
sleep 3
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://${SERVER_HOST}:8080/" 2>/dev/null || echo "ERR")
if [ "${HTTP_CODE}" = "200" ]; then
  echo "      ✅ Frontend respondendo: HTTP ${HTTP_CODE}"
else
  echo "      ⚠️  HTTP code: ${HTTP_CODE} — verifique o container"
fi

echo ""
echo "=== URLs de acesso ==="
echo "  Frontend : http://${SERVER_HOST}:8080"
echo "  Backend  : http://${SERVER_HOST}:8000"
echo "  API Docs : http://${SERVER_HOST}:8000/docs"
echo ""
echo "rm -f ${ARCHIVE}"
rm -f "${ARCHIVE}"
