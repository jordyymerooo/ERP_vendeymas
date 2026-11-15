# Despliegue local del ERP Vende & más

Docker Compose ejecuta Nginx con React compilado, Laravel en PHP-FPM, PostgreSQL y los procesos de cola y programación de Laravel. El navegador usa el mismo origen para la SPA y `/api`. Sanctum sigue autenticando con tokens Bearer. PostgreSQL escucha solo en la red interna de Compose. Los contenedores usan imágenes Linux tanto en Docker Desktop (WSL 2) como en Ubuntu Server.

## Primer arranque en Windows

Abre PowerShell 7 desde la raíz del repositorio en la rama `docker-local`. Comprueba que Docker Desktop esté en modo Linux con `docker version`. Crea un archivo **nuevo** para Compose. Este bloque conserva cualquier archivo existente y genera secretos aleatorios mediante .NET.

```powershell
if (Test-Path -LiteralPath .env.docker) { throw '.env.docker ya existe. Revisa sus valores.' }
$appKey = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
$dbAdminPassword = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(24))
$dbAppPassword = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(24))
(Get-Content -Raw .env.docker.example).
  Replace("APP_KEY=", "APP_KEY=base64:$appKey").
  Replace("POSTGRES_ADMIN_PASSWORD=", "POSTGRES_ADMIN_PASSWORD=$dbAdminPassword").
  Replace("DB_PASSWORD=", "DB_PASSWORD=$dbAppPassword") |
  Set-Content -LiteralPath .env.docker -Encoding utf8
```

`APP_KEY`, la contraseña de PostgreSQL y la contraseña del usuario SQL se guardan en `.env.docker`, excluido de Git y de las imágenes. Conserva una copia cifrada y restringe el acceso al archivo. Guarda la misma `APP_KEY` al trasladar la instalación, ya que Laravel la usa para cifrar datos. El archivo `backend/.env` de la instalación existente puede seguir usándose para trabajar fuera de Docker.

```powershell
docker compose --env-file .env.docker config --quiet
docker compose --env-file .env.docker build app nginx
docker compose --env-file .env.docker up -d --wait db
docker compose --env-file .env.docker run --rm --no-deps app sh /opt/erp/init.sh
docker compose --env-file .env.docker up -d --wait
docker compose --env-file .env.docker ps
```

`init.sh` ejecuta las migraciones en la base nueva de Compose. Los reinicios del ERP no ejecutan inicializaciones, importaciones ni seeders. Para instalar una actualización sobre datos existentes, toma un respaldo verificado y autoriza explícitamente la ejecución de `init.sh --allow-existing`. Conserva el mismo nombre de proyecto Compose para seguir usando sus volúmenes.

Abre **http://localhost:8080**. El endpoint `/up` indica que Laravel responde y `/api/user` requiere un token Bearer. Crea la primera cuenta administrativa con el procedimiento de la siguiente sección si partes de una base nueva. En una restauración se conservan las cuentas existentes.

## Primera cuenta de Gerencia

Ejecuta el script tras las migraciones si la base de usuarios está vacía. Lee la contraseña por entrada estándar y crea únicamente la cuenta inicial y los roles del ERP. Usa una contraseña única de al menos 16 caracteres (hasta 72 bytes).

```powershell
$erpAdminPassword = Read-Host 'Contraseña inicial de Gerencia' -MaskInput
$erpAdminPassword | docker compose --env-file .env.docker exec -T -u www-data app php /opt/erp/bootstrap-admin.php 'Gerencia' gerencia@tu-empresa.example
Remove-Variable erpAdminPassword
```

En Bash usa `read -rsp 'Contraseña inicial: ' erpAdminPassword`, y envía su valor con `printf '%s\n' "$erpAdminPassword" | docker compose ...`. Entra con el correo y la contraseña ya configurados.

## Operación habitual

```powershell
docker compose --env-file .env.docker logs --tail=100 app nginx worker scheduler
docker compose --env-file .env.docker exec -T -u www-data app php artisan migrate:status
docker compose --env-file .env.docker exec -T -u www-data app php artisan route:list --path=api
docker compose --env-file .env.docker exec -T -u www-data scheduler php artisan schedule:list
docker compose --env-file .env.docker stop
docker compose --env-file .env.docker up -d --wait
```

El volumen `postgres` contiene la base de datos. El volumen `storage` comparte los archivos de Laravel con PHP-FPM, el worker y el scheduler. Los contratos y los PDFs se abren por su API autenticada. Nginx sirve logos estáticos del frontend y rechaza el acceso directo a `/storage/`. Las firmas Base64 se conservan con la base de datos y las firmas impresas con el PDF correspondiente. El repositorio actual no define un directorio de carga exclusivo para avatares o fotos de propiedades. Los recursos estáticos se empaquetan en la imagen y los archivos que Laravel escriba en su disco público quedan en el volumen de almacenamiento.

Los servicios se reinician con el motor Docker. En Windows habilita el inicio de Docker Desktop al iniciar sesión y mantén el equipo servidor encendido. Tras un reinicio del host, Docker Desktop necesita arrancar antes de que los contenedores vuelvan a estar disponibles. El scheduler usa `America/Guayaquil` por defecto en Docker. El respaldo completo de Spatie está a las 18:00, la copia de base a las 18:10 y la limpieza a las 18:20. Configura SMTP con `MAIL_*` en `.env.docker` si se requiere entrega de correo. La configuración inicial utiliza el controlador de correo de log.

## Respaldo y restauración

El módulo del Super Admin descarga el último ZIP de Spatie. Los ZIP se guardan en la parte privada del volumen `storage`. Para una copia manual portable, el siguiente script genera un dump lógico de PostgreSQL, un archivo con los documentos y recibos, y un manifiesto SHA-256. Para un corte consistente antes de migrar, detén temporalmente los servicios que aceptan escrituras y ejecuta el respaldo desde un contenedor de una sola ejecución.

```powershell
docker compose --env-file .env.docker stop nginx worker scheduler
$backupBundle = docker compose --env-file .env.docker exec -T -u www-data app sh /opt/erp/backup.sh
if ($LASTEXITCODE -ne 0) { throw 'Falló el respaldo' }
New-Item -ItemType Directory -Force local-backups | Out-Null
docker compose --env-file .env.docker cp "app:${backupBundle}" ./local-backups/
docker compose --env-file .env.docker up -d --wait
```

Copia el paquete fuera del servidor y protege su acceso. Contiene datos y documentos del ERP. Mantén la clave de Laravel junto a tu inventario seguro de recuperación y conserva una copia anterior a cada actualización. El manifiesto detecta corrupción accidental. Restaura únicamente paquetes de un origen de confianza.

Para restaurar un paquete del script, usa una instalación Compose **distinta y vacía**, con su propio nombre de proyecto y volúmenes. Usa la `APP_KEY` del origen, contraseñas SQL nuevas y otro puerto si el origen sigue operativo. En el destino arranca solo `db`. Antes de restaurar, verifica el nombre y el directorio de destino, y obtén autorización si el paquete contiene datos reales.

```powershell
$restoreBundle = (Resolve-Path -LiteralPath './local-backups/NOMBRE_DEL_PAQUETE').Path
docker compose --env-file .env.docker -p sistema-inmo-recuperacion up -d --wait db
docker compose --env-file .env.docker -p sistema-inmo-recuperacion run --rm --no-deps -v "${restoreBundle}:/restore:ro" app sh /opt/erp/restore.sh --confirm-empty /restore
docker compose --env-file .env.docker -p sistema-inmo-recuperacion up -d --wait
```

La restauración falla si encuentra tablas o archivos de usuario en el destino. No ejecutes el inicializador de esquema ni el de administrador antes de restaurar. La copia incluye el historial de migraciones. En una migración desde una instalación anterior a Compose, prepara un dump en formato custom de PostgreSQL y un tar con raíz `public/` que corresponda a `backend/storage/app/public`. Crea `SHA256SUMS` con `sha256sum database.dump public-files.tar.gz > SHA256SUMS`. Verifica la versión del servidor origen antes de elegir el cliente de PostgreSQL para exportarlo. Prueba primero una restauración separada y valida el login y las descargas de contratos y recibos.

## Acceso desde la oficina

1. Identifica la IPv4 de la interfaz conectada a la oficina con `ipconfig` en Windows o `ip -br address` en Ubuntu. Pide una reserva DHCP para su dirección MAC o configura una IP fija de acuerdo con la red de la oficina.
2. Configura `ERP_BIND_ADDRESS=0.0.0.0` para mantener acceso local y por LAN, o usa la IPv4 específica del servidor para escuchar solo en esa interfaz. Ajusta `APP_URL=http://IP_DEL_SERVIDOR:8080` y recrea los servicios con `docker compose --env-file .env.docker up -d --wait`.
3. En PowerShell elevado, autoriza el puerto en el perfil privado y limita la regla a la subred de oficina. Sustituye el CIDR de ejemplo por el real. En Windows, verifica que la conexión tenga el perfil `Private`.
   ```powershell
   New-NetFirewallRule -DisplayName 'ERP inmobiliario LAN' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8080 -Profile Private -RemoteAddress 192.168.1.0/24
   ```
4. Abre `http://IP_DEL_SERVIDOR:8080` desde otra computadora. Si falla, comprueba el puerto con `Test-NetConnection IP_DEL_SERVIDOR -Port 8080` y verifica que el router permita tráfico entre clientes de la LAN. Mantén el puerto fuera de las reglas de reenvío a Internet.

## HTTPS empresarial

Para la operación habitual con datos de la oficina, instala un certificado cuyo SAN incluya el nombre interno del ERP y distribuye la CA a los clientes. Puedes terminar TLS en Nginx con una configuración adicional versionada fuera del repositorio de secretos y montajes de solo lectura para el certificado y la clave. Conserva las mismas ubicaciones de la SPA y FastCGI de `frontend/docker/nginx.conf`, añade `listen 443 ssl;`, `ssl_certificate` y `ssl_certificate_key`, y publica `443:443` desde una sobreescritura de Compose. Cambia `APP_URL` a `https://erp.oficina.example` y `SESSION_SECURE_COOKIE=true`. Si un proxy de borde termina TLS, configúralo para preservar Host y configura en Laravel el proxy de confianza antes de depender de `X-Forwarded-Proto`. Retira la exposición HTTP en LAN cuando HTTPS esté funcionando. Los enlaces de la SPA conservan el mismo origen en HTTPS.

## Ubuntu Server

Instala Docker Engine y el complemento Compose, activa el servicio del motor con `sudo systemctl enable --now docker` y copia o clona la rama `docker-local`. Crea `.env.docker` con permisos `0600`, usando por ejemplo `openssl rand -base64 32` para la parte Base64 de la clave y `openssl rand -hex 24` para cada contraseña. En una migración recupera la clave de la instalación origen. Ejecuta los mismos comandos de Compose. Limita el puerto publicado al adaptador de la oficina y aplica la política de firewall del host para el tráfico reenviado por Docker, por ejemplo mediante la cadena `DOCKER-USER` cuando Docker usa iptables. Comprueba esa regla desde una máquina permitida y desde una red fuera de la subred. Usa PostgreSQL 17 en el destino para una réplica de este despliegue y revisa la compatibilidad antes de cambiar de versión mayor.

Si actualizas el ERP, construye las imágenes con los lockfiles del repositorio, verifica un respaldo recuperable y aplica solo migraciones autorizadas. Usa respaldo lógico y copia de archivos para mover el ERP entre Windows y Linux.
