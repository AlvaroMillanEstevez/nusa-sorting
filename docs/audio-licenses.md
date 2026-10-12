# Nusa Sorting · Audio y licencias

Todos los efectos del juego salen de packs de **Kenney** (www.kenney.nl) con licencia **Creative Commons CC0 1.0** (dominio público): uso comercial permitido, sin atribución obligatoria.
- Licencia comprobada el 12 de octubre de 2026 en la página de cada pack, que dice «Creative Commons CC0», y en el `License.txt` de cada zip.
- Texto de la licencia: https://creativecommons.org/publicdomain/zero/1.0/
- Aun así, se agradece a Kenney en los créditos, aunque no sea obligatorio.

`tools/audio/build_sfx.py` hace todo el proceso:
1. descarga los packs;
2. recorta silencios;
3. iguala el volumen por tipo de sonido;
4. codifica MP3 mono de 96 kbps en `src/assets/audio/`.

Volúmenes: RMS de la parte audible, en dBFS:
- interfaz, −27;
- juego, −23;
- acontecimientos, −20;
- grandes momentos, −18.

Los picos nunca pasan de −1 dBFS.

## Efectos

| Archivo | Uso | Autor | Pack (fuente) | Archivo original | Licencia |
|---|---|---|---|---|---|
| `tap.mp3` | Pulsar un botón | Kenney | [Interface Sounds](https://kenney.nl/assets/interface-sounds) | `click_002.ogg` | CC0 1.0 |
| `open.mp3` | Abrir un panel | Kenney | [Interface Sounds](https://kenney.nl/assets/interface-sounds) | `open_002.ogg` | CC0 1.0 |
| `close.mp3` | Cerrar un panel | Kenney | [Interface Sounds](https://kenney.nl/assets/interface-sounds) | `close_002.ogg` | CC0 1.0 |
| `pick.mp3` | Coger un objeto | Kenney | [Impact Sounds](https://kenney.nl/assets/impact-sounds) | `impactWood_light_002.ogg` (tono ×1.3) | CC0 1.0 |
| `drop.mp3` | Soltar un objeto en un hueco | Kenney | [Impact Sounds](https://kenney.nl/assets/impact-sounds) | `impactWood_light_001.ogg` | CC0 1.0 |
| `beltPick.mp3` | Coger de una cinta | Kenney | [Impact Sounds](https://kenney.nl/assets/impact-sounds) | `impactWood_light_003.ogg` (tono ×1.2) | CC0 1.0 |
| `advance.mp3` | Una capa de atrás avanza | Kenney | [Casino Audio](https://kenney.nl/assets/casino-audio) | `card-slide-2.ogg` | CC0 1.0 |
| `invalid.mp3` | Movimiento no válido | Kenney | [Interface Sounds](https://kenney.nl/assets/interface-sounds) | `error_004.ogg` | CC0 1.0 |
| `clear.mp3` | Trío | Kenney | [Interface Sounds](https://kenney.nl/assets/interface-sounds) | `confirmation_002.ogg` | CC0 1.0 |
| `combo.mp3` | Combo (más agudo en cada paso) | Kenney | [Interface Sounds](https://kenney.nl/assets/interface-sounds) | `glass_001.ogg` | CC0 1.0 |
| `star.mp3` | Estrellas de la victoria (una nota más aguda por estrella) | Kenney | [Interface Sounds](https://kenney.nl/assets/interface-sounds) | `glass_002.ogg` | CC0 1.0 |
| `starCollect.mp3` | Estrella que llega al total del mapa | Kenney | [Interface Sounds](https://kenney.nl/assets/interface-sounds) | `glass_004.ogg` | CC0 1.0 |
| `mapStep.mp3` | Paso del marcador en el mapa | Kenney | [Impact Sounds](https://kenney.nl/assets/impact-sounds) | `footstep_wood_001.ogg` | CC0 1.0 |
| `tick.mp3` | Últimos segundos del reloj | Kenney | [Interface Sounds](https://kenney.nl/assets/interface-sounds) | `tick_002.ogg` | CC0 1.0 |
| `timeLow.mp3` | Aviso de poco tiempo | Kenney | [Interface Sounds](https://kenney.nl/assets/interface-sounds) | `bong_001.ogg` | CC0 1.0 |
| `unlock.mp3` | Desbloqueo (estantería, potenciador, compra) | Kenney | [RPG Audio](https://kenney.nl/assets/rpg-audio) | `metalLatch.ogg` | CC0 1.0 |
| `shelfClosed.mp3` | Estantería que se cierra | Kenney | [Impact Sounds](https://kenney.nl/assets/impact-sounds) | `impactPlank_medium_000.ogg` | CC0 1.0 |
| `blockerMove.mp3` | El hueco errante salta | Kenney | [Impact Sounds](https://kenney.nl/assets/impact-sounds) | `impactWood_medium_002.ogg` | CC0 1.0 |
| `blockerGone.mp3` | El hueco errante desaparece | Kenney | [Impact Sounds](https://kenney.nl/assets/impact-sounds) | `impactPlank_medium_003.ogg` (tono ×1.1) | CC0 1.0 |
| `blocked.mp3` | Tablero lleno o sin movimientos | Kenney | [Impact Sounds](https://kenney.nl/assets/impact-sounds) | `impactWood_heavy_000.ogg` (tono ×0.9) | CC0 1.0 |
| `win.mp3` | Victoria | Kenney | [Music Jingles](https://kenney.nl/assets/music-jingles) | `jingles_STEEL02.ogg` | CC0 1.0 |
| `lose.mp3` | Derrota | Kenney | [Music Jingles](https://kenney.nl/assets/music-jingles) | `jingles_STEEL14.ogg` | CC0 1.0 |
| `chest.mp3` | Abrir un cofre | Kenney | [RPG Audio](https://kenney.nl/assets/rpg-audio) | `handleCoins.ogg` | CC0 1.0 |

## Música (pendiente de que Koke elija)

El juego ya tiene preparado todo lo de la música:
- **Reproducción:** en bucle, con su propio volumen (35 % por debajo de los efectos) y entrada suave de 3 s.
- **Pausa:** se para con la página oculta.
- **Ajuste propio:** «Música» / «Musik», en ajustes y en el menú de pausa. Se guarda, y solo aparece cuando hay pista.

Para integrar la pista elegida, se deja un MP3 en `src/assets/audio/music/` (por ejemplo, `music.mp3`); no hay que tocar nada más.

No he integrado ninguna porque no puedo escucharlas para juzgar si cansan en sesiones largas. Además, Freesound solo permite bajar el archivo original con cuenta.

Las tres tienen licencia **CC0 1.0** en su propia página de Freesound (comprobada el 12 de octubre de 2026):

| Opción | Qué es | Duración | Enlace | Licencia |
|---|---|---|---|---|
| 1. *Java Jurami*, de SieuAmThanh | Pieza de estilo indonesio (GarageBand, World Music Jam Pack). Es la más completa como música de fondo; habría que hacerla bucle con un fundido cruzado. | 2:14 | https://freesound.org/people/SieuAmThanh/sounds/423647/ | CC0 1.0 |
| 2. *Gamelan — Generative Sound by Glorb*, de bassimat | Metalófonos balineses generados por síntesis, con batimientos entre pares; muy ambiental. | 2:00 | https://freesound.org/people/bassimat/sounds/855565/ | CC0 1.0 |
| 3. *Bali Gamelan Xylophone Loop 1* (y *Loop 2*), de qubodup | Bucles exactos de xilófono balinés, sacados de una grabación CC0 de thedialogueproject. Son cortos, así que repetirían mucho solos; sirven como base, alternando los dos. | 0:09 | https://freesound.org/people/qubodup/sounds/854333/ (y https://freesound.org/people/qubodup/sounds/854334/) | CC0 1.0 |
