# NLQP en Docker

Desde el 24/10/2026, NLQP (frontend + backend) se instala con Docker. Para llevarlo a otro
equipo hacen falta tres cosas: el repositorio, un archivo de configuración (`nlqp/.env`)
y la credencial de Google Cloud. Las bases de datos no van en estos contenedores: son las
de la organización o el banco de pruebas de `Bases de datos/docker-compose.yml`, que se
levanta aparte. Vertex AI, Firebase Auth, Firestore y Secret Manager siguen en GCP
(despliegue híbrido).

## 1. Qué se levanta

| Contenedor | Imagen | Puerto | Quién lo ve |
|---|---|---|---|
| `frontend` | `nlqp-frontend` (Next.js standalone) | 3000 | La red (LAN/VPN): es la dirección que se abre en el navegador |
| `backend` | `nlqp-backend` (Express) | 8080 | Solo esta máquina (`127.0.0.1`), para scripts y pruebas |

El navegador llama a `/api/...` en el puerto 3000, y el frontend lo reenvía al backend por
la red interna de Docker. Por eso:
- el backend no queda expuesto en la red;
- no hace falta CORS;
- la imagen no depende de la IP del servidor.

El reenvío espera hasta 61 min, más que el tope máximo de una conexión (60 min).
Verificado con una consulta de 48 s; el valor por defecto de Next corta a los 30 s.

## 2. Instalar en un equipo nuevo

Requisitos: Docker (Docker Desktop en Windows o Mac; Docker Engine + Compose en Linux) e
internet para construir la imagen (Next descarga la fuente IBM Plex al construir).

```powershell
git clone https://github.com/08DOMS97/nl-query-platform.git
cd nl-query-platform/nlqp
copy .env.example .env          # Linux/Mac: cp .env.example .env
# completar .env (sección 3) y dejar la credencial donde indica GCP_CREDENTIALS_FILE
docker compose up -d --build
docker compose ps               # los dos deben quedar "healthy"
```

Después se abre `http://<IP-del-servidor>:3000` desde cualquier equipo de la red. En
Windows, la primera vez el firewall puede pedir permiso para Docker en el puerto 3000.

Comandos de uso:

| Para… | Comando (en `nlqp/`) |
|---|---|
| Ver el estado | `docker compose ps` |
| Ver los registros | `docker compose logs -f backend` |
| Actualizar después de un `git pull` | `docker compose up -d --build` |
| Detener | `docker compose down` |

## 3. Configuración (`nlqp/.env`)

`nlqp/.env` no se commitea (`nlqp/.gitignore`). La plantilla, con la explicación de cada
variable, es `nlqp/.env.example`. Ninguna variable es secreta:
- `GCP_*`, `VERTEX_AI_MODEL`, `FIREBASE_PROJECT_ID`: los mismos de `backend/.env`.
- `NEXT_PUBLIC_FIREBASE_*`: los mismos de `frontend/.env.local`. Es la configuración
  pública de Firebase: el navegador la recibe igual.
- `GCP_CREDENTIALS_FILE`: ruta en esta máquina a la credencial de Google Cloud (sección 4).

Lo que el contenedor del backend **no** recibe:
- Las contraseñas de las bases: están en Secret Manager.
- Las de los usuarios de prueba: siguen solo en `backend/.env`, que usan las pruebas desde
  la máquina.
- `NLQP_ALLOW_DEV_AUTH_BYPASS`: queda fijo en `false`.

## 4. La credencial de Google Cloud

Es el único secreto. Se monta como *secreto de compose*: un archivo de solo lectura en
`/run/secrets/gcp_credentials`. No entra en la imagen ni en las variables de entorno.

Opciones:
1. **La de gcloud del usuario** (la que se usa hoy en esta PC). Se genera con
   `gcloud auth application-default login`:
   - Windows: `C:/Users/<usuario>/AppData/Roaming/gcloud/application_default_credentials.json`
   - Linux: `~/.config/gcloud/application_default_credentials.json`

   Sirve para la demo, pero el backend actúa con los permisos de esa persona.
2. **Una cuenta de servicio** con solo los permisos necesarios (recomendada para la
   instalación en la organización):
   - Vertex AI User
   - Cloud Datastore User
   - Secret Manager Secret Accessor y Secret Version Adder (para dar de alta o editar
     conexiones)
   - Firebase Authentication Admin (para la pantalla Usuarios)

   Se descarga su llave JSON y `GCP_CREDENTIALS_FILE` apunta a ella; conviene guardarla
   en `nlqp/credenciales/`, que no se commitea. Crear la cuenta y la llave no cuesta
   nada, pero es una decisión de David: **pendiente**.

En Linux, el archivo debe poder leerlo el usuario 1000 (el usuario `node` del contenedor).

## 5. Las bases de datos

Las conexiones se registran en Firestore con su servidor y puerto. Dentro de un
contenedor, `localhost` es el propio contenedor. Por eso el backend se levanta con
`NLQP_LOCALHOST_ALIAS=host.docker.internal`: una conexión registrada como `localhost`
llega a la máquina anfitriona, donde están el banco de pruebas o las bases del mismo
servidor. Las mismas conexiones sirven con y sin Docker
(`connectionManager.service.ts`, `networkHost`). Una base en otro servidor se registra
con su IP o nombre, como siempre.

Banco de pruebas en la misma máquina: `cd "Bases de datos"; docker compose up -d`.

## 6. Seguridad de los contenedores

- Usuario sin privilegios (`node`), sistema de archivos de solo lectura (con `/tmp` en
  memoria), `no-new-privileges` y sin capacidades de Linux (`cap_drop: ALL`).
- Las imágenes no tienen ningún `.env` ni credenciales. Verificado el 24/10 buscando en
  todo el sistema de archivos de ambas.
- `.dockerignore` excluye los `.env`, `node_modules`, la compilación local y los scripts.
- Pendiente fuera de esta carpeta (decisión de David, `SEGURIDAD.md`):
  - el compose de `Bases de datos/` publica los puertos de los 4 motores en todas las
    interfaces;
  - sus contraseñas siguen en `Bases de datos/README.md`.

## 7. Pruebas con Docker

Con los contenedores arriba, las mismas pruebas de siempre funcionan sin cambios (el
backend responde en `127.0.0.1:8080` y el frontend en `:3000`). El 24/10:
- `npm run test:api`: 358/358 (incluye la exportación a Excel)
- `npm run test:seguridad`: 57/57 + 200/200
- `npm run test:ui`: 102/102

`ui_consultar` intercepta tanto `:8080` como `/api/`, así que nunca llama a Gemini.

Antes de levantar Docker hay que detener el backend y el frontend locales
(`npm start` / `npm run dev`): usan los mismos puertos. Para volver a la forma anterior:
`docker compose down` y los comandos de `CLAUDE.md`.
