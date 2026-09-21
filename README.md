# Para Uma 💐

Mini juego web en el que Pablo le da flores a Uma. Pensado para abrirse
desde el teléfono: primero aparece un regalo para abrir, luego la
experiencia pasa a pantalla completa / horizontal y empieza la música.

## Ejecutar localmente

No requiere build ni backend. Solo serví la carpeta como archivos estáticos:

```bash
python3 -m http.server 8080
```

y abrí `http://localhost:8080`.

## Publicar en GitHub Pages

1. Subí este proyecto a un repositorio de GitHub.
2. En **Settings → Pages**, elegí la rama `main` y la carpeta raíz (`/`).
3. Listo — todas las rutas son relativas, así que funciona directamente
   bajo la URL de Pages (`https://usuario.github.io/repo/`).

## Créditos de recursos

Los sprites de Pablo y Uma son copias recortadas de los assets del
proyecto Godot **signs** (no se modificó el proyecto original). La
música `agujetas.ogg` también es una copia del mismo proyecto. El resto
de los gráficos (regalo, fondo, flores) son nuevos, creados para este
mini juego.
