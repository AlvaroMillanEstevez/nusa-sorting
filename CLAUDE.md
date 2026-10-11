# Nusa Sorting

Juego web de puzzle tipo "goods sort": ordenar comida en estanterías y juntar tríos iguales.

Stack: Vite + TypeScript (strict) + Phaser 4 + Vitest. Phaser 4 no es Phaser 3: ante cualquier API dudosa, consultar la documentación oficial de Phaser 4 o los tipos en `node_modules/phaser/types/phaser.d.ts`.

## Comandos

- `npm run dev` — servidor de desarrollo en el puerto 5180 (`strictPort`: si está ocupado, falla en vez de cambiar de puerto), accesible desde la red local (host: true)
- `npm run build` — typecheck + build de producción en `dist/`
- `npm run preview` — sirve `dist/` (también en la red local)
- `npm test` — tests con Vitest
- `npm run typecheck` — `tsc --noEmit`
- `npm run levelgen -- all` — regenera los niveles desde sus recetas (`tools/levelgen/recipes.ts`); `npm run levelgen -- N` regenera solo el nivel N y `npm run levelgen -- N --seed S` lo prueba con otra semilla. Escribe en `src/data/levels`; revisar el diff antes de hacer commit.
- `npm run economy` — simula la economía en los 24 niveles (monedas, nivel de jugador, cofres y potenciadores al alcance) con los valores de `src/data/economy.ts`.
- `npm run levelgen -- report` — informe de los niveles actuales sin regenerarlos: huecos libres al empezar, huecos libres medios, presión de espacio y resultados del jugador simulado.

## Probar en el móvil

WSL usa `networkingMode=mirrored`: el móvil accede directamente a `http://<IP de Windows>:5180` en la misma red. No hace falta `portproxy`.

## Parámetros de desarrollo

Solo en `npm run dev`; el build de producción no los incluye.

- `?level=N` — abre directamente el nivel N aunque esté bloqueado; el progreso se sigue guardando con normalidad.
- `?arrangement=K` — juega siempre la distribución K del nivel abierto (0 es la del fichero del nivel), sin avanzar la del guardado.
- `?resetSave` — borra el guardado (progreso y ajustes) antes de empezar.
- `?beltSpeed=X` y `?beltSlots=K` — cambian la velocidad y el número de huecos de la cinta del nivel abierto.
- `?timeScale=X` — multiplica el tiempo de cualquier nivel (por ejemplo `0.8`), para probar ritmos distintos jugando.
- `?gallery` — abre la galería de iconos (tamaños reales, variantes, estanterías de madera y simulación de daltonismo y escala de grises) en vez del juego.
- `?uikit` — abre el kit de interfaz (componentes en todos sus estados, iconos y formas de hueco). Página directa con `?uikit=components|icons|slots` y `&vision=deuteranopia|protanopia|grayscale`.
- `?show=pause|confirm|won|lost|blocked|autoplay|buy|continue|stuck` — abre ese panel al empezar el nivel, para revisarlo sin jugar (`won` usa una puntuación de 3 estrellas; `blocked` muestra el aviso de tablero lleno y su derrota; `autoplay` juega el nivel solo con el jugador experto simulado y sigue hasta el mapa, para ver efectos y coreografía; `buy` ofrece comprar el primer potenciador del nivel `continue` ofrece continuar tras perder y `stuck` tras quedarse sin movimientos posibles, todos dando antes en silencio las presentaciones de potenciadores).
- `?coins=N` — pone las monedas del jugador a N (para probar la tienda y las ofertas).
- `?boosters=N` — pone a N las unidades de cada potenciador al abrir un nivel (tras dar en silencio sus presentaciones), para probar la barra y el modal de continuar con y sin unidades.
- `?shop` — abre la tienda sobre el mapa (con `?home`).
- `?chest` — toca el cofre de estrellas al abrir el mapa (con `?home`): lo abre si hay estrellas para uno, o muestra el aviso si faltan.
- `?headless` — bucle del juego por temporizador y sin suavizado del paso de tiempo, para que un navegador headless con tiempo virtual haga avanzar las animaciones en capturas.
- `?home` — abre la pantalla de inicio (el mapa) aunque sea la primera visita.
- `?progress=N` — marca como completados los N primeros niveles (con 3, 2 y 1 estrellas alternas) antes de empezar, para ver el mapa más adelante; sus estrellas nuevas suman al contador del cofre, como al ganarlas.
- `?arrival=N` — abre el mapa como si se acabara de ganar el nivel N con 3 estrellas, para ver la secuencia de llegada (combínalo con `?progress=N`).
- `?slotAspect=X` — otra proporción de hueco (de 1 a 1,6) en cualquier nivel; el juego usa 1,2.
- `?safeArea=arriba,dcha,abajo,izda` — simula las zonas seguras de un móvil con muesca, en px (por ejemplo `47,0,34,0` en vertical).
- `?lang=en|id` — muestra el juego en ese idioma, sea cual sea el del navegador.

## Estructura

- `src/core` — lógica del juego, TypeScript puro
- `src/scenes` — escenas de Phaser
- `src/ui` — utilidades de presentación (layout); `src/ui/design` — tokens del sistema de diseño e iconos de interfaz
- `src/scenes/kit` — kit de componentes de interfaz en Phaser (botones, píldoras, paneles, interruptor, barra de progreso, estrellas)
- `src/assets/fonts` — fuentes de interfaz incluidas en el build (OFL), generadas con `tools/fonts/build_fonts.py`
- `docs/ui-style.md` — guía de estilo de interfaz
- `src/services` — fronteras con el exterior (guardado, anuncios, sonido)
- `src/data/levels` — los niveles del juego, generados con `tools/levelgen` y revisados
- `src/i18n` — textos y catálogos (`en`, `id`)
- `tests` — tests de Vitest; `tests/fixtures/demo-levels` guarda los niveles de demostración que usan las grabaciones de regresión y los tests de mecánicas
- `tools` — herramientas internas fuera del build: el generador de niveles y el jugador simulado

## Reglas del proyecto

- La lógica del juego vive en `src/core`, en TypeScript puro, sin dependencias de Phaser, y se cubre con tests.
- Las escenas solo dibujan el estado y envían acciones al núcleo.
- Sin backend, sin cuentas propias, sin APIs de IA en partida, sin dependencias nuevas sin justificarlas.
- Guardado detrás de la interfaz `SaveService`; anuncios detrás de `AdService` (implementación vacía: `NoopAdService`); sonido detrás de `SoundService` (implementación `WebAudioSoundService`, con `NoopSoundService` para tests).
- Textos visibles siempre a través de i18n (`en`, `id`).
- Toda pantalla de interfaz usa los tokens de `src/ui/design/tokens.ts` y los componentes de `src/scenes/kit`, según `docs/ui-style.md`: nada de colores, tamaños, tiempos ni iconos sueltos.
- Cambios pequeños, un commit por paso coherente con mensaje claro.
- Al terminar cada tarea, informar de: qué cambió, qué tests se ejecutaron, qué NO se ha probado, y una lista de pruebas manuales para Koke.
- Nunca afirmar que algo funciona en móvil sin que Koke lo haya probado.

## Principios de economía

- Una sola moneda (monedas). Nada de economías complejas.
- Todo nivel se puede superar sin potenciadores: ayudan, nunca son obligatorios.
- Todos los valores ajustables (precios, recompensas, curvas) viven en `src/data/economy.ts`; la lógica, en `src/core/economy.ts`.
- Sin anuncios todavía: ningún botón de anuncio (CrazyGames rechaza botones de anuncio sin efecto en Basic Launch). `AdService` queda preparado para añadir después anuncios con recompensa como alternativa a las monedas.
- Nada se compra con dinero real. Los cofres solo se ganan jugando; nunca se venden.

## Principio de dificultad

- Todo nivel debe poder superarse sin consumibles ni anuncios.
- Las bandas de dificultad de las recetas se calculan con el jugador simulado sin ayudas.
- Un nivel exigente puede costar 2 o 3 intentos, pero nunca se diseña para obligar a usar ayudas.
