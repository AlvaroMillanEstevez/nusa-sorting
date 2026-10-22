# Nusa: Warung Sort · Audio y licencias

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

## Victoria con gamelan

Notas sueltas de metalófono cortadas de [*Gamelan — Generative Sound by Glorb*, de bassimat, Freesound 855565](https://freesound.org/people/bassimat/sounds/855565/), con licencia CC0 1.0. Lo hace `python3 tools/audio/build_sfx.py`.

En la grabación, cada nota empieza tras silencio digital, así que se cortan limpias. La victoria usa las cinco notas de su escala (151, 174, 198, 222 y 264 Hz), una octava más agudas.

El trío y el combo usaron también notas de este gamelan entre el 12 y el 13 de octubre de 2026 (`clear.mp3` y `combo1.mp3`–`combo5.mp3`). Se retiraron porque a Koke no le convencían.

| Archivo | Uso | Notas de la fuente |
|---|---|---|
| `win.mp3` | Victoria | Arpegio ascendente de las cinco notas más la primera una octava arriba, sobre un gong grave suave (a 95,67 s) |

## Trío y combo (sintetizados)

No usan archivos: el juego los sintetiza en el momento (`WebAudioSoundService`), como antes de los efectos grabados.
- **Trío:** un arpegio corto de onda triangular (660, 830 y 990 Hz) con un destello senoidal una octava por encima.
- **Combo:** un barrido ascendente con una nota senoidal encima. Cada paso sube por una escala pentatónica: 0, 2, 4, 7, 9, 12, 14 y 16 semitonos, sin saltos mayores de una tercera menor y hasta una octava y una tercera.

Al no haber grabación, no hay licencia que documentar.

Pasan por el mismo corte de agudos que los grabados (paso bajo a 7 kHz), pero no por la reverberación de sala.

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

**Procesado común** a todos los efectos grabados (Kenney y gamelan), para que suenen de la misma familia:
- el mismo corte de agudos (paso bajo de 2.º orden a 7 kHz);
- una reverberación de sala muy sutil: respuesta al impulso sintética de 0,35 s que se apaga en unos 70 ms, oscura (paso bajo a 3,5 kHz), con 8 ms de pre-retardo y mezclada unos 18 dB por debajo del sonido seco.

Además, los sonidos de interfaz (`tap`, `open` y `close`) se filtran por encima de 5 kHz y entran con un fundido de 3 ms, para que no chasqueen ni silben.
