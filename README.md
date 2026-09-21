# Para Uma 💐

Mini juego web estilo retro (Pokémon/Omori) en el que Pablo le da flores
a Uma. Pensado para abrirse desde el teléfono: primero aparece un regalo
para abrir, luego la experiencia pasa a pantalla completa / horizontal y
empieza la música.

Flujo: regalo → menú (Jugar / Opciones) → overworld grande con cámara,
colisiones y obstáculos → Pablo nota a Uma y muestra la flor → Uma la
toca para recibirla → momento especial (flor + corazón) → pausa
narrativa → botón "Hablar" con una charla corta → pantalla final con dos
fondos descargables → post-créditos con la carta completa.

## El mundo

Uma se controla con un D-pad táctil y camina por un overworld grande
(la cámara la sigue con scroll suave). Los árboles, el tronco caído y la
laguna tienen colisión sólida (hitbox más chica que el sprite visual,
para que no se sienta injusto) mediante una lista genérica de
obstáculos reutilizable. El bosque es más denso lejos del camino
central y más abierto cerca de los claros. Efectos ambientales: luces
(más densas cerca de donde patrulla Pablo), hojas cayendo, viñeta sutil
en los bordes y un tinte cálido que se intensifica a medida que Uma se
acerca a Pablo.

## La entrega de flores

Pablo se mueve solo por un recorrido en loop. Al acercarse Uma, él se
detiene y la nota (gesto de sorpresa); después de una pausa breve
muestra la flor amarilla — Uma tiene que tocarla para recibirla (no se
entrega sola por cercanía). Ahí se dispara el momento especial (la flor
+ un corazón dibujado por código, grandes y centrados, con fundido de
entrada/salida) y el crossfade de música al mismo tiempo. Sigue una
pausa narrativa sin nombre de personaje, y recién ahí aparece el botón
"Hablar": un diálogo corto estilo RPG (máquina de escribir, tocar para
acelerar/avanzar) que cierra con el mensaje final.

## Pantalla final y post-créditos

Ofrece dos imágenes para descargar: un **fondo completo** horizontal
(1920x1080) con ambos personajes rodeados de flores, y un **recuerdo**
vertical (1080x1920, formato celular) con la flor, un corazón y un
textito con el nombre de Uma, la fecha del día y un mensaje corto. El
progreso queda guardado en `localStorage` para poder volver a ver el
final sin rejugar el mapa.

Desde ahí, "Ver más" lleva a una secuencia de post-créditos con la carta
completa en scroll estilo cine (auto-scroll pausado, con override manual
por rueda o arrastre táctil), sprites chicos intercalados cerca de los
párrafos más emotivos, y música propia que hace crossfade al entrar y
salir.

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

El proyecto incluye meta tags de Open Graph / Twitter Card (con
`assets/images/og-preview.png`, generada a partir de la misma
composición del fondo) para que el link se vea bien al compartirlo.

## Créditos de recursos

Los sprite sheets de caminata de Pablo (`Pablo.png`) y Uma
(`CharacterMainHet.png`) son copias del proyecto Godot **signs** (no se
modificó el proyecto original). La música `cancion_nes_instrumental.ogg`
también es una copia (reconvertida a ogg) de ese proyecto — sirve tanto
de música del mapa como de la secuencia de post-créditos — y
`flores_amarillas.ogg` es un tema aparte ya incluido en este repo. El
resto de los gráficos (regalo, mapa, laguna, tronco, corazón, marco de
diálogo) son nuevos, hechos por código (CSS/canvas) sin assets extra.
