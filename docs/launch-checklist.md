# Nusa Sorting · Lista de comprobación para Basic Launch (CrazyGames)

Envío sin SDK y sin anuncios. Requisitos leídos en docs.crazygames.com el 12 de octubre de 2026 ([técnicos](https://docs.crazygames.com/requirements/technical/), [jugabilidad](https://docs.crazygames.com/requirements/gameplay/), [portadas y vídeos](https://docs.crazygames.com/requirements/game-covers/), [guía de Basic Launch](https://docs.crazygames.com/resources/basic-launch-metrics/)). Volver a leerlos antes de enviar, por si cambian.

## Paquete

- [x] `npm run package` genera el build y `release/nusa-sorting-AAAAMMDD-<commit>.zip`, con `index.html` en la raíz del zip.
  - Comprueba: sin código de desarrollo, rutas relativas, número de archivos y tamaño.
- [x] Rutas relativas: `base: './'` en `vite.config.ts`; `index.html` carga `./assets/…`.
  - Probado servido desde un subdirectorio (`/sub/nusa/`) dentro de un iframe de otro origen.
- [x] Tamaño: 5 archivos, 1,9 MB (0,5 MB comprimido).
  - Límites: 1.500 archivos; 50 MB sin SDK; 20 MB para la portada móvil.
- [x] Sin peticiones de red propias:
  - fuentes incluidas en el build (WOFF2);
  - nada de CDNs, analítica ni servicios externos.

## Técnicos

- [x] **Tiempo hasta poder jugar.** Medido en un Chrome sin ventana con gráficos por software (más lento que un móvil con GPU):
  - antes, el tablero aparecía a los 5,8 s; ahora a los **2,1 s**;
  - con una red 4G simulada (9 Mb/s, 150 ms de latencia), a los **4,1 s**;
  - CrazyGames recomienda menos de 10 s; para lo cargado de fuera exige 20 s.
  - La marca `performance.mark('nusa:playable')` señala el momento.
- [x] `user-select: none` (con prefijos `-webkit-`, `-moz-`, `-ms-`) y `-webkit-touch-callout: none` en `body`.
- [x] **Audio en iOS.**
  - El `AudioContext` se crea y reanuda dentro de un gesto: `pointerdown` de las escenas, y también `touchend`, `click` y `keydown` en el documento.
  - Se reanuda también si iOS lo deja `interrupted` (una llamada, cambiar de aplicación).
- [x] **Funciona en un iframe sin acceso a la página padre:**
  - no se usan `window.parent` ni `window.top`;
  - el guardado sigue en memoria si el navegador bloquea `localStorage`.
- [x] **Zonas seguras:** `viewport-fit=cover` y `env(safe-area-inset-*)`; HUD, paneles y tablero se colocan dentro de la zona segura.
- [x] **Navegadores:**
  - Chrome, probado sin ventana;
  - Safari y Edge, por probar a mano (ver abajo).

## Jugabilidad

- [x] **Legible a DPR 1 en todas las ventanas que cita CrazyGames.** Tamaño mínimo de objeto, en el peor nivel de los 50:

  | Ventana | Mínimo |
  |---|---|
  | 800×450 (móvil) | 43 px |
  | 821×462 | 44 px |
  | 907×510 | 50 px |
  | 1077×606 y 1080×607 | 60 px |
  | 1216×684 | 69 px |
  | 1280×720 | 72 px |
  | 1366×768 | 78 px |
  | 1536×864 | 88 px |
  | 1920×1080 | 105 px |

  - Los paneles caben y se leen a 800×450: mapa, tienda, pausa, victoria, derrota, continuar, cofre y "Cómo conseguir monedas".
- [x] **Igual a 60, 144 y 165 Hz.**
  - El reloj, las cintas y la ventana del combo avanzan por el tiempo transcurrido (`tick(state, delta)`); las animaciones son tweens por tiempo.
  - Lo comprueba `tests/frameRate.test.ts`.
- [x] **Idioma:** inglés por defecto e indonesio solo si el idioma principal del navegador es indonesio (`navigator.languages[0]`).
  - Un móvil en español con el indonesio en segundo lugar sale en inglés.
  - Sin SDK no hay `locale` de CrazyGames.
- [x] Sin botón propio de pantalla completa, sin enlaces externos y sin promoción cruzada.
- [x] Sin anuncios ni botones de anuncio. Nada se compra con dinero real.
- [x] **Teclas:** Esc o P pausan.
  - Esc también sale de la pantalla completa del navegador: CrazyGames lo menciona como tecla con comportamiento propio, pero no la prohíbe.
- [x] **PEGI 12:** sin violencia, sin chat, sin contenido de usuarios.
- [x] **Primera visita directa al nivel 1**, con el tutorial: no hay pantalla de título.
- [x] **Ningún parámetro de desarrollo en producción:**
  - los parámetros `?…`, la galería, el kit de interfaz, las portadas, el modo vídeo, las demos y el simulador van detrás de `import.meta.env.DEV`;
  - `npm run package` falla si aparecen en el build;
  - solo quedan los textos de la galería y del kit en los catálogos i18n (unos 2 KB, sin código que los use).
- [x] **Consola sin errores** en el build de producción, dentro del iframe, en las cinco ventanas probadas. Se quitó el banner de Phaser.

## Datos y privacidad

- [x] El juego solo guarda en el navegador (`localStorage`, clave `nusa-sorting.save`).
  - Guarda progreso, estrellas, monedas, potenciadores y ajustes.
- [x] No recoge datos personales:
  - sin cuentas;
  - sin identificadores;
  - sin analítica;
  - sin peticiones de red.
- [x] No hace falta aviso de privacidad ni de términos mientras siga así.

## Material del envío

- [x] **Portadas** en `docs/launch/covers/`:
  - `cover-landscape.png` (1920×1080), `cover-portrait.png` (800×1200) y `cover-square.png` (800×800);
  - solo el título como texto, sin bordes, logotipos ni iconos de tiendas;
  - se regeneran con `tools/covers/render.sh` y `npm run dev` en marcha.
- [x] **Vídeos** en `docs/launch/videos/`:
  - `preview-landscape.mp4` (1920×1080) y `preview-portrait.mp4` (1080×1620, 2:3);
  - 19 s cada uno, H.264 sin audio, unos 2,7 MB cada uno;
  - empiezan con la portada; sin barras negras, sin cursor, sin transiciones en negro y sin acelerar.
  - Se regeneran con `node tools/preview/record.mjs both`.
- [ ] **Textos** en `docs/launch/store-texts.md`: borradores en inglés, pendientes de revisar por Koke y su mujer.
  - Descripción corta y larga, controles, etiquetas y categoría.

## Antes de enviar (manual)

- [ ] Revisar y aprobar los textos del envío.
- [ ] Ver las portadas y los dos vídeos enteros.
- [ ] Jugar el `.zip` en un móvil Android y en un iPhone:
  - que el sonido vuelva tras bloquear el teléfono o cambiar de aplicación;
  - que el tiempo hasta poder jugar sea corto;
  - que se respete la muesca en pantalla completa.
- [ ] Probar en Safari (macOS o iOS) y en Edge.
- [ ] Subir el `.zip` al portal de desarrolladores y probarlo en su vista previa (iframe real de CrazyGames).
- [ ] En el portal: orientación (horizontal y vertical), categoría Puzzle, etiquetas, controles, idiomas (inglés e indonesio).
