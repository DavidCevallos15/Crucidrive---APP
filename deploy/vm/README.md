# Backend de prueba en una VM de Azure

Para las pruebas de campo con datos móviles, sin Wi-Fi ni tu PC encendida (spec `specs/008-piloto/backend-de-prueba.md`, D-16). Una VM de Azure siempre encendida con el backend, HTTPS automático y reinicio automático. El instalador sirve en cualquier Ubuntu o Debian.

> Los comandos sirven en bash (Fedora) y en Git Bash o PowerShell (Windows) con la [CLI de Azure](https://learn.microsoft.com/cli/azure/install-azure-cli) (`az`). Las claves **nunca** van al repo ni al chat: solo en `/etc/crucidrive/api.env` dentro de la VM.

## 0. Datos de tu VM
La tuya se llama `crucidrive-api`, con la IP pública `crucidrive-apipublicip`. Anota el **grupo de recursos** (en el portal: la VM → *Overview* → *Resource group*) y la **IP pública** (el valor de `crucidrive-apipublicip`).

```bash
az login
GRUPO=TU_GRUPO_DE_RECURSOS
az vm show -g $GRUPO -n crucidrive-api --query "{tamano:hardwareProfile.vmSize, so:storageProfile.imageReference.offer, version:storageProfile.imageReference.sku}" -o table
az network public-ip show -g $GRUPO -n crucidrive-apipublicip --query "{ip:ipAddress, asignacion:publicIPAllocationMethod}" -o table
```
La asignación debe decir **Static**: si fuera Dynamic, la IP cambia al apagar la VM y la app dejaría de encontrarla.

## 1. Abrir los puertos 80 y 443
En Azure, el grupo de seguridad de red bloquea todo menos SSH. Caddy necesita el 80 (para sacar el certificado) y el 443:

```bash
az vm open-port -g $GRUPO -n crucidrive-api --port 80  --priority 1010
az vm open-port -g $GRUPO -n crucidrive-api --port 443 --priority 1020
```

## 2. (Opcional) Un nombre con la etiqueta DNS de Azure
Sin esto, el instalador usa `<IP-con-guiones>.sslip.io`, que funciona igual. Con la etiqueta DNS tienes un nombre más legible y gratis, por ejemplo `crucidrive-api.eastus.cloudapp.azure.com`:

```bash
az network public-ip update -g $GRUPO -n crucidrive-apipublicip --dns-name crucidrive-api
az network public-ip show -g $GRUPO -n crucidrive-apipublicip --query dnsSettings.fqdn -o tsv
```
Usa el resultado como segundo argumento del instalador. Si el nombre ya está tomado, cambia `crucidrive-api` por otro.

## 3. Instalar el backend
```bash
ssh TU_USUARIO@TU_IP                # el usuario administrador que pusiste al crear la VM
git clone https://github.com/DavidCevallos15/Crucidrive---APP.git
cd Crucidrive---APP
sudo bash deploy/vm/instalar.sh TU_IP                 # con sslip.io
# o, con la etiqueta DNS de Azure:
# sudo bash deploy/vm/instalar.sh TU_IP crucidrive-api.eastus.cloudapp.azure.com
```

La primera vez, el script te pide completar las claves:
```bash
sudo nano /etc/crucidrive/api.env      # ver api.env.ejemplo
sudo systemctl restart crucidrive-api
curl https://TU-DOMINIO/               # debe responder {"status":"ok"}
```

## 4. Apuntar la app al servidor
En EAS, entorno **preview** (la URL es `https://TU-DOMINIO`, sin `/api` ni barra al final):
```bash
cd frontend
npx eas-cli env:create --environment preview --name EXPO_PUBLIC_API_BASE_URL --value https://TU-DOMINIO --visibility plaintext
npx eas-cli env:create --environment preview --name EXPO_PUBLIC_SOCKET_URL   --value https://TU-DOMINIO --visibility plaintext
# Zona de prueba (opcional, 012 criterio 8a): sur,oeste,norte,este de tu ciudad
npx eas-cli env:create --environment preview --name EXPO_PUBLIC_ZONA_PRUEBA --value "-1.10,-80.50,-1.00,-80.40" --visibility plaintext
npx eas-cli build --profile preview --platform android
```
Si la variable ya existe, usa `env:update` en lugar de `env:create`.

## 5. Comprobar
Desde tu PC (con las cuentas de prueba en `backend/.env`, nunca en la VM):
```bash
cd backend
SMOKE_API=https://TU-DOMINIO npm run smoke
```

## Actualizar el código
```bash
ssh TU_USUARIO@TU_IP
cd Crucidrive---APP && git pull && sudo bash deploy/vm/instalar.sh TU_IP [TU_DOMINIO]
```
Antes de actualizar, aplica en Supabase las migraciones nuevas. Al reiniciar, el despacho recupera los viajes abiertos desde la base de datos.

## Ver qué pasa
```bash
sudo journalctl -u crucidrive-api -f      # registro del backend
sudo journalctl -u caddy -f               # HTTPS
sudo systemctl status crucidrive-api
```

## Costo y cuidados (Azure for Students)
- Hasta el 26 oct llevas **0,94 USD**: la IP pública 0,55 y el disco 0,39; el cómputo marcó 0,00. Eso es unos 4 USD al mes por IP y disco, dentro del tope de 25 USD de la regla 5 y del crédito de Azure for Students.
- **No detengas la VM** desde el portal: apagada, el despacho deja de funcionar y la IP fija se sigue cobrando.
- Crea una alerta de presupuesto: *Cost Management → Budgets → Add*, por ejemplo 10 USD al mes con aviso a tu correo.
- La VM tiene poca RAM: el instalador crea 1 GB de intercambio (swap) para que `npm ci` no falle.

## Límites
- **Una sola instancia.** El despacho guarda temporizadores y conexiones en memoria; no se escala con más VMs.
- **Solo para pruebas.** El hosting del piloto se decide en el paso 008.
- **No lo probé en una VM real**: la instalación y los comandos de `az` los corres tú. Si algo falla, pásame el mensaje.
