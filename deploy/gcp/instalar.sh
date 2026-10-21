#!/usr/bin/env bash
# Instala el backend de CruciDrive en una VM Debian 12 (e2-micro de Google Cloud).
# Uso, desde la carpeta del repo clonado en la VM:  sudo bash deploy/gcp/instalar.sh <IP_EXTERNA>
# Se puede volver a correr: actualiza el código y reinicia el servicio.
set -euo pipefail

IP="${1:-}"
if [[ ! "$IP" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]]; then
  echo "Uso: sudo bash deploy/gcp/instalar.sh <IP_EXTERNA>  (por ejemplo 34.75.10.20)" >&2
  exit 1
fi
if [[ $EUID -ne 0 ]]; then
  echo "Corre el script con sudo." >&2
  exit 1
fi

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DESTINO=/opt/crucidrive
DOMINIO="${IP//./-}.sslip.io"

echo "==> Memoria de intercambio (1 GB): la e2-micro tiene 1 GB de RAM y npm la necesita"
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 1G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "==> Paquetes base, Node 22 y Caddy"
apt-get update -y
apt-get install -y curl ca-certificates gnupg git rsync debian-keyring debian-archive-keyring apt-transport-https
if ! command -v node >/dev/null || [[ "$(node -v)" != v22* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
fi

echo "==> Usuario y código en $DESTINO"
id crucidrive >/dev/null 2>&1 || useradd --system --home "$DESTINO" --shell /usr/sbin/nologin crucidrive
mkdir -p "$DESTINO"
# Solo el backend: el resto del repo no hace falta en el servidor.
rsync -a --delete --exclude node_modules --exclude .env "$REPO/backend/" "$DESTINO/backend/"
cd "$DESTINO/backend"
npm ci --omit=dev
chown -R crucidrive:crucidrive "$DESTINO"

echo "==> Claves en /etc/crucidrive/api.env"
mkdir -p /etc/crucidrive
if [[ ! -f /etc/crucidrive/api.env ]]; then
  cp "$REPO/deploy/gcp/api.env.ejemplo" /etc/crucidrive/api.env
  NUEVO_ENV=1
fi
chown root:crucidrive /etc/crucidrive/api.env
chmod 640 /etc/crucidrive/api.env

echo "==> Servicio y HTTPS para https://$DOMINIO"
cp "$REPO/deploy/gcp/crucidrive-api.service" /etc/systemd/system/crucidrive-api.service
sed "s/^DOMINIO {/$DOMINIO {/" "$REPO/deploy/gcp/Caddyfile" > /etc/caddy/Caddyfile
systemctl daemon-reload
systemctl enable crucidrive-api caddy
systemctl reload-or-restart caddy

if [[ "${NUEVO_ENV:-0}" == 1 ]]; then
  echo
  echo "Falta completar las claves: sudo nano /etc/crucidrive/api.env"
  echo "Después: sudo systemctl restart crucidrive-api && curl https://$DOMINIO/"
  exit 0
fi

systemctl restart crucidrive-api
sleep 3
systemctl --no-pager --lines=5 status crucidrive-api || true
echo
echo "Listo. Prueba: curl https://$DOMINIO/   (debe responder {\"status\":\"ok\"})"
echo "En EAS (preview): EXPO_PUBLIC_API_BASE_URL y EXPO_PUBLIC_SOCKET_URL = https://$DOMINIO"
