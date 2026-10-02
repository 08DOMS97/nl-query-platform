# Acceso remoto al banco de pruebas Docker

**Estado: no implementado — documentado por si se necesita más adelante.**
Decisión (01/10/2026): la presentación de la tesis se hace **en local**, así que
nada de esto hace falta por ahora.

## Cómo funciona hoy (todo local)

| Pieza | Dónde corre | Cómo se conecta |
|---|---|---|
| 4 bases (Postgres, MySQL, MariaDB, SQL Server) | PC local, Docker (`Bases de datos/docker-compose.yml`) | Backend → `localhost:5432/3306/3307/1433` (`DB_*` en `backend/.env`) |
| Backend (Express) | PC local, `localhost:8080` | — |
| Frontend (Next.js) | PC local | → backend vía `NEXT_PUBLIC_BACKEND_URL` |
| Vertex AI, Firebase Auth, Firestore | Nube (`proyectog-340d3`) | Backend/frontend → APIs de Google |

Firestore **no** contiene las 4 bases: solo guarda datos propios de NLQP
(`usageEvents`, y a futuro el historial). Las bases solo las toca el backend.

## El problema si se despliega

Si el backend pasa a Cloud Functions, `localhost` deja de ser la PC local y el
backend ya no alcanza los contenedores de Docker.

## Solución recomendada: túnel HTTPS al backend local

```
Navegador ──► Frontend (Firebase Hosting o local)
                 │ HTTPS
                 ▼
   https://<subdominio>.trycloudflare.com   ← Cloudflare Tunnel / ngrok (HTTP)
                 │
                 ▼
   PC local: backend localhost:8080 ──► Docker (4 bases, sin cambios)
```

- Se expone **solo el backend**, nunca las bases. El backend ya exige ID token de
  Firebase (`auth.middleware.ts`) y pasa todo SQL por el Query Safety Engine.
- No cambia código ni `backend/.env`; en el frontend solo cambia
  `NEXT_PUBLIC_BACKEND_URL` a la URL del túnel.
- Gratis: `cloudflared tunnel --url http://localhost:8080` (URL aleatoria que cambia
  en cada arranque; fija si se usa dominio propio) o `ngrok http 8080` (el plan
  gratuito da un dominio fijo).
- **Limitación:** requiere la PC encendida con Docker, backend y túnel corriendo
  (relevante si los 35 participantes de la encuesta lo usan en remoto).

Pasos al implementarlo:
1. Instalar `cloudflared` o `ngrok` y levantar el túnel apuntando a `localhost:8080`.
2. **Restringir CORS:** hoy `backend/src/index.ts` usa `cors()` abierto a cualquier
   origen. Con el backend accesible desde internet, limitarlo al origen del frontend
   (p. ej. `cors({ origin: ['https://proyectog-340d3.web.app', 'http://localhost:3000'] })`).
3. Poner la URL del túnel en `NEXT_PUBLIC_BACKEND_URL` y reconstruir el frontend.
4. Usar `npm start` (no `npm run dev`: `node --watch` reinicia el proceso sin motivo
   en Windows y corta peticiones en curso).

## Alternativa descartada: túnel TCP directo a las bases

Backend en Cloud Functions conectándose a las 4 bases por túneles TCP. Descartada:
expone las bases a internet con `testuser` (permisos amplios a propósito) **sin pasar
por el Query Safety Engine**, los túneles TCP gratuitos son limitados (ngrok pide
tarjeta) y agrega latencia y cortes, sin quitar la dependencia de la PC encendida.

## Si se necesita un despliegue real (sin depender de la PC)

- **VM en Compute Engine con el mismo `docker compose`** (recomendada): reutiliza
  scripts y datos tal cual, ~USD 15–30/mes, apagable entre pruebas. Conectar el
  backend por IP privada (conector de VPC sin servidor), sin abrir puertos públicos;
  acceso propio vía SSH/IAP.
- **Cloud SQL:** Postgres, MySQL y SQL Server administrados; MariaDB no está
  disponible (requeriría igual una VM). Más caro, sobre todo SQL Server.

En cualquier despliegue real: contraseñas en Secret Manager
(`secretManager.service.ts` ya existe, aún no se usa para las conexiones) y
`DB_MSSQL_TRUST_SERVER_CERTIFICATE=false`.
