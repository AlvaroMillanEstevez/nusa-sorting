# Nusa Sorting · Guía de estilo de interfaz

Esta guía es la referencia de toda pantalla de interfaz: HUD, paneles, inicio y mapa, transiciones y las que vienen (monedas, tienda, potenciadores). Todo valor sale de los **tokens** de `src/ui/design/tokens.ts` y todo componente del **kit** de `src/scenes/kit/`. Una pantalla nueva no elige colores, tamaños ni tiempos por su cuenta.

- Ver el kit: `npm run dev` y abrir `?uikit` (páginas directas: `?uikit=components|icons|slots`, `&vision=deuteranopia|protanopia|grayscale`). Los paneles del juego se abren sin jugar con `?show=pause|confirm|won|lost|levels`; `?lang=id` y `?safeArea=47,0,34,0` sirven para revisar el indonesio y la muesca.
- Estado: **en uso** desde octubre de 2026 (dirección A). Todo el juego —HUD, menú de pausa, paneles de victoria y derrota, inicio y mapa, pantalla de tema, tutorial y textos flotantes— usa los tokens y el kit; el antiguo `src/ui/theme.ts` se borró.

## 1. Auditoría de la interfaz anterior (octubre 2026, antes del kit)

| Elemento | Qué lo hace parecer anticuado |
|---|---|
| Tipografía | La fuente del sistema en negrita para todo (Roboto, SF o Segoe según el móvil): sin personalidad ni jerarquía; las cifras del reloj cambian de ancho y bailan. |
| Botón «Restart» | Texto con un rectángulo de fondo plano (`backgroundColor` de Phaser): sin esquinas redondeadas, sin estado pulsado, y distinto de los otros dos botones del HUD, que son iconos. |
| HUD | Textos sueltos sobre una franja azul plana, sin contenedores: nivel, reloj, puntuación y «Tap to start» compiten sin jerarquía. Los iconos (lista, altavoz, estrella) están hechos con primitivas de `Graphics`, con grosores distintos entre sí. |
| Paleta | Fondo azul marino (`#1b2a3a`) contra estanterías de madera cálida: dos paletas que no hablan entre sí. |
| Panel de resultado | Rectángulo redondeado plano y botones de texto con fondo rectangular. Solo un fundido: ni entrada con escala, ni celebración, ni recuento de puntos. **El botón principal tiene contraste 2,6:1** (blanco sobre naranja), por debajo del mínimo AA incluso para texto grande. |
| Lista de niveles | Casillas planas; cabecera con botones de texto («Back», «Colour-blind: Off»). El número de un nivel bloqueado tiene contraste 3,2:1. No se ve el avance hacia el próximo tema. |
| Estados | Ningún control tiene estado pulsado ni desactivado visible; la única respuesta al toque es el sonido. |
| Transiciones | Fundido de cámara entre niveles; los paneles aparecen sin movimiento. |
| Intro de tema y tutorial | Paneles genéricos sin la identidad del juego. |

Lo que sí funciona y se conserva: el tablero nunca espera a las animaciones, el reloj espera al primer toque, el aviso de poco tiempo combina color, pulso y sonido, y el modo daltónico marca las variantes con un símbolo.

## 2. Dirección visual: A «warung cálido»

Koke eligió la dirección A en octubre de 2026 (la B, «moderno limpio», se descartó y se borró). Madera y tonos tierra: paneles de tabla con veta y marco, botones color cúrcuma (primario) y bambú (secundario) con relieve y un **borde inferior marcado** de 5 px en el que se hunden al pulsar, y píldoras del HUD en madera oscura. Continúa directamente las estanterías aprobadas. Sus colores, profundidad y esquinas están en `SKIN` (`tokens.ts`).

## 3. Tokens

### Espaciado: rejilla de 8 px
`space(n) = n × 8`, con medios pasos (4 px) para ajustes finos. Nombres: `hair` 4 · `xs` 8 · `s` 16 · `m` 24 · `l` 32 · `xl` 48. Márgenes de pantalla: 16. Entre grupos: 24.

### Tipografía
| Rol | Fuente | Peso | Tamaño | Uso |
|---|---|---|---|---|
| `hero` | Fredoka | 600 | 40 | Grandes momentos («¡Nivel superado!», la puntuación final) |
| `title` | Fredoka | 600 | 28 | Títulos de panel y pantalla |
| `number` | Fredoka | 600 | 22 | Cifras del HUD (tiempo, puntos) |
| `button` | Fredoka | 600 | 20 | Etiquetas de botón |
| `body` | Plus Jakarta Sans | 500 | 16 | Texto de lectura |
| `label` | Plus Jakarta Sans | 700 | 14 | Etiquetas en mayúsculas sobre cifras («SCORE») |
| `caption` | Plus Jakarta Sans | 700 | 12 | Notas, insignias |

- **Fredoka** (títulos y números): redonda, amable y muy legible en cifras grandes. Recortada a latín con **cifras de ancho fijo** (el reloj no se mueve).
- **Plus Jakarta Sans** (lectura): diseñada en Indonesia por Tokotype para la identidad de la ciudad de Yakarta. Buena lectura en tamaños pequeños.
- Licencia OFL 1.1 (sin nombre reservado). Licencias en `src/assets/fonts/OFL-*.txt`.
- Incluidas en el build como WOFF2 (`src/assets/fonts`), nunca cargadas de un servicio externo. Latín básico + Latin‑1 + comillas, rayas y puntos suspensivos: todo el indonesio y el inglés. **Peso: 14,8 + 9,3 + 9,2 = 33,3 KB** (test: máximo 40 KB).
- Se regeneran con `python3 tools/fonts/build_fonts.py <carpeta con los originales>` (requiere `pip install fonttools brotli`; ver el script).
- Mínimos: nada por debajo de 12 px; lectura y todo lo que se lee jugando, al menos 14 px.

### Radios
`s` 8 · `m` 12 · `l` 16 · `xl` 24 · `pill`. Cada dirección fija los suyos: botones (A: 32 % de la altura; B: píldora), paneles (A: 18; B: 28), píldoras del HUD (A: 12; B: píldora).

### Profundidad y sombras
- Elevación `low` (botones, píldoras) y `high` (paneles), como sombras suaves falsas: capas translúcidas apiladas, sin desenfoque real (barato en móvil).
- A suma el **labio**: la cara del botón se apoya en una franja más oscura de 5 px y se hunde al pulsarla. B no tiene labio: la sombra hace el relieve.
- Orden de capas: tablero < píldoras del HUD < ventanas emergentes < panel modal.

### Movimiento
| Token | ms | Uso |
|---|---|---|
| `press` | 90 | Respuesta al pulsar |
| `fast` | 140 | Interruptor, tic de un contador |
| `base` | 220 | Mayoría de transiciones (atenuado del fondo, píldoras) |
| `slow` | 360 | Entradas grandes (panel de victoria) |
| `screen` | 420 | Cambio de pantalla |

Curvas: `enter` (Cubic.easeOut) para lo que llega · `exit` (Cubic.easeIn) para lo que se va · `pop` (Back.easeOut) para botones soltados, paneles y recompensas · `loop` (Sine.easeInOut) para pulsos.
**El tablero nunca espera a la interfaz**: ninguna animación bloquea la entrada.

## 4. Kit de componentes (`src/scenes/kit`)

| Componente | Clase | Notas |
|---|---|---|
| Botón principal / secundario / positivo / peligro | `KitButton` | 56 px (principal) o 48 px de alto; icono opcional delante de la etiqueta. Un solo botón principal por pantalla. |
| Botón de icono | `KitIconButton` | 44 px; aspecto `chip` (HUD) o relleno. |
| Píldoras del HUD | `KitPill` | Icono + etiqueta opcional + cifra. Estados `normal`, `low` y `critical`. Barra de ventana del combo (`setProgress`). Sirve para monedas y vidas: mismo componente con otro icono. |
| Panel / modal | `KitPanel`, `KitModal` | El modal atenúa el tablero, se traga la entrada y entra con `popIn()`. |
| Interruptor | `KitToggle` | Encendido y apagado se distinguen por el lado del botón y por la marca ✓/✗. |
| Barra de progreso | `KitProgressBar` | Siempre con su valor escrito al lado. |
| Estrellas | `KitStars` | Tres estrellas: conseguidas rellenas, pendientes huecas con borde claro. `fill()` las rellena una a una con un rebote y una llamada por estrella (su sonido). |

**Estados**: *normal*; *pulsado* (escala 0,95, se hunde en el labio, y al soltar un pequeño rebote a 1,04); *desactivado* (colores apagados hacia el color del pozo, etiqueta al 55 %, sin labio, sin sombra y sin entrada).
**Área de toque**: nunca menos de 44 × 44 px, aunque el dibujo sea menor. Un arrastre que recorre más de 10 px no cuenta como pulsación (las listas se pueden desplazar empezando sobre un botón).

**Iconos de potenciador** (`src/ui/icons/boosterIcons.ts`, texturas en `scenes/boosterTextures.ts`): a color, dibujados por código (materiales con tres tonos, contorno fino en un tono oscuro del propio material, brillos): un cronómetro de latón cubierto de hielo con carámbanos (congelar tiempo), un mazo de madera con aros de latón golpeando entre destellos (eliminar un trío: se lee mejor que una varita a tamaño pequeño) y dos flechas gruesas que se cruzan, naranja y verde azulado (barajar). Son los mismos en la barra de la partida, la tienda, las ofertas de compra y de continuar, los regalos de subida de nivel y el modal del cofre; la galería (`?gallery`) los muestra a varios tamaños y en las fichas con todos sus estados. Los glifos monocromos de `uiIcons` quedan solo para el HUD (el copo del reloj congelado).

**Iconos de interfaz** (`src/ui/design/uiIcons.ts`): SVG en una rejilla de 24 unidades, trazo redondeado de 2 y relleno tenue del mismo color. Nunca texto ni emoji. Hay: sonido, silencio, lista, reiniciar, ajustes, cerrar, atrás, siguiente, jugar, pausa, reloj, estrella (vacía y llena), trofeo, combo, candado, check, ojo (modo daltónico), pista, info, inicio, adelante (pasar página), libro abierto (Buku Nenek) y, para lo que viene, moneda, tienda y rayo (potenciador).

## 5. Accesibilidad

- **Contraste** (comprobado en `tests/designTokens.test.ts`): texto sobre paneles y píldoras al menos 4,5:1 **también con la superficie translúcida sobre lo más claro que pueda haber detrás** (madera clara, bambú). Etiquetas de botón 4,5:1 sobre su cara. Con deuteranopía, protanopía y escala de grises, las etiquetas mantienen al menos 3:1 y los textos de panel 4,5:1.
- **Nada solo por color**: los estados de tiempo cambian borde, grosor y movimiento además del color; el interruptor lleva ✓/✗; las barras escriben su valor; desactivado cambia forma (sin labio ni sombra) además de tono; las variantes de objetos llevan su insignia en modo daltónico.
- **Tamaños**: texto mínimo 12 px; lectura, 14; botones de 48 a 56 px de alto; toque mínimo de 44 px.
- `?uikit&vision=…` aplica la simulación a la interfaz; la galería (`?gallery`) la aplica a los objetos.

## 6. Pantallas del juego

**HUD** (`src/scenes/Hud.ts`): solo lo esencial. El reloj en el centro de la fila superior, con el botón de pausa a la izquierda y, en los niveles especiales, su distintivo (estrella + «Especial») a la derecha. Puntuación y combo en la segunda fila en vertical, o en la misma fila en horizontal. El combo aparece desde ×2, con la barra de su ventana. El número de nivel no está siempre: ocupa el sitio de la puntuación al empezar («NIVEL 12 · Toca para empezar») hasta el primer toque, y está en el menú de pausa.

**Menú de pausa** (`PauseMenu.ts`): continuar, reiniciar, volver al inicio, sonido, modo daltónico y vibración (donde exista), con el número de nivel. Mientras está abierto, el reloj, las cintas y el combo se detienen. Reiniciar y salir piden confirmación si el nivel ya ha empezado. En horizontal, acciones a la izquierda y ajustes a la derecha. En ordenador, P lo abre y cierra (Escape no: en el navegador sale de la pantalla completa).

**Tutorial del primer trío** (`TutorialHint.ts`): en el nivel 1, un cartel con la indicación, contornos en el objeto y su destino y una mano que hace el gesto; junto al cartel (o debajo si no cabe), un botón secundario «Saltar» que lo da por hecho para siempre. Se completa también al hacer el primer trío. Si el nivel tiene comida fresca, tras el primer trío llega un segundo paso: el contorno resalta un objeto fresco (el de menos movimientos) y el cartel explica en una línea que la etiqueta cuenta sus movimientos y que hay que hacer su trío antes de que se estropee; se cierra al hacer un trío de comida fresca, y «Saltar» da por hechos los dos pasos.

**Victoria y derrota** (`ResultOverlay.ts`): la victoria rellena sus estrellas una a una, cada una con su campanada (cada vez más aguda), mientras la puntuación sube; debajo, el bonus por tiempo y el récord, y una fila con las monedas: una ficha por origen (✓ completar el nivel, ★ las estrellas, el kepeng del día de mercado), una flecha y el total. Tras las estrellas, las fichas entran una a una con un rebote y un tintineo, y el total cuenta hacia arriba con cada una; con un solo origen solo aparece el total, y con «Reducir movimiento» todo está ya en su sitio. Acciones: continuar al mapa (principal) y repetir (para mejorar estrellas). La derrota dice el motivo («¡Se acabó el tiempo!», «¡No queda espacio!» o «¡No quedan movimientos posibles!», cuando queda sitio pero ninguna secuencia de jugadas puede formar un trío ni hacer avanzar una capa) y ofrece reintentar o volver al inicio. Los botones entran al final, pero funcionan desde el principio.

**Pilas fijas y estanterías que se cierran** (mecánicas para los niveles 25 en adelante):
- Pilas fijas (`BeltView.ts`, cubículo de `art/shelfArt.ts`): cada pila es un cubículo de un hueco, cortado de la misma estantería ilustrada, que no se mueve, en una columna o fila del tablero (en columna, la viga de cada cubículo tapa la tabla del de encima). Solo se coge de ellas; detrás del objeto de delante se ve el siguiente en silueta, como en las cintas. El cubículo es tan alto como un hueco de estantería, así que los objetos altos caben. Cuántos quedan: una chapa oscura con borde de latón sobre la tabla inferior del cubículo, fuera del objeto, con un pequeño montón de tablillas y el número de objetos que quedan en la pila («▤ 5»), en cuanto queda más de uno. Así se lee como el tamaño de la pila y no como «5 de este objeto» (los puntos de las cintas se veían poco y confundían). Una pila vacía queda tapiada con dos tablillas: visiblemente vacía y sin uso.
- Estanterías que se cierran (`BoardDecor.ts`, `ClosingShelves`): desde el inicio llevan en la esquina superior una marca discreta, una chapa redonda de madera con dos tablillas cruzadas, para que se pueda planificar. Al vaciarse del todo (sin capas detrás) se clausuran: la estantería se oscurece y le clavan dos tablones torcidos, que caen con un rebote corto y un golpe sordo (sin rebote con «Reducir movimiento»). Ya no aceptan objetos.

**Comida fresca («basi», desde el nivel 1; demos 18-20 como fixtures)**: algunos tipos de comida tienen una cuenta atrás en movimientos. Cada objeto fresco lleva arriba a la izquierda una etiqueta de precio de cartulina colgada de un hilo, con los movimientos que le quedan escritos a mano (crema con número oscuro), siempre entera dentro de la imagen del objeto; en sus últimos 3 movimientos se vuelve de kraft oscuro con número claro y borde de latón, late (quieta con «Reducir movimiento») y suenan dos toques suaves que suben: el aviso no depende del color. Al llegar a cero, sus objetos se estropean a la vez: pierden casi todo el color hacia un verde oliva apagado, con dos moscas pequeñas encima, y suena un lamento breve. Un trío estropeado se puede hacer igual (no da puntos y rompe el combo); uno fresco da medio trío de bonus. Todo se genera en el juego a partir de la ilustración (`scenes/FreshLooks.ts`). La primera vez sale una explicación de una línea, como la de los potenciadores (en el nivel 1 la da el segundo paso del tutorial). En los niveles 1-4 las tres copias de cada fresco empiezan delante; en los 5-12, al menos dos; desde el 13 pueden empezar detrás o en pilas. Los niveles 9, 32 y 39 no tienen comida fresca: ni un solo fresco dejaba igual quién gana.

**Día de mercado («pasaran»)** (`src/core/pasaran.ts`, reparto en `src/data/pasaran.ts`, valores en `ECONOMY.pasaran`): la semana de mercado javanesa de cinco días (Legi, Pahing, Pon, Wage, Kliwon) se calcula con la fecha local del dispositivo, contando desde el 17 de agosto de 1945, Jumat Legi (el día javanés cambia al anochecer; el juego, a medianoche). Cada día favorece una de las cinco categorías de comida: Legi (también llamado Manis, «dulce») los dulces; Pahing los platos; Pon los fritos; Wage las bebidas; Kliwon la fruta (con el chile). Los objetos culturales no tienen día. Cada trío de la comida del día suma 2 monedas a la victoria, hasta 10 por nivel: monedas, nunca puntos, así que las estrellas no cambian. El día queda fijo al empezar el nivel.
- En el mapa, bajo el título, un cartel discreto con el aspecto de las píldoras («Hoy es Kliwon: día de la fruta») y las ilustraciones de esa comida. La primera vez lleva una segunda línea que explica qué es el pasaran; tocar el cartel la muestra u oculta. «Cómo conseguir monedas» tiene su fila.
- En el nivel, la comida del día lleva abajo a la izquierda una moneda pequeña de latón con agujero cuadrado (un *kepeng*, la moneda antigua de Java; `scenes/MarketLooks.ts`, colores en `MARKET`): la esquina libre de la etiqueta de Basi (arriba a la izquierda) y de la insignia de daltonismo (abajo a la derecha). Al hacer su trío sube un «+2» pequeño con una moneda, que se desvanece sin volar a ningún contador (se paga con la victoria); deja de salir al llegar al máximo.

**Buku Nenek, el libro de la abuela** (`scenes/BukuNenek.ts`, lógica en `src/core/album.ts`, textos en `src/data/bukuNenek.ts`, recompensas en `ECONOMY.album`): un álbum con una entrada por objeto del catálogo (81), que se encuentra la primera vez que el jugador hace su trío (también con un potenciador, y aunque luego pierda el nivel). Páginas: las cinco categorías de comida de los días de mercado (platos, fritos, dulces, bebidas, fruta y chile) y un tema por página, en orden de nivel (14 páginas; el festival no trae objetos).
- En el mapa, sobre la tienda, un botón como el de la tienda y el del cofre con el libro ilustrado (tapas de batik kawung, cantoneras de latón, etiqueta crema y marcapáginas rojo; `ui/icons/bookIcon.ts`, como los iconos de potenciador), y a su pie una pestaña con lo encontrado («23/81») y su barra. Con una página completa por recoger se ilumina como el cofre (brillo cálido que respira y destellos dorados; quieto con «Reducir movimiento») y la pestaña pasa a ámbar. Al tocarlo se abre el libro.
- El libro es un `KitModal`: título, lo encontrado en total y la página con sus flechas («Platos · 7/9»). Las entradas, en una cuadrícula de 3 a 5 columnas según quepa: las encontradas con su ilustración y su nombre (en dos líneas si hace falta, nunca por debajo de 12 px), las demás con su silueta oscura (tocarla dice «Haz su trío para encontrarlo»). Tocar una encontrada abre su página: la ilustración grande, el nombre en el idioma del jugador y debajo en el otro, la región en ámbar y mayúsculas si la tiene, y el dato; «Atrás» vuelve a la cuadrícula. Al pie, lo que da completar la página («Completa la página: 30 monedas»), el botón principal «Recoger +30» cuando está completa, o «Página completa ✓». Al recoger, las monedas vuelan desde el botón hasta el contador de monedas (que sube sobre el fondo atenuado y cuenta, como tras ganar) y un potenciador vuela hasta la tienda, que lo guarda; con «Reducir movimiento», el contador cambia sin vuelo. En pantallas anchas, título, flechas y recompensa van en una columna a la izquierda y las entradas a la derecha.
- Tras ganar, si se encontraron entradas nuevas (en ese nivel o en uno perdido antes), la secuencia del mapa muestra después de las subidas de nivel una tarjeta «Nueva página en el libro de la abuela» con sus ilustraciones (hasta cuatro y «+N») y, si hay una página por recoger, una línea que lo dice.
- Los textos son un primer borrador **pendiente de revisión** (`docs/buku-nenek.md`, generado con `node tools/docs/buku-nenek.mjs`).

**Temas** (`src/data/themes.ts`, aspecto en `src/ui/themeLook.ts`, fondo en `ThemeDecor.ts`, presentación en `ThemeIntro.ts`): cada nivel con tema cambia solo el fondo y el acento de la línea bajo el HUD; el tablero conserva su tamaño y las estanterías ilustradas, así que los objetos no pierden contraste. Un tema con sus fondos ilustrados (`art-source/pilot/<tema>-portrait.png` y `-landscape.png`, preparados por `tools/art/build_game_art.py` en `src/assets/art/themes`) los muestra como el de los niveles sin tema; los demás dibujan su motivo por código mientras tanto. Ilustrados: Budaya Jawa (octubre de 2026). Motivos dibujados:

| Nivel | Tema | Fondo y motivo | Acento |
|---|---|---|---|
| 5 | Budaya Jawa | marrón con batik kawung | oro |
| 10 | 17 Agustus | rojo oscuro con banderines rojiblancos | rojo |
| 15 | Pasar Malam | noche con guirnaldas de bombillas | amarillo |
| 20 | Laut Nusantara | mar turquesa a arena, con olas | turquesa |
| 25 | Olahraga | campo verde en franjas de césped y líneas de pista | amarillo |
| 30 | Permainan Tradisional | tierra de patio con casillas de engklek en tiza y canicas | naranja |
| 35 | Rempah Maluku | rojo clavo con clavos y granos de pimienta | canela |
| 40 | Sawah | terrazas de arroz en verdes con su línea de agua | verde lima |
| 45 | Fauna Nusantara | selva de noche con hojas grandes desde los lados | verde |
| 50 | Festival Nusantara | noche de fiesta: banderines y bombillas de todas las islas, confeti y olas | rosa |

La primera vez en un tema sale su presentación: el nombre en los dos idiomas, una banda en sus colores y sus objetos nuevos; el festival, que no trae objetos, muestra uno de cada isla anterior. `?theme=<id>` viste cualquier nivel con un tema para revisarlo.

**Inicio y mapa** (`HomeScene.ts`, `map/MapView.ts`, geometría en `src/ui/mapLayout.ts`): la primera visita entra directamente al nivel 1 (los portales como CrazyGames lo piden); las siguientes abren el inicio. Es el mapa de niveles a pantalla completa: islas ilustradas en un océano dibujado (turquesa oscuro con olas y un halo de agua clara alrededor de cada isla), cuerdas con boya del embarcadero de cada isla a la orilla de la siguiente, huellas de arena entre los niveles y nubes sobre el mar sin explorar. Cada tema es una isla propia (cuadrada) con su cartel y banderines en sus colores, en el claro bajo su nivel; los demás niveles comparten islas de cuatro (verticales), en zigzag por su franja de arena. Las islas (`art-source/pilot/island-*.png`, preparadas por `tools/art/build_game_art.py`) se descargan solo al acercarse a la pantalla, decodificadas de una en una; las de alrededor del nivel del jugador empiezan a bajar durante el arranque. Se dibujan con el embarcadero hacia la siguiente isla (reflejadas si está a la izquierda). Una isla sin imagen se dibuja como antes. En pantallas bajas el mapa se estrecha para que una isla de cuatro niveles quepa entera. Mientras carga el juego, la página muestra el warung al atardecer (`loading.webp`), que desaparece en cuanto la primera pantalla está lista. Cada isla se revela al acercarse el jugador. Tras la última (el nivel 50), un cartel de madera sobre las nubes anuncia «Más islas próximamente», sin fechas. Cada nivel es una placa de madera con su número y estrellas; el actual, más grande, con aro y el marcador del jugador; solo se ven 2 niveles bloqueados por delante. Arriba, de izquierda a derecha: el nivel de jugador (trofeo, «Lv N» y su barra de experiencia al pie), las monedas (tocarlas abre «Cómo conseguir monedas»: un modal breve con una fila por fuente —completar niveles, más la primera vez; estrellas; subir de nivel; cofres—, cada una con su icono, y un botón a la tienda; nunca menciona anuncios), el total de estrellas y ajustes (sonido, modo daltónico, reducir movimiento y vibración donde exista); debajo, el título. En un móvil estrecho las tres píldoras se estrechan a la vez. Abajo: el botón grande «Jugar · Nivel N» entre la tienda (bolsa) y el cofre de estrellas; sobre el cofre, las estrellas acumuladas sobre el objetivo («8/15» con barra; puede pasarlo: «17/15»). Con estrellas para uno, el cofre se ilumina como un regalo: un brillo cálido que respira detrás y tres destellos dorados que parpadean por turnos a su alrededor (quietos con «Reducir movimiento»; nada de rojo, que parecería un error); al tocarlo se abre: resta 15 estrellas y un modal «¡Enhorabuena!» muestra primero la celebración (el cofre tiembla y salta, confeti; quieto con «Reducir movimiento») y después, siempre, lo obtenido: una fila por recompensa con su icono a color y la cantidad exacta («+65 monedas», la ficha del potenciador con «+1 Barajar»), y solo entonces el botón «Recoger». Con 30 o más se puede abrir otra vez seguida. Por debajo del objetivo, tocarlo muestra un aviso breve: «Necesitas más estrellas». El mapa no muestra el inventario de potenciadores: las cantidades se ven en la tienda y en la barra de la partida. Tocar un nivel completado lo repite. Los niveles invitan a tocarlos: con ratón, el que está bajo el puntero crece un 10 % y brilla, y el cursor es una mano; al pulsar (también en el móvil) se hunde un poco; el actual tiene además una luz cálida que respira detrás. Con «Reducir movimiento», los cambios son inmediatos y la luz queda quieta.

**Tienda** (`Shop.ts`): un `KitModal` con las monedas arriba y una fila por potenciador (su ficha `KitBoosterButton` con la cantidad, el «+» o el candado; nombre; «Tienes N» o «Se desbloquea en el nivel N»; y el botón de precio con moneda, desactivado si no llega). Solo monedas; nada se compra con dinero real.

**Potenciadores en partida** (`BoosterBar.ts`): las tres fichas `KitBoosterButton` en una franja reservada de 72 px bajo el tablero (a la derecha en horizontal), desde el nivel que desbloquea el primero. Cada ficha es un panel de madera tallada en un marco de latón con relieve, sobre un labio oscuro en el que se hunde al pulsarla, con una luz cálida detrás del icono a color. Estados: disponible (insignia oscura con aro de latón y la cantidad), sin unidades (insignia verde con «+»: tocarla ofrece comprar) y bloqueado (ficha en gris, icono apagado, insignia con candado; tocarla dice en qué nivel se desbloquea). El que está en uso lleva un aro dorado; «eliminar un trío» muestra además un cartel bajo el HUD («Toca un objeto…»). Al desbloquearse, una ventana de una línea los presenta y regala unidades.

**Ofertas** (`Offer.ts`): comprar un potenciador sin unidades y presentar uno nuevo. Aceptar y rechazar son botones del mismo tamaño, uno sobre otro (aceptar arriba, principal; rechazar debajo, secundario), para que decir que no sea tan fácil como decir que sí. Sin monedas suficientes solo queda «OK».

**Continuar tras perder** (`ContinuePanel.ts`): no es una oferta con precio propio. El título dice la causa («¡Se acabó el tiempo!», «¡No queda espacio!», «¡No quedan movimientos!»), una línea explica qué hacer y debajo están las monedas del jugador. Luego, una fila por forma de seguir, con la misma ficha `KitBoosterButton` de la barra. Sin espacio o sin movimientos: eliminar un trío y barajar (barajar solo si deja algún progreso posible); su botón dice «Usar» si el jugador tiene unidades (gasta una), o muestra el precio normal de la tienda con la moneda si no tiene (lo compra y lo usa en el momento). Sin tiempo: solo «+15 segundos», con el reloj en la ficha (sin insignia) y su precio en monedas, cada vez más caro en el mismo intento (60, 90, 135); congelar tiempo no se ofrece, porque solo congela el reloj. Sin monedas suficientes, el botón se apaga y la fila dice «No hay monedas suficientes». Abajo, «Rendirse» a todo lo ancho, igual de visible. Máximo 3 continuaciones por intento; en horizontal, si no cabe, se quitan primero la línea y luego las monedas. No hay ningún botón de anuncio.

**Tras ganar** siempre se vuelve al mapa («Continuar»): las estrellas nuevas vuelan al total y el marcador recorre el camino hasta el siguiente nivel (unos 2 s; un toque lo salta) y el botón de jugar queda latiendo. Después de las estrellas, las monedas del nivel vuelan a su píldora y la barra de experiencia se llena; cada subida de nivel de jugador muestra una tarjeta breve con su regalo. Las estrellas nuevas suben también en el contador del cofre, que se ilumina si llega al objetivo; el cofre nunca se abre solo. La secuencia es una lista de pasos (`map/arrival.ts`). Tras perder: reintentar o inicio.

**Estrellas**: ganar da siempre 1; 2 y 3 dependen de la puntuación, que incluye un bonus de 20 puntos por segundo que sobra. Los umbrales salen de una fórmula sobre el propio nivel (`STAR_FORMULA` en `src/core/stars.ts`): con B = tríos × puntos por trío (sin combo) y F = el bonus de tiempo completo (tiempo límite × 20), **2 estrellas = 1,25·B + 0,2·F** y **3 estrellas = 1,7·B + 0,4·F**.

**Escritorio y pantallas anchas**: dos piezas.
- **Escala de interfaz** (`uiScale` en `scenes/view.ts`): en ventanas mayores de 960 × 540 todo el juego se compone como si la pantalla midiera eso (lo que limite antes, ancho o alto) y se dibuja más grande, hasta ×2,5. Por ejemplo: 1280 × 720 → ×1,33; 1920 × 1080 → ×2. Los móviles y las ventanas pequeñas siguen a ×1. Textos, iconos y capas horneadas se rasterizan a esa escala (`pixelRatio()`), así que no pierden nitidez.
- **Composición ancha** (`wideLayout` en `levelLayout.ts`), cuando la pantalla es al menos 1,45 veces más ancha que alta y mide 440 o más de alto (ventanas de ordenador y tabletas en horizontal; no los móviles en horizontal):
  - El HUD baja por un cartel de madera a la izquierda del tablero: pausa y reloj, puntuación (o el nivel antes del primer toque), combo (o «Toca para empezar»), distintivo especial.
  - Los potenciadores van en otro cartel a la derecha.
  - El tablero ocupa toda la altura bajo un toldo de rayas.
  - En los niveles sin tema el fondo ilustrado ya muestra el puesto (toldo, bombillas, mostradores), así que solo se dibujan los dos carteles. En los niveles con tema se dibuja el puesto (`StallDecor.ts`): postes de madera, toldo con borde festoneado, guirnaldas de bombillas, ketupat y farolillos, y un cesto de fruta sobre una caja a cada lado. Todo fuera del tablero, con los lados algo sombreados para que la vista vaya a él. Los colores están en `WOOD` (`ui/art/wood.ts`).
  - El tutorial del nivel 1 se coloca en la columna izquierda, bajo el cartel.
  - El menú de pausa pasa a acciones y ajustes lado a lado siempre que la versión alta no quepa.

**Fondos ilustrados** (`scenes/art/backdrops.ts`): los niveles sin tema muestran una calle de warungs al anochecer, en vertical en pantallas altas y en horizontal en las anchas, cubriendo la pantalla (lo que sobra se recorta). Se descargan cuando una pantalla de esa forma los necesita por primera vez, nunca antes de poder jugar: hasta entonces se ve el fondo dibujado y la imagen lo sustituye en cuanto llega. La imagen se hornea junto con lo que se dibuja encima (el suelo oscurecido, los carteles) en una sola capa, para que cada fotograma dibuje lo mismo que antes. En vertical, con potenciadores, el suelo se oscurece bajo su franja para que las fichas no pierdan contraste.

**Zonas seguras**: la página usa `viewport-fit=cover`; el lienzo ocupa toda la pantalla y la cámara coloca el origen del mundo en la esquina de la zona segura (`safeInsets` en `view.ts`). Layouts, HUD y paneles se calculan para la zona segura; fondos y atenuados cubren la pantalla entera.

**Efectos** (`Effects.ts`; ninguno bloquea la siguiente jugada: son animaciones sobre objetos que no reciben toques, con emisores de partículas creados una vez):
- Trío: chispas y un aro que se abre desde la estantería, más grandes con el combo; vibración breve.
- Puntos: «+N» sube del trío y vuela a la píldora de puntuación, que cuenta y da un saltito al recibirlo.
- Combo: «Combo ×N!» más grande y más cálido con cada paso; desde ×5, una sacudida suave de la pantalla y vibración desde ×4.
- Estantería desbloqueada: destello y chispas a lo largo de ella, además de la persiana que se levanta.
- Hueco errante eliminado: la caja estalla en astillas.
- Eliminar un trío (potenciador o continuar sin espacio): los tres objetos vuelan juntos, en primer plano, desde donde estén (incluidos los ocultos en capas traseras o en pilas de cintas) y se colocan uno al lado del otro junto al tocado; después estallan con el efecto de trío. Lo que queda detrás avanza cuando estallan.
- Tablero lleno o sin movimientos posibles: todas las estanterías se enmarcan en rojo, la pantalla se sacude, suena un golpe sordo y el motivo aparece grande sobre el tablero durante 1,1 s antes del panel.
- Victoria: confeti desde las esquinas, panel con rebote, estrellas una a una con su campanada, la puntuación contando y los botones al final.
- Transiciones: fundido por el color de fondo entre inicio, mapa y nivel (`transitions.ts`).
- Sonidos de interfaz: cada botón del kit suena al pulsarse y los paneles al abrirse y cerrarse (`kit/feedback.ts`).
- Vibración (`HapticsService`): trío, combo desde ×4 y derrota; solo donde existe la API (Android). Se desactiva en ajustes.

## 7. Huecos 1:1,2

Los huecos son 1,2 veces más altos que anchos (`SLOT_ASPECT` en `boardLayout.ts`; `?slotAspect` prueba otros valores).
- Los objetos se **apoyan en la base**: todos bajan a la misma línea (`ITEM_BOUNDS`, medido en cada imagen por `tools/art/build_game_art.py`).
- Solo crecen los altos por naturaleza (ancho/alto ≤ 0,85: vaso de té, cometa, globo, farolillo…), **siempre con escala uniforme**, sin pasar del ancho del hueco ni de su altura. Mantienen su tamaño al arrastrarlos.
- Los contornos de destino y del tutorial cubren el hueco entero.
- En las cintas, la misma regla: en las verticales los portadores están a la altura de un hueco unos de otros, y la franja de la cinta horizontal crece igual.

**Pantallas validadas** (`CHECKED_SCREENS` en `levelLayout.ts`; el generador rechaza niveles que no cumplan):
| Pantalla | Mínimo de objeto |
|---|---|
| Móvil en vertical, 390 × 844 | 36 px |
| Ventana de CrazyGames en ordenador, 1080 × 607 | 36 px |
| Móvil en horizontal, 844 × 390 (poco habitual) | 32 px |

**Estanterías por columna** que caben con esos mínimos (layouts de columnas, sin contar zonas seguras):
| Forma | 390 × 844 | 1080 × 607 | 844 × 390 |
|---|---|---|---|
| 3 columnas de estanterías | 10 | 8 | 5 |
| 2 columnas de estanterías | 10 | 8 | 5 |
| estanterías · cinta de 6 · estanterías | 10 | 8 | 5 |
| Cuadrícula automática (total) | 20 | 24+ | 24+ |

El límite real de los próximos niveles es el móvil en horizontal: **5 estanterías por columna**. Con 6 bajaría a 30 px.

## 8. Arte ilustrado de los objetos y del tablero

Desde octubre de 2026 los objetos son ilustraciones (generadas con ChatGPT a partir de hojas de 3 × 2 y revisadas por Koke objeto por objeto, también en gris y con daltonismo); los iconos SVG dibujados por código se retiraron y siguen en el historial de git. Los originales están en `art-source/pilot` y `python3 tools/art/build_game_art.py` los prepara en `src/assets/art`.
- **Objetos**: un WebP de 192 px por objeto (unos 11 KB). El juego los dibuja en texturas de 256 px (potencia de dos, con mipmaps) y solo descarga los del nivel que abre; los de los dos niveles siguientes se preparan en segundo plano, en el tiempo libre del navegador. A 390 × 844 con densidad 3 no hay diferencia visible frente a 256 px.
- **Halo**: los objetos de contorno oscuro (CIE L* < 45, 18 de 81: peci, batik, komodo, cengkeh…) llevan una luz cálida y suave justo detrás del contorno, generada en el juego a partir de la imagen (`ui/art/itemPixels.ts`), para que no se pierdan en la pared oscura de la estantería sin aclarar la pared (que quitaría contraste a los demás).
- **Capas traseras**: la silueta de cada objeto se genera de su imagen: su forma exacta en un tono oscuro plano con un borde fino más claro, sin colores, detalles ni sombra. Misma regla de visibilidad que antes (la capa de detrás se ve solo donde el hueco de delante está vacío).
- **Variantes de color** (para los niveles 51 en adelante): se generan de la imagen recoloreando la zona de su color principal (el tono dominante que mide la herramienta) y conservando su sombreado; alt1 va hacia el azul (o el naranja si el objeto ya es azulado), alt2 hacia el amarillo y más claro (o el rojo y más oscuro si ya es amarillo). Los objetos sin un color claro (blancos, crema, grises) se tiñen enteros, con suavidad. En modo daltónico llevan su insignia (punto para alt1, triángulo para alt2). `?gallery` las muestra todas, con las simulaciones.
- **Estantería y cubículo**: la estantería regenerada (`shelf-3-v2.png`) con su ancho tal cual y su altura ajustada a los huecos de 1,2; se escala de forma uniforme con el tamaño de hueco, en estanterías fijas y estanterías-cinta. El cubículo de las pilas fijas es un compartimento de la misma estantería entre dos postes.
- **Resto del tablero**, con piezas cortadas de la misma estantería: la viga (raíles de las cintas, postes de las estanterías-cinta, tablones clavados), un panel de tablas (persiana de la estantería bloqueada, bandejas bajo las pilas de las cintas), una caja (el hueco errante) y la pared oscura (lecho de las cintas). Los detalles pequeños (clavos, candado, testas de los troncos) se dibujan con la paleta `WOOD`.

## 9. Referencias e ideas aplicables

Lo que hacen bien los juegos bien valorados del género y los casuales premium, traducido a ideas concretas para Nusa Sorting. Son ideas, no copias: ningún diseño, nombre ni recurso de otro juego.

1. **El tablero siempre vivo**: se puede jugar durante las animaciones (ya es así). Regla: ninguna transición de interfaz bloquea la entrada ni dura más de 420 ms.
2. **Coreografía de victoria**: atenuado → panel con rebote → estrellas una a una (cada 160 ms) → recuento de puntos con tic de sonido → botones al final. El botón principal «respira» suavemente si pasan 2 s sin tocarlo.
3. **Unir la acción con el HUD**: los «+puntos» de un trío vuelan hasta la píldora de puntuación y esta da un pequeño salto al recibirlos.
4. **Combo visible**: la píldora crece y vibra al subir, la llama se intensifica por nivel y la barra de ventana se vacía en tiempo real.
5. **Contención**: el exceso de efectos cansa. Un efecto por acontecimiento, y el más grande solo para el trío y la victoria.
6. **Pulgares abajo**: las acciones de los paneles en su parte baja; el HUD arriba, ligero.
7. **Transición con identidad**: sustituir el fundido entre niveles por un barrido con un motivo de batik (o la persiana de la tienda del warung) en menos de 420 ms.
8. **Vibración háptica** en el trío y la victoria (Android con `navigator.vibrate`; iOS Safari no la permite) detrás de un servicio como `SoundService` y con su ajuste.
9. **Escritorio y pantallas anchas**: dos piezas.
- **Escala de interfaz** (`uiScale` en `scenes/view.ts`): en ventanas mayores de 960 × 540 todo el juego se compone como si la pantalla midiera eso (lo que limite antes, ancho o alto) y se dibuja más grande, hasta ×2,5. Por ejemplo: 1280 × 720 → ×1,33; 1920 × 1080 → ×2. Los móviles y las ventanas pequeñas siguen a ×1. Textos, iconos y capas horneadas se rasterizan a esa escala (`pixelRatio()`), así que no pierden nitidez.
- **Composición ancha** (`wideLayout` en `levelLayout.ts`), cuando la pantalla es al menos 1,45 veces más ancha que alta y mide 440 o más de alto (ventanas de ordenador y tabletas en horizontal; no los móviles en horizontal):
  - El HUD baja por un cartel de madera a la izquierda del tablero: pausa y reloj, puntuación (o el nivel antes del primer toque), combo (o «Toca para empezar»), distintivo especial.
  - Los potenciadores van en otro cartel a la derecha.
  - El tablero ocupa toda la altura bajo un toldo de rayas.
  - Alrededor se dibuja el puesto (`StallDecor.ts`): postes de madera, toldo con borde festoneado, guirnaldas de bombillas, ketupat y farolillos, y un cesto de fruta sobre una caja a cada lado. Todo fuera del tablero, con los lados algo sombreados para que la vista vaya a él. Los colores están en `WOOD` (`ui/art/wood.ts`).
  - El tutorial del nivel 1 se coloca en la columna izquierda, bajo el cartel.
  - El menú de pausa pasa a acciones y ajustes lado a lado siempre que la versión alta no quepa.

**Zonas seguras**: `viewport-fit=cover` ya está activado; el HUD debe respetar `env(safe-area-inset-*)` en móviles con muesca.
10. **Progreso a la vista**: barra hacia el próximo tema en el panel de victoria y en el mapa (el componente ya existe).
11. **Lista de niveles como recorrido**: un camino por islas de Nusantara agrupado por temas, en vez de una cuadrícula.
12. **Monedas y tienda con el mismo kit**: la moneda es una `KitPill` con el icono `coin`; la tienda, un `KitPanel` con botones `KitButton`; los potenciadores, `KitIconButton` con contador.

Fuentes consultadas: [5 Simple UX Lessons From Royal Match](https://thisweekinliveops.substack.com/p/5-simple-ux-lessons-from-royal-match), [Royal Match Dominates Match-3](https://www.funovus.com/blogs/royal-match-dominates-match-3-what-can-all-designers-learn/), [Juice Overload: When Sensory Feedback Hurts Gameplay](https://www.wayline.io/blog/juice-overload-sensory-feedback-hurts-gameplay), [Roblox: UI and UX design](https://create.roblox.com/docs/production/game-design/ui-ux-design), [Plus Jakarta Sans (Tokotype)](https://www.tokotype.com/custom-fonts/plusjakarta), [Fredoka (Google Fonts)](https://fonts.google.com/specimen/Fredoka/about).
