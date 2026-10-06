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

## Probar en el móvil

WSL usa `networkingMode=mirrored`: el móvil accede directamente a `http://<IP de Windows>:5180` en la misma red. No hace falta `portproxy`.

## Parámetros de desarrollo

Solo en `npm run dev`; el build de producción no los incluye.

- `?level=N` — abre el nivel N aunque esté bloqueado; el progreso se sigue guardando con normalidad.
- `?arrangement=K` — juega siempre la distribución K del nivel abierto (0 es la del fichero del nivel), sin avanzar la del guardado.
- `?resetSave` — borra el guardado (progreso y ajustes) antes de empezar.
- `?beltSpeed=X` y `?beltSlots=K` — cambian la velocidad y el número de huecos de la cinta del nivel abierto.
- `?timeScale=X` — multiplica el tiempo de cualquier nivel (por ejemplo `0.8`), para probar ritmos distintos jugando.
- `?gallery` — abre la galería de iconos (tamaños reales, variantes, estanterías de madera y simulación de daltonismo y escala de grises) en vez del juego.

## Estructura

- `src/core` — lógica del juego, TypeScript puro
- `src/scenes` — escenas de Phaser
- `src/ui` — utilidades de presentación (layout, tema)
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
- Cambios pequeños, un commit por paso coherente con mensaje claro.
- Al terminar cada tarea, informar de: qué cambió, qué tests se ejecutaron, qué NO se ha probado, y una lista de pruebas manuales para Koke.
- Nunca afirmar que algo funciona en móvil sin que Koke lo haya probado.

## Principio de dificultad

- Todo nivel debe poder superarse sin consumibles ni anuncios.
- Las bandas de dificultad de las recetas se calculan con el jugador simulado sin ayudas.
- Un nivel exigente puede costar 2 o 3 intentos, pero nunca se diseña para obligar a usar ayudas.
