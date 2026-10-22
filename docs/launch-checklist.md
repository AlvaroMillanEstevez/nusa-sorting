# Nusa: Warung Sort · Lista de comprobación para Basic Launch (CrazyGames)

Segundo envío, sin SDK y sin anuncios. El primero se rechazó por «overall quality», antes del arte ilustrado, el audio nuevo, la composición de escritorio, las islas, Basi, Pasaran y Buku Nenek. Requisitos releídos en docs.crazygames.com el 22 de octubre de 2026 ([técnicos](https://docs.crazygames.com/requirements/technical/), [jugabilidad](https://docs.crazygames.com/requirements/gameplay/), [calidad](https://docs.crazygames.com/requirements/quality/), [portadas y vídeos](https://docs.crazygames.com/requirements/game-covers/), [guía de Basic Launch](https://docs.crazygames.com/resources/basic-launch-metrics/)). Volver a leerlos antes de enviar, por si cambian.

## Nombre

- [x] El juego se llama **Nusa: Warung Sort** (antes «Nusa Sorting»; «Nusa» es la marca). Cambiado en el título de la página, la pantalla de carga, el mapa (en inglés e indonesio), las portadas, los vídeos y los textos.
- [x] Sin cambios internos: la clave de guardado (`nusa-sorting.save`), los ids de niveles y del catálogo y el nombre del paquete siguen igual; un guardado de la versión anterior se conserva entero (comprobado).
- [ ] En el portal: el nombre del juego, «Nusa: Warung Sort».

## Cambios en los requisitos desde el 12 de octubre

Las páginas no tienen fecha. Comparadas con lo que recogía esta lista:

- **Técnicos.**
  - Aparece un tope de **250 MB** de tamaño total; lo que cuenta sin SDK sigue siendo el tamaño total, ≤ 50 MB (≤ 20 MB para la portada móvil).
  - Juegos que no van fluidos en un Chromebook de 4 GB de RAM se desactivan en Chromium OS.
  - Sitelock: si se usa, admitir todos los dominios de CrazyGames y sus apps. No usamos sitelock.
- **Jugabilidad.**
  - El idioma se lee del `locale` del SDK, con el inglés como respaldo. Sin SDK no hay `locale`: el juego sale en inglés salvo que el idioma principal del navegador sea el indonesio, y entonces en indonesio, que es una traducción revisada.
  - Para la integración completa (no para Basic Launch), los jugadores nuevos deben entrar directamente a jugar o con un solo clic. Ya es así.
- **Calidad.**
  - Además de Escape, evitar **Ctrl/Cmd + W**. No lo usamos.
  - Insiste en el onboarding visual y que se pueda saltar.
- **Portadas y vídeos.** Sin cambios: tres portadas coherentes, solo el título como texto, sin bordes; vídeos de 15-20 s, sin sonido, 1080p en 16:9 y 2:3, empezando por la portada, ≤ 50 MB.
- **Basic Launch.**
  - Entre 7 y 21 días; termina con 7 días y 500 partidas.
  - Mide la duración media de la sesión (los buenos, 10+ min), la retención al día siguiente (10-15 %) y la conversión (jugar al menos un minuto; los mejores, 80 %+, con carga en menos de 10 s y menos de 20 MB).
  - Las actualizaciones durante Basic Launch se aprueban solas.

## Paquete

- [x] `npm run package` genera el build y `release/nusa-sorting-AAAAMMDD-<commit>.zip`, con `index.html` en la raíz del zip.
  - Falla si: aparece código de desarrollo, una ruta absoluta o falta algún prefijo de `user-select`; se pasan los 1.500 archivos o los 20 MB.
- [x] Rutas relativas: `base: './'` en `vite.config.ts`. Probado servido desde un subdirectorio (`/sub/nusa/`) dentro de un iframe de otro origen.
- [x] Tamaño: **155 archivos, 10,1 MB** (zip de 8,8 MB). Los fondos de los temas y las islas se descargan al necesitarlos.
- [x] Sin peticiones de red propias: fuentes incluidas, sin CDNs, sin analítica, sin servicios externos.

## Técnicos

- [x] **Tiempo hasta poder jugar** (marca `nusa:playable`).
  - Medido en un Chrome sin ventana con gráficos por software, como un móvil de 390×844 en 4G (9 Mb/s, 60 ms):
    - primera visita al nivel 1: **1,8 s**;
    - retomar el nivel 45: **1,8 s**;
    - abrir el mapa con 44 niveles hechos: **1,0 s**.
  - CrazyGames recomienda menos de 10 s.
- [x] `user-select: none` con `-webkit-`, `-moz-` y `-ms-` en `body` y `-webkit-touch-callout: none`.
  - El minificador de CSS quitaba `-moz-` y `-ms-`: ahora también van en el atributo `style` de `body`, y el paquete lo comprueba.
  - Menú contextual y gestos de la página desactivados.
- [x] **Audio en iOS.**
  - El `AudioContext` se crea y reanuda en un gesto (`touchend`, `click`, `keydown` y los toques de las escenas).
  - También desde el estado `interrupted`.
- [x] **Iframe.**
  - Funciona dentro de un iframe de otro origen sin acceso a la página padre (Phaser intenta escuchar `window.top` dentro de un `try`).
  - El guardado sigue en memoria si el navegador bloquea `localStorage`.
- [x] **Zonas seguras:** `viewport-fit=cover`; HUD, paneles y tablero dentro de la zona segura.
- [x] **Consola sin errores** en el build de producción dentro del iframe:
  - en 800×450, 821×462, 907×510, 1077×606, 1280×720, 1920×1080 y 390×844;
  - el registro capta también los errores de dentro del iframe (comprobado con una página que falla a propósito).
- [ ] Safari y Edge, por probar a mano. Chromebook de 4 GB, si hay alguno a mano.

## Jugabilidad

- [x] **Legible a DPR 1** en todas las ventanas que cita CrazyGames. Tamaño mínimo de objeto en el peor de los 50 niveles (el 15), con la escala de interfaz:

  | Ventana | Mínimo |
  |---|---|
  | 800×450 (móvil) | 44 px |
  | 821×462 | 45 px |
  | 907×510 | 50 px |
  | 1077×606 y 1080×607 | 60 px |
  | 1216×684 | 68 px |
  | 1280×720 | 71 px |
  | 1366×768 | 76 px |
  | 1536×864 | 85 px |
  | 1920×1080 | 107 px |
  | 390×844 y 844×390 (móvil) | 36 px |

  - En el mapa, las pantallas bajas y anchas (escritorio, 800×450, móvil en horizontal) llevan el cartel del pasaran en la fila de contadores y el libro junto a la tienda; ningún cartel de isla queda bajo el título.
  - Revisados a ojo a 800×450 y 821×462: mapa con el cartel del pasaran y el libro, Buku Nenek, nivel con su presentación de tema, panel de continuar, «Cómo conseguir monedas», presentaciones de potenciador y de comida fresca.
- [x] **Igual a 60, 144 y 165 Hz:** reloj, cintas, combo y cuentas por tiempo transcurrido o por movimientos; animaciones por tiempo (`tests/frameRate.test.ts`).
- [x] **Idioma:** inglés por defecto; indonesio si `navigator.languages[0]` es indonesio.
- [x] Sin botón propio de pantalla completa (ni `requestFullscreen` en el build), sin enlaces externos, sin promoción cruzada.
- [x] Sin anuncios ni botones de anuncio. Nada se compra con dinero real.
- [x] **Teclas:** P pausa. Ni Escape ni Ctrl/Cmd + W.
- [x] **PEGI 12:** sin violencia, sin chat, sin contenido de usuarios.
- [x] **Primera visita directa al nivel 1** con el tutorial (dos pasos: el primer trío y la comida fresca; «Saltar» los da por hechos).
- [x] **Nada de desarrollo en producción:** parámetros `?…` (también `?pasaran` y `?book`), galería, kit, portadas, modo vídeo, demos y simulador quedan fuera del build; `npm run package` lo comprueba.

## Datos y privacidad

- [x] Solo guarda en el navegador (`localStorage`, clave `nusa-sorting.save`): progreso, estrellas, monedas, potenciadores, Buku Nenek y ajustes.
- [x] No recoge datos personales: sin cuentas, identificadores, analítica ni peticiones de red. No hace falta aviso de privacidad mientras siga así.

## Material del envío

- [x] **Portadas** en `docs/launch/covers/`. **Koke eligió la B** (22 de octubre): se suben `cover-landscape-b.png`, `cover-portrait-b.png` y `cover-square-b.png`. Las dos composiciones:
  - **A**, el mostrador: una estantería con un trío de sate brillando ante el warung, comida a los lados y un rambután con su etiqueta de Basi;
  - **B**, el trío: tres rambutanes juntándose en un destello bajo el título, comida flotando alrededor y un ketupat con su etiqueta (en la vertical, grande y delante, para que la etiqueta se lea);
  - cada una en 1920×1080, 800×1200 y 800×800, con el arte ilustrado (el warung al atardecer y los objetos recortados a 512 px de los originales);
  - solo el título como texto, sin bordes, logotipos ni iconos; nada importante en la esquina superior izquierda;
  - se regeneran con `node tools/covers/render.mjs [a|b|both]` (con `npm run dev` en marcha y los objetos a 512 px: `python3 tools/art/build_game_art.py --hires art-source/hires-items`).
- [x] **Vídeos** en `docs/launch/videos/`:
  - `preview-landscape.mp4` (1920×1080) y `preview-portrait.mp4` (1080×1620, 2:3), 19 s, H.264 sin audio;
  - empiezan con la portada B; luego un tablero que se resuelve solo con el fondo ilustrado de Budaya Jawa (tríos con combo, un rambután fresco salvado a tiempo, un kerupuk que se estropea con sus moscas, la cinta y las estanterías que se cierran), la victoria con el desglose de monedas y la llegada al mapa de islas;
  - sin barras negras, sin cursor, sin transiciones en negro y sin acelerar;
  - se regeneran con `VARIANT=b node tools/preview/record.mjs both` (graba la partida y le pone delante el PNG de la portada).
- [x] **Textos** en `docs/launch/store-texts.md`: descripciones corta y larga (con Basi, Pasaran y Buku Nenek), controles, etiquetas y una nota para el equipo de CrazyGames.
  - [ ] Pendientes de revisar por Koke y su mujer.

## Antes de enviar (manual)

- [x] Elegir portada: la B. Vídeos grabados de nuevo con ella.
- [x] Textos y nota aprobados por la mujer de Koke.
- [ ] Ver los dos vídeos enteros.
- [ ] Jugar el `.zip` en un móvil Android y en un iPhone:
  - el sonido vuelve tras bloquear el teléfono;
  - el tiempo hasta poder jugar es corto;
  - se respeta la muesca en pantalla completa.
- [ ] Probar en Safari y en Edge.
- [ ] Subir el `.zip` al portal y probarlo en su vista previa (iframe real de CrazyGames).
- [ ] En el portal:
  - orientación: horizontal y vertical;
  - categoría: Puzzle;
  - etiquetas, controles e idiomas (inglés e indonesio);
  - portadas y vídeos;
  - la nota para el equipo, si hay campo; si no, por soporte.
