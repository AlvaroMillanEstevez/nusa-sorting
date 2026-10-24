# Nusa: Warung Sort · Lista de comprobación para Poki

Requisitos leídos en developers.poki.com el 24 de octubre de 2026:
- [Working with Poki](https://developers.poki.com/guide/working-with-poki)
- [Requirements](https://developers.poki.com/guide/requirements-quality)
- [SDK HTML5](https://developers.poki.com/guide/sdk-html5)
- [Game events](https://developers.poki.com/guide/game-events)
- [External resources](https://developers.poki.com/guide/external-resources-policy)
- [Player fit test](https://developers.poki.com/guide/player-fit-test)
- [Web fit test](https://developers.poki.com/guide/web-fit-test)
- [Inspector](https://developers.poki.com/guide/inspector)
- [Easy access](https://developers.poki.com/guide/easy-access)
- [Thumbnail](https://developers.poki.com/guide/game-thumbnail)

Volver a leerlos antes de subir.

## Cómo funciona Poki

- **Exclusividad web:** el juego no puede estar en otros portales web (Steam, tiendas de apps y consolas no cuentan). CrazyGames lo rechazó, así que no hay conflicto.
- **Ingresos:** reparto 50/50 de lo que llega desde Poki; el 100 % de lo que llega directo.
- **Proceso:**
  1. Subir el juego y comprobarlo con el Inspector.
  2. Playtests: hacen falta 10 grabaciones vistas y una miniatura.
  3. **Player Fit Test:**
     - 500 jugadores de Poki, unas 5 horas, hasta 2 por día;
     - para pasar: media de juego de más de 3 minutos y al menos un 25 % de partidas de más de 3 minutos.
  4. **Web Fit Test:**
     - unos 10.000 jugadores en las páginas de categoría, de 3 a 5 días;
     - mide CTR de la miniatura, tiempo en la página y conversión al primer `gameplayStart()`, cada uno puntuado de 0 a 5 frente a la media de su categoría.
  5. Revisión final, lanzamiento y actualizaciones.

## Build y paquete

- [x] Objetivo propio: `npm run build:poki` → `dist-poki/`, con `vite build --mode poki` (`.env.poki`: `VITE_PLATFORM=poki`). La versión propia (`npm run build` → `dist/`) no cambia: sin SDK ni anuncios, y el paquete lo comprueba.
- [x] `npm run package:poki` → `release/nusa-warung-sort-poki-AAAAMMDD-<commit>.zip`, con `index.html` en la raíz. Comprueba:
  - que no haya código de desarrollo;
  - que las rutas sean relativas;
  - que estén los prefijos de `user-select`;
  - que el SDK de Poki esté en la página y sea la **única** petición externa;
  - el número de archivos y el tamaño.
- [x] **Tamaño:** 155 archivos, 10,2 MB en total, cargados por partes.
- [x] **Antes de poder jugar** (marca `nusa:playable`), simulando un móvil en 4G (9 Mb/s, 60 ms):
  - unos **1,2 MB** descargados;
  - **1,9 s**.

  Poki no fija un límite: pide que sea pequeño y que cargue en menos de 10 s.

## Requisitos obligatorios

- [x] **Escritorio, móvil y tableta;** en móvil cubre toda la pantalla en vertical y en horizontal. Las tabletas usan el tacto.
- [x] **16:9 y cualquier tamaño:** el juego se compone para el tamaño que le den y cubre todo el lienzo (incluidos 640×360, 836×470 y 1031×580, de la misma familia que las ventanas ya comprobadas).
- [x] **Incógnito:** el guardado va dentro de `try`; sin `localStorage`, sigue en memoria.
- [x] **Peticiones externas:** solo el SDK de Poki desde su CDN. Fuentes y arte van dentro del build.
- [x] **Sin pantallas de presentación ni enlaces externos.** La pantalla de carga es el warung con el título.
- [x] **Solo los anuncios de Poki:** no hay otro sistema.
- [x] **Jugable con bloqueador de anuncios:**
  - si el SDK no llega, el juego sigue sin eventos ni anuncios;
  - el botón de anuncio no aparece;
  - no hay mensajes sobre el bloqueador.

  Comprobado bloqueando el script.

## SDK (`src/services/PokiServices.ts`, conectado en `src/main.ts`)

- [x] `PokiSDK.init()` al arrancar. El juego sigue tanto si responde como si falla (`then` y `catch`).
- [x] `gameLoadingFinished()` cuando la primera pantalla está lista. Si el SDK aún no estaba listo, se envía en cuanto lo está.
- [x] **`gameplayStart()` / `gameplayStop()`:**
  - el juego dice en cada fotograma si el jugador está jugando: empieza con el primer toque del tablero, no al cargar;
  - para durante la pausa, cualquier panel, la presentación del tema, el final del nivel y el mapa;
  - nunca se envía dos veces seguidas ni durante un anuncio.
- [x] **`commercialBreak()`, solo entre niveles:**
  - al pulsar un nivel o «Jugar» en el mapa;
  - al reintentar o reiniciar.

  Nunca en mitad de la partida, ni al salir de la pausa. Sin temporizadores propios: Poki decide si sale un anuncio.
- [x] **`rewardedBreak()` al continuar tras perder:**
  - «Ver anuncio» da gratis la primera forma de seguir (+15 s, o eliminar un trío);
  - solo hay recompensa si el anuncio se ve entero;
  - si no hay anuncio, sale un aviso breve y no hay recompensa;
  - la confirmación es el sonido y que el juego sigue en el acto;
  - una sola recompensa por pulsación (el botón se desactiva mientras tanto).
- [x] **Botón con recompensa** (normas de Poki):
  - «Rendirse» está siempre al lado, primero y del mismo tamaño;
  - el botón de anuncio no es verde (cúrcuma) y lleva el icono de claqueta;
  - el texto de arriba avisa de que es un anuncio («O mira un anuncio para seguir gratis»).
- [x] **Durante cualquier anuncio:**
  - sonido silenciado (sin tocar el ajuste del jugador);
  - bucle del juego dormido y entrada desactivada;
  - todo vuelve al terminar, también si el anuncio falla.
- [x] `measure('level', N, 'start' | 'complete' | 'fail')` para la analítica de Poki: un `complete` o un `fail` por intento (el `fail` solo al rendirse).
- [x] Las flechas, la barra espaciadora y la rueda no desplazan la página de Poki.
- [x] **Probado en local con el SDK en modo de pruebas** (`npm run dev:poki -- --port 5181`):
  - salen en la consola, por este orden: `init`, `gameLoadingFinished` y `gameplayStart` al primer movimiento;
  - `commercialBreak` al empezar nivel, que Poki no muestra antes del primer `gameplayStart`;
  - `rewardedBreak` con un anuncio de la casa, y la recompensa se concede al terminar (+15 s).
- [ ] **Poki Inspector** (inspector.poki.dev):
  - subir `dist-poki` (o el `.zip`) y repasar sus módulos;
  - mirar el registro de eventos y las pruebas de tamaños;
  - abrir el modo móvil con el QR.
  - Comprobar dónde queda en el móvil la píldora de Poki (arriba, por defecto `movePill(0, 24)`): que no tape el reloj del HUD ni el título del mapa. Si los tapa, se mueve con `PokiSDK.movePill`.

## Normas esperadas (las revisa el equipo de Poki)

- [x] Guardado del progreso.
- [x] Pocas pantallas antes de jugar: la primera visita entra directa al nivel 1.
- [x] Tutorial visual y que se puede saltar; sin escenas ni introducciones que no se puedan saltar.
- [x] **Controles según el dispositivo:** arrastrar o tocar, igual con ratón que con el dedo.
  - Poki pide pausar con Escape o espacio solo en juegos de teclado; este no lo es (P sigue pausando).
- [x] **Sin compras con dinero real:**
  - la tienda vende potenciadores por monedas que se ganan jugando;
  - Poki desaconseja segundas monedas que solo añaden rutina: aquí hay una sola.
- [x] Sin herramientas de desarrollo en el build (lo comprueba el paquete).
- [x] Idiomas: inglés por defecto e indonesio según el navegador (recomendado, no obligatorio).
- [ ] **Miniaturas:**
  - estática cuadrada de al menos 628×628, sin bordes, mejor sin texto: `docs/launch/poki/thumbnail-800.png` (la portada B sin el título);
  - animada para el lanzamiento global: valen los vídeos de `docs/launch/videos/`, pero falta comprobar el formato que pide Poki en su portal.
- [x] Política de privacidad: no hace falta mientras no haya enlaces ni servicios externos (más allá del SDK de Poki).

## Lo que tiene que hacer Koke

- [ ] Crear la cuenta en Poki for Developers y añadir el juego.
- [ ] Subir el `.zip` de `npm run package:poki` y repasarlo en el Inspector, también en el móvil.
- [ ] Subir la miniatura y pedir las grabaciones de playtest; ver al menos 10.
- [ ] Lanzar el Player Fit Test (categoría Puzzle; orientaciones vertical y horizontal).
