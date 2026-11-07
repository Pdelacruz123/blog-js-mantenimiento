# Blog JS — proyecto de mantenimiento

Blog con backend en **Node.js + Express + PostgreSQL** y frontend en HTML, CSS y JavaScript (jQuery + Bootstrap). Es un proyecto de mantenimiento de software: partió de un blog muy básico y se fue ampliando con cambios documentados.

## Proyecto base

El desarrollo parte de este repositorio:

- **https://github.com/zorrobyte/blog-js-project** (autor: Zorrobyte, octubre de 2024)
- Punto de partida exacto: commit `5c78a03` ("git link update") del repositorio base.

El proyecto empezó siendo muy poco: unas pocas pantallas estáticas (`index`, `login`, `register`, `create-post`) y un login muy simple. Eso es lo que tenía el repositorio base:

- Registro e inicio de sesión (contraseñas con bcrypt, sesión con JWT).
- Publicaciones con crear, listar, editar y borrar, solo para su autor.
- Dos tablas en PostgreSQL: `users` y `posts`.
- Un único archivo de servidor (`server.js`) con 7 endpoints.

## Cambios respecto al proyecto base

Esta lista sale de comparar el código actual con el commit `5c78a03` y de los documentos `Blog_R01-R05.txt` y `Blog_R06-R08.txt`. Solo incluye lo que está en el código.

| Código | Cambio |
|---|---|
| R01 | Comentarios en los posts, con calificación opcional de 1 a 5 estrellas (tabla `comments`). Solo el autor borra su comentario. |
| R02 | Imagen opcional en los posts (máx. 5 MB, solo imágenes), con vista previa al crear. |
| R03 | Foto de perfil, usada como avatar en posts y comentarios. |
| R04 | Pantalla nueva "Editar perfil" (`edit-profile.html`). |
| R05 | Perfil con fecha de nacimiento, género y descripción. |
| R06 | Búsqueda por título, contenido o autor, y paginación (5 posts por página, botón "Load more"). |
| R07 | Edición de posts en una ventana modal, con cambio o borrado de la imagen. |
| R08 | Perfil público del autor (`profile.html`) con edad, estadísticas y calificación promedio recibida. |

Otros cambios que aparecen en el código:

- **Perfil ampliado:** ubicación, ocupación y sitio web.
- **Notificaciones:** aviso en vivo (Server-Sent Events) cuando alguien comenta tus posts.
- **Orden del feed:** más nuevos, mejor calificados o más comentados (`sort`).
- **Interfaz compartida:** estilos y scripts comunes en `public/css/app.css` y `public/js/`, con tema claro/oscuro y selector de paleta.
- **Recuperación de contraseña:** existe el enlace en el login y la pantalla `forgot-password.html`, pero no hay endpoint en el backend.
- **Base de datos:** `database.sql` ahora crea el esquema completo, y `migrations/` actualiza una base creada con el esquema original.
- **Dependencias:** se añadió `multer` para subir archivos.
- **Servidor:** `server.js` pasó de unas 190 líneas con 7 endpoints a unos 570 con 16.

## Requisitos

- [Node.js](https://nodejs.org/) y npm
- [PostgreSQL](https://www.postgresql.org/download/)

## Instalación en otra PC

```bash
git clone https://github.com/Pdelacruz123/blog-js-mantenimiento.git
cd blog-js-mantenimiento/backend
npm install
```

**1. Variables de entorno.** Copia `backend/.env.example` a `backend/.env` y rellena los valores:

```
PORT=5001
PG_USER=tu_usuario
PG_PASSWORD=tu_contraseña
PG_HOST=localhost
PG_DATABASE=blog_app
PG_PORT=5432
JWT_SECRET=una_clave_larga_y_secreta
```

**2. Base de datos nueva.** Basta con `database.sql`:

```bash
psql -U postgres -c "CREATE DATABASE blog_app;"
psql -U postgres -d blog_app -f database.sql
```

Si ya tienes una base creada con el esquema original, ejecuta en orden `migrations/001_profile_images_ratings.sql` y `migrations/002_profile_extra_notifications.sql`. Se pueden repetir sin problema.

**3. Ejecutar.** Hazlo desde `backend/`, porque el servidor busca `../public` desde esa carpeta:

```bash
node server.js
```

Abre `http://localhost:5001`. La carpeta `backend/uploads/` se crea sola.

## Estructura

```
├── backend/
│   ├── server.js          # Servidor Express y API
│   ├── database.sql       # Esquema completo
│   ├── migrations/        # Para bases creadas con el esquema original
│   ├── .env.example       # Plantilla de variables de entorno
│   └── package.json
├── public/                # Frontend (html, css/, js/)
├── architecture.html      # Diagrama de arquitectura
├── Blog_R01-R05.txt       # Cambios solicitados R01 a R05
├── Blog_R06-R08.txt       # Cambios solicitados R06 a R08
└── readme.md
```

## API

- **Autenticación:** `POST /api/register`, `POST /api/login`
- **Perfil:** `GET /api/profile`, `PUT /api/profile` (con sesión), `GET /api/users/:id` (público)
- **Posts:** `GET /api/posts` (parámetros `q`, `author`, `limit`, `offset`, `sort`; total en el header `X-Total-Count`), `GET /api/posts/:id`, `POST /api/posts`, `PUT /api/posts/:id`, `DELETE /api/posts/:id` (las tres últimas, con sesión; editar y borrar solo el autor)
- **Comentarios:** `GET` y `POST /api/posts/:id/comments`, `DELETE /api/comments/:id`
- **Notificaciones:** `GET /api/notifications`, `POST /api/notifications/read`, `GET /api/notifications/stream?token=JWT`

## Notas

- PostgreSQL debe estar en ejecución antes de iniciar el servidor.
- `.env`, `node_modules/` y `uploads/` no se suben al repositorio.
