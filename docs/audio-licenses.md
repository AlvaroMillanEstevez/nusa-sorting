# Nusa Sorting · Audio y licencias

Todo el audio del juego tiene licencia **Creative Commons CC0 1.0** (dominio público): uso comercial permitido y sin atribución obligatoria. Texto de la licencia: https://creativecommons.org/publicdomain/zero/1.0/

Licencias comprobadas el 12 de octubre de 2026:
- en la página de cada pack de Kenney, que dice «Creative Commons CC0»;
- en el `License.txt` de cada zip de Kenney;
- en la página de Freesound de cada pista, con enlace a CC0 1.0.

Los originales WAV de Freesound están en `src/assets/audio/music/` y `src/assets/audio/source/`. No van a git (`.gitignore`) ni al build. Solo se publican los MP3 procesados.

## Música

| Archivo | Uso | Autor | Fuente | Licencia |
|---|---|---|---|---|
| `music/java-jurami.mp3` (y `.json` con la duración del bucle) | Música de fondo, solo en la pantalla de inicio y el mapa | SieuAmThanh | [*Java Jurami*, Freesound 423647](https://freesound.org/people/SieuAmThanh/sounds/423647/) | CC0 1.0 |

Proceso (`python3 tools/audio/build_music.py`):
1. **Bucle:** omite los 2 s iniciales, más suaves, y termina donde el ritmo encaja mejor con el arranque.
2. **Costura:** los últimos 4 s se funden con el principio a potencia constante, así que el empalme no se oye.
3. **Volumen:** −30 LUFS, unos 10 dB por debajo de los efectos.
4. **Formato:** MP3 estéreo de 96 kbps, 1,4 MB.

En el juego:
- **Fundidos:** entra con un fundido de 2 s en el inicio y el mapa, y se desvanece en 1,5 s al entrar en un nivel. Al volver sigue por donde iba.
- **Ajuste:** «Música» / «Musik», en ajustes y en el menú de pausa; se guarda.

## Efectos de gamelan

Notas sueltas de metalófono cortadas de [*Gamelan — Generative Sound by Glorb*, de bassimat, Freesound 855565](https://freesound.org/people/bassimat/sounds/855565/), con licencia CC0 1.0. Lo hace `python3 tools/audio/build_sfx.py`.

En la grabación, cada nota empieza tras silencio digital, así que se cortan limpias. Se usan las cinco notas de su escala (151, 174, 198, 222 y 264 Hz) una octava más agudas, para que suenen claras en el altavoz de un móvil.

| Archivo | Uso | Notas de la fuente |
|---|---|---|
| `clear.mp3` | Trío | La cuarta nota (222 Hz, a 18,84 s), 0,9 s |
| `combo1.mp3`–`combo5.mp3` | Cada paso de un combo sube una nota de la escala; tras la quinta, la escala de nuevo una octava más arriba | Las cinco notas (a 62,41, 22,24, 79,77, 18,84 y 47,66 s) |
| `win.mp3` | Victoria | Arpegio ascendente de las cinco notas más la primera una octava arriba, sobre un gong grave suave (a 95,67 s) |

## Efectos de Kenney

| Archivo | Uso | Autor | Pack (fuente) | Archivo original | Licencia |
|---|---|---|---|---|---|
| `tap.mp3` | Pulsar un botón | Kenney | [Interface Sounds](https://kenney.nl/assets/interface-sounds) | `drop_003.ogg` | CC0 1.0 |
| `open.mp3` | Abrir un menú, panel o modal | Kenney | [Interface Sounds](https://kenney.nl/assets/interface-sounds) | `maximize_006.ogg` | CC0 1.0 |
| `close.mp3` | Cerrar un menú, panel o modal | Kenney | [Interface Sounds](https://kenney.nl/assets/interface-sounds) | `minimize_008.ogg` | CC0 1.0 |
| `pick.mp3` | Coger un objeto | Kenney | [Impact Sounds](https://kenney.nl/assets/impact-sounds) | `impactWood_light_002.ogg` (tono ×1.3) | CC0 1.0 |
| `drop.mp3` | Soltar un objeto en un hueco | Kenney | [Impact Sounds](https://kenney.nl/assets/impact-sounds) | `impactWood_light_001.ogg` | CC0 1.0 |
| `beltPick.mp3` | Coger de una cinta | Kenney | [Impact Sounds](https://kenney.nl/assets/impact-sounds) | `impactWood_light_003.ogg` (tono ×1.2) | CC0 1.0 |
| `advance.mp3` | Una capa de atrás avanza | Kenney | [Casino Audio](https://kenney.nl/assets/casino-audio) | `card-slide-2.ogg` | CC0 1.0 |
| `invalid.mp3` | Movimiento no válido | Kenney | [Interface Sounds](https://kenney.nl/assets/interface-sounds) | `error_004.ogg` | CC0 1.0 |
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
| `lose.mp3` | Derrota | Kenney | [Music Jingles](https://kenney.nl/assets/music-jingles) | `jingles_STEEL14.ogg` | CC0 1.0 |
| `chest.mp3` | Abrir un cofre | Kenney | [RPG Audio](https://kenney.nl/assets/rpg-audio) | `handleCoins.ogg` | CC0 1.0 |

Volúmenes (RMS de la parte audible, en dBFS):
- interfaz, −27;
- juego, −23;
- acontecimientos, −20;
- grandes momentos, −18.

Los picos nunca pasan de −1 dBFS.

Los sonidos de interfaz (`tap`, `open` y `close`) se filtran por encima de 5 kHz y entran con un fundido de 3 ms, para que no chasqueen ni silben.
