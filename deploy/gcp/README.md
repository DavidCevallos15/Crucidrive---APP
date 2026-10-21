# Backend de prueba en Google Cloud (e2-micro gratis)

Para las pruebas de campo con datos móviles, sin Wi-Fi ni tu PC encendida (spec `specs/008-piloto/backend-de-prueba.md`, D-16). Una VM e2-micro del nivel gratuito de Google Cloud con el backend siempre encendido y HTTPS automático.

> Los comandos sirven en bash (Fedora) y en Git Bash (Windows) con la [CLI de gcloud](https://cloud.google.com/sdk/docs/install) instalada. Las claves **nunca** van al repo ni al chat: solo en `/etc/crucidrive/api.env` dentro de la VM.

## 1. Crear la VM (una sola vez)
El nivel gratuito cubre **una** e2-micro en `us-east1`, `us-central1` o `us-west1`, con 30 GB de disco estándar. `us-east1` es la más cercana a Ecuador.

```bash
gcloud auth login
gcloud config set project TU_PROYECTO

# IP externa fija: la URL de la app depende de ella
gcloud compute addresses create crucidrive-ip --region=us-east1
gcloud compute addresses describe crucidrive-ip --region=us-east1 --format='value(address)'

gcloud compute instances create crucidrive-api \
  --zone=us-east1-b --machine-type=e2-micro \
  --image-family=debian-12 --image-project=debian-cloud \
  --boot-disk-size=30GB --boot-disk-type=pd-standard \
  --address=crucidrive-ip --tags=crucidrive-web

gcloud compute firewall-rules create crucidrive-web \
  --allow=tcp:80,tcp:443 --target-tags=crucidrive-web
```

**Costo:** la VM y el disco entran en el nivel gratuito. Revisa en la [calculadora](https://cloud.google.com/products/calculator) si tu cuenta cobra la IP externa: si la cobra, son unos 3 USD al mes. Se incluye 1 GB de salida al mes; la app usa unos 0,7 MB por conductor cada 10 h.

## 2. Instalar el backend
```bash
gcloud compute ssh crucidrive-api --zone=us-east1-b
# Ya dentro de la VM:
git clone https://github.com/DavidCevallos15/Crucidrive---APP.git
cd Crucidrive---APP
sudo bash deploy/gcp/instalar.sh TU_IP_EXTERNA
```

La primera vez, el script te pide completar las claves:
```bash
sudo nano /etc/crucidrive/api.env      # ver api.env.ejemplo
sudo systemctl restart crucidrive-api
curl https://TU-IP-CON-GUIONES.sslip.io/   # debe responder {"status":"ok"}
```

`sslip.io` es un nombre gratuito que apunta a tu IP (por ejemplo, `34-75-10-20.sslip.io`). Caddy saca y renueva el certificado HTTPS solo.

## 3. Apuntar la app al servidor
En EAS, entorno **preview**:
```bash
cd frontend
npx eas-cli env:create --environment preview --name EXPO_PUBLIC_API_BASE_URL --value https://TU-IP-CON-GUIONES.sslip.io --visibility plaintext
npx eas-cli env:create --environment preview --name EXPO_PUBLIC_SOCKET_URL   --value https://TU-IP-CON-GUIONES.sslip.io --visibility plaintext
# Zona de prueba (opcional, 012 criterio 8a): sur,oeste,norte,este de tu ciudad
npx eas-cli env:create --environment preview --name EXPO_PUBLIC_ZONA_PRUEBA --value "-1.10,-80.50,-1.00,-80.40" --visibility plaintext
npx eas-cli build --profile preview --platform android
```
Si la variable ya existe, usa `env:update` en lugar de `env:create`. Sin `/api` al final ni barra.

## 4. Comprobar
Desde tu PC (con las cuentas de prueba en `backend/.env`, nunca en la VM):
```bash
cd backend
SMOKE_API=https://TU-IP-CON-GUIONES.sslip.io npm run smoke
```

## Actualizar el código
```bash
gcloud compute ssh crucidrive-api --zone=us-east1-b
cd Crucidrive---APP && git pull && sudo bash deploy/gcp/instalar.sh TU_IP_EXTERNA
```
Antes de actualizar, aplica en Supabase las migraciones nuevas. Al reiniciar, el despacho recupera los viajes abiertos desde la base de datos.

## Ver qué pasa
```bash
sudo journalctl -u crucidrive-api -f      # registro del backend
sudo journalctl -u caddy -f               # HTTPS
sudo systemctl status crucidrive-api
```

## Límites
- **Una sola instancia.** El despacho guarda temporizadores y conexiones en memoria; no se escala con más VMs.
- **Solo para pruebas.** El hosting del piloto se decide en el paso 008.
