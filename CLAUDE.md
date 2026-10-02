# Nusa Sorting

Juego web de puzzle tipo "goods sort": ordenar comida en estanterías y juntar tríos iguales.

Stack: Vite + TypeScript (strict) + Phaser 4 + Vitest. Phaser 4 no es Phaser 3: ante cualquier API dudosa, consultar la documentación oficial de Phaser 4 o los tipos en `node_modules/phaser/types/phaser.d.ts`.

## Comandos

- `npm run dev` — servidor de desarrollo en el puerto 5180 (`strictPort`: si está ocupado, falla en vez de cambiar de puerto), accesible desde la red local (host: true)
- `npm run build` — typecheck + build de producción en `dist/`
- `npm run preview` — sirve `dist/` (también en la red local)
- `npm test` — tests con Vitest
- `npm run typecheck` — `tsc --noEmit`

## Estructura

- `src/core` — lógica del juego, TypeScript puro
- `src/scenes` — escenas de Phaser
- `src/ui` — utilidades de presentación (layout, tema)
- `src/services` — fronteras con el exterior (guardado, anuncios)
- `src/data/levels` — definiciones de niveles
- `src/i18n` — textos y catálogos (`en`, `id`)
- `tests` — tests de Vitest

## Reglas del proyecto

- La lógica del juego vive en `src/core`, en TypeScript puro, sin dependencias de Phaser, y se cubre con tests.
- Las escenas solo dibujan el estado y envían acciones al núcleo.
- Sin backend, sin cuentas propias, sin APIs de IA en partida, sin dependencias nuevas sin justificarlas.
- Guardado detrás de la interfaz `SaveService`; anuncios detrás de `AdService` (implementación vacía: `NoopAdService`).
- Textos visibles siempre a través de i18n (`en`, `id`).
- Cambios pequeños, un commit por paso coherente con mensaje claro.
- Al terminar cada tarea, informar de: qué cambió, qué tests se ejecutaron, qué NO se ha probado, y una lista de pruebas manuales para Koke.
- Nunca afirmar que algo funciona en móvil sin que Koke lo haya probado.
