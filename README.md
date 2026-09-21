# Para Uma 💐

Mini juego web estilo retro (Pokémon/Omori) en el que Pablo le da flores
a Uma. Pensado para abrirse desde el teléfono: primero aparece un regalo
para abrir, luego la experiencia pasa a pantalla completa / horizontal y
empieza la música.

Flujo: regalo → menú (Jugar / Opciones) → overworld con cámara siguiendo
a Uma → entrega automática de flores al acercarse a Pablo → botón
"Hablar" con una charla corta de 4 líneas → pantalla final con un fondo
de pantalla pixel art descargable.

Uma se controla con un D-pad táctil y camina por un overworld grande
(la cámara la sigue con scroll suave); Pablo se mueve solo siguiendo un
recorrido en loop. Al acercarse se disparan las flores automáticamente
y aparece un botón para hablar con él: un diálogo corto estilo RPG
(máquina de escribir, tocar para acelerar/avanzar) que cierra con el
mensaje final. La música hace crossfade a un segundo tema en ese
momento. Al terminar, se genera un fondo de pantalla 1920x1080 con
ambos personajes para descargar, y el progreso queda guardado en
`localStorage` para poder volver a verlo sin rejugar el mapa.

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

Los sprite sheets de caminata de Pablo (`Pablo.png`) y Uma
(`CharacterMainHet.png`) son copias del proyecto Godot **signs** (no se
modificó el proyecto original). La música `cancion_nes_instrumental.ogg`
también es una copia (reconvertida a ogg) de ese proyecto, y
`flores_amarillas.ogg` es un tema aparte ya incluido en este repo. El
resto de los gráficos (regalo, mapa, decoración del bosque, cuadro de
diálogo) son nuevos, creados para este mini juego.
