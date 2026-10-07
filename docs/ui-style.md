# Nusa Sorting · Guía de estilo de interfaz

Esta guía es la referencia de toda pantalla de interfaz: HUD, paneles, lista de niveles, transiciones y las que vienen (monedas, tienda, potenciadores). Todo valor sale de los **tokens** de `src/ui/design/tokens.ts` y todo componente del **kit** de `src/scenes/kit/`. Una pantalla nueva no elige colores, tamaños ni tiempos por su cuenta.

- Ver el kit: `npm run dev` y abrir `?uikit` (páginas directas: `?uikit=components|hud|victory|icons|slots`, `&vision=deuteranopia|protanopia|grayscale`).
- Estado: **propuesta**. El juego todavía usa su interfaz antigua (`src/ui/theme.ts`, `Hud`, `ResultOverlay`, `LevelSelectScene`). Cuando Koke elija dirección, esas pantallas se pasan al kit una a una y la otra dirección se borra.

## 1. Auditoría de la interfaz actual (octubre 2026)

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

**Estados**: *normal*; *pulsado* (escala 0,95, se hunde en el labio, y al soltar un pequeño rebote a 1,04); *desactivado* (colores apagados hacia el color del pozo, etiqueta al 55 %, sin labio, sin sombra y sin entrada).
**Área de toque**: nunca menos de 44 × 44 px, aunque el dibujo sea menor. Un arrastre que recorre más de 10 px no cuenta como pulsación (las listas se pueden desplazar empezando sobre un botón).

**Iconos de interfaz** (`src/ui/design/uiIcons.ts`): SVG en una rejilla de 24 unidades, trazo redondeado de 2 y relleno tenue del mismo color. Nunca texto ni emoji. Hay: sonido, silencio, lista, reiniciar, ajustes, cerrar, atrás, siguiente, jugar, pausa, reloj, estrella (vacía y llena), trofeo, combo, candado, check, ojo (modo daltónico), pista, info, inicio y, para lo que viene, moneda, tienda y rayo (potenciador).

## 5. Accesibilidad

- **Contraste** (comprobado en `tests/designTokens.test.ts`): texto sobre paneles y píldoras al menos 4,5:1 **también con la superficie translúcida sobre lo más claro que pueda haber detrás** (madera clara, bambú). Etiquetas de botón 4,5:1 sobre su cara. Con deuteranopía, protanopía y escala de grises, las etiquetas mantienen al menos 3:1 y los textos de panel 4,5:1.
- **Nada solo por color**: los estados de tiempo cambian borde, grosor y movimiento además del color; el interruptor lleva ✓/✗; las barras escriben su valor; desactivado cambia forma (sin labio ni sombra) además de tono; las variantes de objetos llevan su insignia en modo daltónico.
- **Tamaños**: texto mínimo 12 px; lectura, 14; botones de 48 a 56 px de alto; toque mínimo de 44 px.
- `?uikit&vision=…` aplica la simulación a la interfaz; la galería (`?gallery`) la aplica a los objetos.

## 6. Huecos más altos (prueba)

- `?slotAspect=1.2` (solo en desarrollo, de 1 a 1,6) hace los huecos así de altos en cualquier nivel. Con 1 todo queda exactamente como hoy (`setSlotAspect` en `boardLayout.ts`).
- Los objetos se **apoyan en la base**: los iconos que «flotaban» en su caja (gorro peci, kendang, sate) bajan hasta la misma línea (`ITEM_BOUNDS`, medido rasterizando cada icono).
- Solo crecen los objetos altos por naturaleza (ancho/alto ≤ 0,85: vaso de té, cometa, globo, farolillo, fuegos artificiales…), **siempre con escala uniforme**, sin pasar del ancho del hueco ni de su altura.
- Tamaño de objeto en los niveles de 3 columnas (px), huecos cuadrados → 1,2:
  - **390 × 844**: sin cambios (manda el ancho): 36,5 en la mayoría; 45,3 en 9, 14, 19, 22–24; 59,8 en 15.
  - **844 × 390** (manda el alto): 70,0 → 61,4 (3–6, 11, 12, 16, 17, 21) · 51,8 → 45,5 (7) · 42,6 → 38,2 (13, 18, 20, 22, 23) · 49,7 → 45,5 (19) · 41,1 → **36,1** (15, en el límite de 36 px) · sin cambio en 9, 10, 14 y 24.

## 7. Estilo de los iconos de objetos

Se probó un estilo más ilustrado («v3»: colores menos saturados, sombreado de cinco tonos, texturas, sin contorno grueso) con sate, es teh manis y rambután. No aportó una diferencia visible a tamaño de juego y se descartó (octubre de 2026): se quedan los iconos actuales.

## 8. Referencias e ideas aplicables

Lo que hacen bien los juegos bien valorados del género y los casuales premium, traducido a ideas concretas para Nusa Sorting. Son ideas, no copias: ningún diseño, nombre ni recurso de otro juego.

1. **El tablero siempre vivo**: se puede jugar durante las animaciones (ya es así). Regla: ninguna transición de interfaz bloquea la entrada ni dura más de 420 ms.
2. **Coreografía de victoria**: atenuado → panel con rebote → estrellas una a una (cada 160 ms) → recuento de puntos con tic de sonido → botones al final. El botón principal «respira» suavemente si pasan 2 s sin tocarlo.
3. **Unir la acción con el HUD**: los «+puntos» de un trío vuelan hasta la píldora de puntuación y esta da un pequeño salto al recibirlos.
4. **Combo visible**: la píldora crece y vibra al subir, la llama se intensifica por nivel y la barra de ventana se vacía en tiempo real.
5. **Contención**: el exceso de efectos cansa. Un efecto por acontecimiento, y el más grande solo para el trío y la victoria.
6. **Pulgares abajo**: las acciones de los paneles en su parte baja; el HUD arriba, ligero.
7. **Transición con identidad**: sustituir el fundido entre niveles por un barrido con un motivo de batik (o la persiana de la tienda del warung) en menos de 420 ms.
8. **Vibración háptica** en el trío y la victoria (Android con `navigator.vibrate`; iOS Safari no la permite) detrás de un servicio como `SoundService` y con su ajuste.
9. **Zonas seguras**: `viewport-fit=cover` ya está activado; el HUD debe respetar `env(safe-area-inset-*)` en móviles con muesca.
10. **Progreso a la vista**: barra hacia el próximo tema en el panel de victoria y en la lista de niveles (el componente ya existe).
11. **Lista de niveles como recorrido**: un camino por islas de Nusantara agrupado por temas, en vez de una cuadrícula.
12. **Monedas y tienda con el mismo kit**: la moneda es una `KitPill` con el icono `coin`; la tienda, un `KitPanel` con botones `KitButton`; los potenciadores, `KitIconButton` con contador.

Fuentes consultadas: [5 Simple UX Lessons From Royal Match](https://thisweekinliveops.substack.com/p/5-simple-ux-lessons-from-royal-match), [Royal Match Dominates Match-3](https://www.funovus.com/blogs/royal-match-dominates-match-3-what-can-all-designers-learn/), [Juice Overload: When Sensory Feedback Hurts Gameplay](https://www.wayline.io/blog/juice-overload-sensory-feedback-hurts-gameplay), [Roblox: UI and UX design](https://create.roblox.com/docs/production/game-design/ui-ux-design), [Plus Jakarta Sans (Tokotype)](https://www.tokotype.com/custom-fonts/plusjakarta), [Fredoka (Google Fonts)](https://fonts.google.com/specimen/Fredoka/about).
