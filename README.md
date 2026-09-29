# 🌿 Jardín — catálogo de plantas

PWA (web instalable en el móvil) para llevar un catálogo de plantas con fotos.
Los datos y las fotos se guardan en **tu propio Google Drive**, en la carpeta `JardinApp/`. No hay servidor, así que cuesta 0 €.

- Crear ficha a partir de una foto (cámara o galería). La fecha se toma del EXIF.
- Editar la ficha y añadir más fotos, cada una con su fecha.
- Fechas flexibles: exacta (`2021-05-03`), mes (`2021-05`), año (`2021`), aproximada (`~2021`), antes o igual (`<=2021`) y después o igual (`>=2021`).
- Nombre científico sugerido a partir del común (Wikidata + GBIF, sin claves).
- Exportar un ZIP con `plants.csv`, `photos.csv`, `plants.json` y todas las fotos.

## Datos en Drive

```
JardinApp/
├── plants.json          ← catálogo (fuente de verdad)
└── photos/
    ├── P-001_20260929_ab12cd.jpg        (máx. 1600 px)
    └── P-001_20260929_ab12cd_thumb.jpg  (360 px)
```

La app usa el permiso `drive.file`, así que **solo puede ver los archivos que ella misma crea**, no el resto de tu Drive.
Guarda una copia local en IndexedDB para arrancar rápido y poder consultar sin conexión. Si editas desde dos dispositivos, los cambios se fusionan ficha a ficha y gana la edición más reciente.

## Configuración (una sola vez)

### 1. Credenciales de Google (gratis)

1. Entra en <https://console.cloud.google.com/> y crea un proyecto, por ejemplo `jardinapp`.
2. **APIs y servicios → Biblioteca** → busca **Google Drive API** → *Habilitar*.
3. **APIs y servicios → Pantalla de consentimiento de OAuth** (en la consola nueva: *Google Auth Platform*):
   - Tipo de usuario: **Externo**.
   - Rellena el nombre de la app y tu email.
   - En *Público / Usuarios de prueba*, **añade tu cuenta de Gmail**.
   - Deja la app en modo **Prueba (Testing)**. No hace falta publicarla ni verificarla.
4. **APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth**:
   - Tipo: **Aplicación web**.
   - *Orígenes de JavaScript autorizados*:
     - `http://localhost:5173`
     - `https://<tu-usuario>.github.io`
   - No hace falta ninguna URI de redirección.
5. Copia el **ID de cliente** (`xxxx.apps.googleusercontent.com`).

### 2. Desarrollo local

```bash
cp .env.example .env        # y pega el ID de cliente en VITE_GOOGLE_CLIENT_ID
npm install
npm run dev                 # http://localhost:5173
npm test
```

Para probar desde el móvil en la misma wifi: `npm run dev -- --host`. Ojo: Google solo acepta los orígenes autorizados en el paso 1, así que el login desde una IP local no funciona. Para el móvil usa la versión desplegada.

### 3. Despliegue en GitHub Pages (gratis)

1. Crea un repo en GitHub, por ejemplo `jardinapp`, y sube el código:
   ```bash
   git remote add origin git@github.com:<tu-usuario>/jardinapp.git
   git push -u origin main
   ```
2. En el repo, ve a **Settings → Secrets and variables → Actions → New repository secret**, crea `VITE_GOOGLE_CLIENT_ID` y pega ahí el ID de cliente.
3. En **Settings → Pages → Source**, elige **GitHub Actions**.
4. Cada push a `main` pasa los tests, compila y publica en `https://<tu-usuario>.github.io/jardinapp/`.

### 4. Instalar en el móvil

Abre la URL en el móvil:
- **Android (Chrome):** menú ⋮ → *Añadir a pantalla de inicio* / *Instalar app*.
- **iPhone (Safari):** botón compartir → *Añadir a pantalla de inicio*.

## Notas

- El token de Google dura 1 hora. Cuando caduca aparece el botón *Conectar* y basta un toque para renovarlo.
- Mientras la app esté en modo *Prueba*, Google puede pedirte que vuelvas a dar permiso cada cierto tiempo. Es normal.
- Borrar una ficha la oculta (la marca como borrada en `plants.json`). Borrar una foto la manda a la papelera de Drive.
- Si una planta muere, mejor pon la **fecha de defunción** que borrar la ficha. Las fichas con fecha de defunción salen en el filtro *Muertas*.

## Problemas al conectar con Google

| Error | Causa | Solución |
|---|---|---|
| `403 access_denied` | La cuenta con la que entras no está en *Usuarios de prueba* | En *Google Auth Platform → Público → Usuarios de prueba*, añade exactamente ese Gmail |
| `403`: «Access blocked» / «tu organización» | Cuenta de Google Workspace con apps externas bloqueadas | Usa un Gmail personal (añadido como usuario de prueba) |
| `400 origin_mismatch` | La URL no está en *Orígenes de JavaScript autorizados* | Añade el origen exacto (`http://localhost:5173`, no `127.0.0.1`; sin ruta ni barra final) |
| La app dice «Falta VITE_GOOGLE_CLIENT_ID» | No existe `.env` o el servidor se arrancó antes de crearlo | Crea `.env` y reinicia `npm run dev` |
| Login ok, luego `Drive 403` | La Google Drive API no está habilitada | *APIs y servicios → Biblioteca → Google Drive API → Habilitar* |

Los cambios en Google Cloud pueden tardar unos minutos en aplicarse.

## Stack

React 19 · Vite · TypeScript · vite-plugin-pwa · react-router · idb · exifr · JSZip · Vitest
