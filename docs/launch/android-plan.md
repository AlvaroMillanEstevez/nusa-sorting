# Nusa: Warung Sort · Plan para Android (análisis, sin implementar)

Octubre de 2026. Propuesta para publicar el juego en Google Play reutilizando el build web. Las condiciones de Google Play cambian a menudo: comprobarlas en la [Play Console Help](https://support.google.com/googleplay/android-developer) antes de empezar.

## 1. Empaquetado: Capacitor

- **Qué es.** [Capacitor](https://capacitorjs.com) (de Ionic) envuelve una web en una app nativa con un WebView del sistema. Es lo más directo para un juego Vite + Phaser:
  - el build de `dist/` se copia tal cual a la app;
  - las rutas ya son relativas.
- **Pasos:**
  1. Instalar `@capacitor/core`, `@capacitor/cli` y `@capacitor/android` (dependencias nuevas, justificadas por la app).
  2. `npx cap init` y `npx cap add android`.
  3. Un tercer objetivo de build, `vite build --mode android` (como el de Poki), con su `AdService` y `PlatformService`.
  4. `npx cap sync` y compilar en Android Studio.
  5. Generar un AAB firmado (Play exige AAB y Play App Signing).
- **Ajustes de la app:**
  - **Orientación:** libre (el juego ya se adapta).
  - **Pantalla completa:** inmersiva, con zonas seguras; el juego ya usa `env(safe-area-inset-*)`.
  - **Botón atrás de Android:** con `@capacitor/app`, que abra la pausa en un nivel o cierre un panel abierto. Si no, saldría de la app.
  - **Pausa al irse a segundo plano:** silenciar al perder el foco y reanudar el audio al volver. Ya se reanuda con el primer toque.
  - **Icono y pantalla de inicio:** `@capacitor/assets` a partir de un icono de 1024×1024 (por ejemplo el libro de batik, o el sate de la portada).
  - **Guardado:** `localStorage` funciona en el WebView. Si algún día preocupa que el sistema lo borre, `@capacitor/preferences` cabría detrás de `SaveService`.
  - **Vibración:** `@capacitor/haptics` detrás de `HapticsService`, más fiable que `navigator.vibrate`.
- **Alternativas:**
  - **TWA / Bubblewrap:** abre una web alojada en Chrome; obliga a tener hosting y no permite AdMob nativo.
  - **Cordova:** más antiguo.

  Capacitor es la opción recomendada.

## 2. Anuncios: AdMob

- **Plugin:** `@capacitor-community/admob` (o similar), detrás de un `AdMobAdService` que implemente la misma interfaz `AdService`. La lógica del juego no cambia.
  - **Intersticiales:** en los mismos sitios que Poki, al empezar un nivel, con un límite de frecuencia configurado en AdMob (allí no hay un portal que lo decida).
  - **Con recompensa:** el mismo botón «Ver anuncio» del panel de continuar. Se puede añadir más adelante en otros sitios.
- **Requisitos:**
  - cuenta de AdMob vinculada a la app;
  - archivo `app-ads.txt` en un dominio del desarrollador (el que figure en la ficha de Play);
  - **consentimiento:** Google exige un CMP certificado para el EEE, el Reino Unido y Suiza; el propio UMP SDK de Google sirve. Se muestra la primera vez, antes de pedir anuncios.
- **Público infantil:** el juego es apto para todos, pero conviene declarar público objetivo **13+** en Play para no entrar en la política de familias. Con «Diseñado para familias», los anuncios tendrían que ser certificados para niños y sin personalizar.

## 3. Lo que exige Google Play

- **Cuenta de desarrollador:**
  - pago único de 25 USD;
  - verificación de identidad (documento) y, en cuentas personales, de un teléfono Android.
- **Prueba cerrada obligatoria** (cuentas personales creadas después de noviembre de 2023):
  - al menos **12 testers** con la prueba activa durante **14 días seguidos** antes de poder pedir acceso a producción;
  - después, un cuestionario sobre la prueba. Google puede pedir más tiempo si no ve uso real.
  - En la práctica: reunir 15-20 personas (familia, amigos) por si alguno se cae. Tienen que aceptar la invitación con su cuenta de Google e instalar desde Play.
- **Política de privacidad:**
  - obligatoria en cuanto hay anuncios (AdMob recoge el identificador de publicidad);
  - tiene que estar en una página web pública (no un PDF ni un Google Doc) y enlazada desde la ficha y desde la app (por ejemplo en Ajustes).
- **Formulario de seguridad de los datos.** Declarar lo que recogen la app y AdMob:
  - identificadores del dispositivo (ID de publicidad);
  - datos de uso y diagnóstico, si AdMob los envía;
  - en tránsito, cifrados;
  - sin datos personales propios.
- **Cuestionario de clasificación (IARC):** sin violencia, sin chat ni contenido de usuarios; probablemente PEGI 3 o 7. Hay que marcar que contiene anuncios.
- **Público objetivo y contenido:** declarar la edad; «contiene anuncios: sí».
- **Requisitos técnicos:**
  - `targetSdkVersion` al nivel que Play exija en ese momento (cada agosto sube);
  - AAB firmado;
  - 64 bits, que Capacitor ya cumple.
- **Ficha de la tienda:**
  - icono de 512×512;
  - imagen destacada de 1024×500;
  - capturas de pantalla (2-8 por tipo de dispositivo);
  - descripción corta (80 caracteres) y larga (4.000).

  Se pueden reutilizar los textos y el arte del envío web.

## 4. Trabajo estimado

| Parte | Trabajo |
|---|---|
| Capacitor: proyecto Android, objetivo de build, icono, botón atrás, segundo plano | 1-2 días |
| AdMob: `AdMobAdService`, consentimiento UMP, frecuencia de intersticiales, pruebas con anuncios de prueba | 1-2 días |
| Política de privacidad (página web), `app-ads.txt`, formularios de Play (seguridad de datos, clasificación, público) | 1 día |
| Ficha de la tienda: icono, imagen destacada, capturas, textos | 0,5-1 día |
| Pruebas en varios móviles (rendimiento del WebView, audio, muesca, atrás) | 1-2 días |
| **Prueba cerrada:** 12+ testers durante 14 días, más el cuestionario y la revisión de producción | **2-3 semanas de calendario** (poco trabajo, mucha espera) |

En total, unos **5-8 días de trabajo** más las **2-3 semanas** de la prueba cerrada. Conviene empezar a reclutar testers pronto, en paralelo con el desarrollo.

## 5. Riesgos y decisiones pendientes

- **Rendimiento:** el WebView de móviles de gama baja puede ir más justo que Chrome. Probar pronto en un Android barato.
- **Exclusividad de Poki:** solo cubre portales web; Google Play no le afecta.
- **Dominio y web:** hacen falta una página pública para la política de privacidad y un dominio para `app-ads.txt`; también sirven para la ficha.
- **Compras:** no hay compras con dinero real. Si algún día se añadiera «quitar anuncios», sería Google Play Billing; ahora no se propone.
