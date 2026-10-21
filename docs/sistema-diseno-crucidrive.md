# CruciDrive · Sistema de diseño costero 2.0

Fecha: 20 de octubre de 2026. Dirección solicitada por David: móvil, moderno, cuidado y premium, a partir de su paleta e imágenes. Esta guía define los valores predeterminados para ampliar la app; `frontend/src/constants/theme.ts` es la fuente normativa. El catálogo funcional está en `/diseno` y la bienvenida se puede volver a ver en `/bienvenida`.

Integración de main antes del PR: esta ampliación se identifica como **011**, sin sustituir `010-ajustes-de-campo`. Se conservan el acceso compacto bajo 880 puntos de alto, la hoja desplazable y las alturas de navegación/áreas seguras. Las ofertas del conductor mantienen su componente operativo existente; los nuevos tokens no cambian la regla de asignación ni la lista de hasta tres ofertas.

La extensión **012** ajusta navegación, cabecera del mapa, aviso de zona y filtros de lugares. Mantiene la paleta, tokens y bienvenida del 011.

## Identidad

CruciDrive es movilidad local en tricimoto en Crucita, con viajes y encomiendas. El símbolo conserva la C, camino y ola; pasa a vino y arena. La tricimoto propia sustituye al automóvil genérico en selección y marcadores. La ilustración es arte de marca, no una fotografía de una unidad o un conductor real.

La interfaz es clara para lectura en campo: papel cálido, superficies blancas, texto tinta y contraste. La bienvenida concentra la expresión de marca; pedir un servicio, leer mensajes y abrir configuración priorizan rapidez. No se añaden coches, tiempos de llegada, puntuaciones ni conductores de ejemplo a las pantallas operativas.

## Paleta y uso

| Token | Valor | Uso predeterminado |
| --- | --- | --- |
| `wine` / `primary` | `#7F1139` | Acción principal, selección, enlaces, logo y foco de campos |
| `sand` / `secondary` | `#FEE8C1` | Arena costera, acciones secundarias y fondo de icono instalado |
| `blue` | `#88AEE0` | Agua y paisaje de marca; usar tinta encima, nunca blanco pequeño |
| `paper` | `#FFFCF7` | Lienzo general |
| `surface` | `#FFFFFF` | Tarjetas, fichas y controles sobre mapa |
| `ink` | `#291B25` | Texto principal |
| `glassTextMutedDark` | `#74636D` | Ayuda, texto secundario y placeholders sobre papel/blanco |
| `blueLight` | `#E9F1FB` | Superficies de apoyo y parabrisas del icono |
| `blueInk` | `#294A75` | Foco web y texto sobre azul suave |
| `wineSoft` | `#F7EAF0` | Selección suave, mensajes propios y campo enfocado |
| `outline` | `#E3D8D4` | Bordes y separadores |
| `success` | `#27634D` | Disponible, resultado confirmado y punto de origen |
| `danger` | `#BB2635` | Emergencia y acción irreversible |
| `dangerLight` | `#A51D2D` | Error de campo sobre superficie clara |

Los nombres históricos `darkBg` y `glass*` siguen presentes por compatibilidad, pero ahora resuelven a los roles claros; no indican un modo oscuro automático. `primaryLight` es un alias del vino para texto interactivo de alto contraste; `secondaryLight` resuelve al marrón `#704B20` para indicaciones cálidas legibles, no a una superficie clara. Las pantallas nuevas deben preferir nombres semánticos. Blanco se reserva para texto sobre vino/rojo y detalles de iconos.

Las ocho combinaciones principales tienen pruebas WCAG AA para texto normal (4,5:1 o más). Eso no certifica automáticamente cada estado, imagen, mapa o plataforma; las capturas y el uso real también se revisan.

## Tipografía

| Rol | Fuente | Tamaño / altura habitual | Peso |
| --- | --- | --- | --- |
| Bienvenida móvil | Outfit | 36 / 41 | Semibold |
| Bienvenida escritorio | Outfit | 56 / 60 | Semibold |
| Título de pantalla | Outfit | 32 / 38 | Semibold |
| Sección | Outfit | 24 / 29 | Semibold |
| Acción o título pequeño | Outfit | 16–18 / 22 | Semibold |
| Cuerpo | Inter | 16 / 24 | Regular |
| Etiqueta | Inter | 14 / 20–22 | Regular o Medium |
| Ayuda | Inter | 12 / 18–20 | Regular |

Los títulos grandes usan tracking cercano a −0,02 em; el cuerpo mantiene espaciado normal. Se respeta el escalado del sistema y el desplazamiento; no reducir texto para hacerlo caber en un alto fijo. Precios y contadores usan numerales tabulares. No introducir una tercera familia.

## Espacio, forma y profundidad

- Escala compartida: **4, 8, 16, 24, 32, 48** puntos. Relacionados cerca, secciones separadas.
- Campos: radio 8; tarjetas y botones: 16; fichas amplias: 24. La escena de bienvenida usa radio 32 como excepción de marca. Avatares y controles pequeños pueden ser circulares.
- Alturas táctiles mínimas: botón pequeño 44, normal 48, grande 56; los tamaños pueden crecer con el texto.
- Tarjetas y fichas claras sostienen el contraste sin depender del desenfoque. Blur compartido por defecto: **0**. Algunas barras existentes mantienen su configuración propia.
- Sombras suaves con tinta: desplazamiento 8, radio 24 y opacidad 0,06–0,08; elevación Android 3–4. No usar brillo de color ni sombras negras duras.
- Safe area y teclado forman parte del layout. Mapa y ficha no deben cubrir SOS ni la atribución. La configuración limita su lectura a 680 puntos; formularios del acceso, 440.

## Componentes predeterminados

| Componente | Variantes / props principales | Estados y reglas |
| --- | --- | --- |
| `GlassButton` | `primary`, `secondary`, `ghost`, `danger`; `sm`, `md`, `lg`; `label`, `leftIcon`, `loading`, `disabled` | Carga deshabilita el reenvío y conserva nombre accesible. Deshabilitado reduce opacidad. `danger` exige contexto irreversible. |
| `GlassInput` | `label`, `helperText`, `error`, icono, `secureTextEntry` | Etiqueta visible, foco vino, error rojo anunciado; mostrar/ocultar contraseña tiene control propio. |
| `CheckboxRow` | `label`, `checked`, `onChange`, `error` | Fila de al menos 48; consentimiento explícito, nunca preseleccionado por decoración. |
| `GlassCard` | `default`, `highlight`, `danger`, `noPadding` | Superficie blanca con contenido tinta. No convertir cada fila de ajustes en una tarjeta. |
| `PressableScale` | `pressedScale`, eventos de foco/pulsación, `disabled` | Respuesta en press-in y foco web visible; respeta Reduce Motion. |
| `BrandLockup` | regular, `compact` | Logo con nombre, lema solo en tamaño regular; nunca sustituir por emoji. |
| `TricimotoIcon` | `size`, `color`, `background` | Geometría propia; 26–32 en servicios y mapa; 48 en catálogo. No usar automóvil. |
| `AppMenuButton` | Control hamburger compartido; `edgeSwipe` | Disparador arriba a la izquierda; modal desde la izquierda, ancho hasta 360 dejando 36 exteriores, filas 56 y cierre 48. Cuenta dentro del menú con sesión; acceso sin sesión. Borde de 24 solo en pantallas principales con foco; ajustes usa `edgeSwipe={false}` y conserva Atrás del sistema. |
| `CoastalScene` | Escena de marca | Tricimoto vino/arena y costa azul, sin datos de un viaje. No es un mapa de ruta. |
| `CoastalIntro` | `onFinish` | Pasada única de espuma, Omitir; no reproduce sonido. |

### Ejemplo de uso

```tsx
<GlassButton
  label="Solicitar tricimoto"
  size="lg"
  onPress={solicitar}
  loading={enviando}
  leftIcon={<TricimotoIcon size={28} color={COLORS.white} background={COLORS.wine} />}
/>
<GlassInput label="¿Quién recibe?" value={destinatario} onChangeText={setDestinatario} error={error} />
```

## Iconografía y recursos

Ionicons en contorno para navegación y acciones: `map-outline`, `cube-outline`, `chatbubble-outline`, `person-outline`, `settings-outline`, `shield-checkmark-outline`, `location-outline` y `log-in-outline`. Tamaño habitual 20–24 y un estilo de peso consistente. Los iconos de navegación mantienen texto; un botón de solo icono debe tener nombre accesible y área de al menos 44–48.

| Recurso | Archivo |
| --- | --- |
| Tricimoto geométrica reutilizable | `frontend/src/components/TricimotoIcon.tsx` |
| Vector frontal exportable | `frontend/assets/premium/tricimoto-front.svg` |
| Ilustración de bienvenida | `frontend/assets/premium/tricimoto-hero.png` |
| Original de marca adaptada | `frontend/assets/premium/mark-source.png` |
| Prompts exactos | `frontend/assets/premium/*-prompt.txt` |
| Logo de interfaz | `frontend/assets/brand-mark.png` |
| Icono instalado y variantes Android | `frontend/assets/icon.png`, `android-icon-*.png` |
| Splash | `frontend/assets/splash-icon.png` |
| PWA / Apple touch | `frontend/public/pwa-*.png`, `apple-touch-icon.png` |
| Valores exportables | `frontend/assets/premium/design-tokens.json` |

La máscara adaptativa recibe padding adicional al generarse. El monocromo contiene solo la silueta; el fondo de instalación es arena. `node frontend/scripts/generate-brand-assets.mjs` regenera derivados; `node frontend/scripts/export-design-tokens.mjs` exporta el JSON desde el tema. No modificar el JSON como una segunda fuente de verdad.

## Modelos de pantalla

| Modelo | Estructura | Acción principal |
| --- | --- | --- |
| Bienvenida | Marca → escena → saludo → servicios → acceso | Viajar o enviar una encomienda |
| Acceso / registro | Marca y contexto → selector → campos → errores → consentimiento contextual | Entrar o crear cuenta |
| Mapa | Menú izquierdo → mapa → hoja con cabecera fija de sector/aviso y SOS 64 → contenido desplazable de destino/origen | Seleccionar y solicitar |
| Encomienda | Ruta → contenido → destinatario → autorización → precio a convenir | Solicitar encomienda |
| Buscando | Estado real → ruta → acción de cancelar | Cancelar mientras busca |
| Servicio aceptado | Datos reales del conductor → ruta y precio/condición → chat | Coordinar por chat |
| Conductor | Estado de conexión → aviso fuera de zona cuando corresponda → disponibilidad → oferta con cuenta real, sin SOS flotante | Aceptar o rechazar |
| Ajustes y ayuda | Encabezado con volver → título → grupos de filas y explicación | Abrir sección o permiso |
| Cuenta / privacidad | Datos propios → exportación → consentimiento → acción destructiva separada | Gestionar su cuenta |
| Chat | Participante real → burbujas → compositor junto al teclado | Enviar mensaje |
| Catálogo de diseño | Paleta → estados → campos → iconos → reglas | Explorar muestras sin enviar datos |
| Lugares del administrador | Visibles por defecto → búsqueda por nombre + sector + visibilidad → carga, resultados o reintento | Consultar y editar; «Ocultos» o «Todos» incluyen desactivados a elección |

La hoja del mapa mantiene sector/aviso y SOS visibles mientras se desplaza el contenido de pedir, buscando o servicio activo. Cuenta, sector y SOS ya no flotan sobre el mapa. El SOS conserva los dos segundos de pulsación para abrir el marcador con el 911; el registro de alertas D-05 sigue pendiente del paso 006.

La zona orientativa del piloto es la envolvente de los cinco centros operativos ampliada 1500 m. No es un límite administrativo ni añade una restricción de despacho. GPS desconocido o inválido no equivale a fuera de zona. El pasajero fuera ve «Estás fuera de la zona de servicio de Crucita», el mapa se centra en Crucita y puede elegir origen manual por lugar o sector; no usa su GPS exterior como origen. El conductor conserva el GPS real y recibe el aviso sin bloqueo nuevo de disponibilidad durante el piloto; rigen las reglas actuales del servidor.

Los filtros admin de nombre, sector y visibilidad se combinan en servidor antes del límite de 200 resultados. Al cambiarlos se indica carga y se ocultan los resultados anteriores; errores ofrecen reintento conservando los filtros. «Visibles» es el valor inicial; los lugares ocultos requieren elegir «Ocultos» o «Todos».

No añadir un tiempo estimado ni dibujar una ruta de calles que el backend no calcula. La previsualización web de OpenStreetMap sigue sin dibujar marcadores; los marcadores de tricimoto se usan en el mapa nativo con datos reales.

## Motion y primera visita

| Interacción | Tiempo | Comportamiento |
| --- | --- | --- |
| Pulsar / soltar | 100 / 140 ms | Escala 0,97 y vuelta, curva ease-out compartida |
| Entrada / salida de panel | 220 / 140 ms | Rápida, sin retardos encadenados |
| Menú 012 | Spring 300 ms | Sin rebote, `ReduceMotion.System`; arrastre de cierre en hilo de UI y recuperación al interrumpirse |
| Bienvenida | 2.400 ms | Logo sobre arena; agua y borde de espuma pasan y revelan el contenido |
| SOS | 2.000 ms | Progreso solo mientras mantiene pulsado; sin anillo ornamental infinito |

La bienvenida de la raíz pública se recuerda con `crucidrive:welcome:v1 = seen`. Terminarla, omitirla o elegir servicio/acceso guarda la bandera; no contiene identidad, GPS ni credenciales. Al volver, se abre el mapa. Si falla la lectura se permite entrar al mapa; si falla la escritura no se bloquea la navegación. Borrar los datos de la aplicación reinicia esta preferencia.

Reduce Motion muestra la bienvenida estática sin pasada espacial. Omitir permanece disponible durante la animación. No se altera el acceso por roles, el destino de avisos ni las rutas privadas. `/bienvenida` permite una reproducción manual; `/diseno` es el catálogo del propietario, separado de los flujos de operación.

El menú se abre por botón o desde el borde izquierdo de 24 puntos en pantallas principales con foco; el resto del mapa conserva sus gestos. Se cierra por deslizamiento izquierdo, exterior, cierre visible o Atrás. Ajustes conserva el menú a la izquierda y el gesto Atrás nativo, sin borde de apertura reservado.

## Accesibilidad, verdad y mantenimiento

Foco visible, etiquetas persistentes, errores anunciados, controles con nombre y carga sin doble envío. El color acompaña un texto o símbolo; no sustituye un estado. No solicitar permisos desde la bienvenida ni encender GPS/notificaciones por una animación. No esconder advertencias o errores para mejorar una captura.

Esta versión define una apariencia clara; no promete alternancia automática claro/oscuro. Pruebas automatizadas de contraste cubren combinaciones normativas; tests de preferencia cubren primera visita y fallos de almacenamiento. Las capturas validan web móvil/escritorio. FPS, Keychain/Keystore, permisos y aspecto de marcadores nativos se verifican en un teléfono con nuevo APK: no quedan demostrados por un bundle.

Evidencia 012: `.impeccable/review/campo012/` contiene mapa, menú, ficha, encomienda y configuración a 360×640, más mapa a 1280×800. Se reportan 381 pruebas frontend, 386 backend (incluidas las correcciones de configuración posteriores a la revisión UI), TypeScript y exportaciones web/Android correctos. Las capturas son web, sin Android físico ni sesión admin; quedan pendientes los gestos nativos, estados activos con cuentas reales, recepción de chat y filtros admin en dispositivo. Estas comprobaciones no implementan el registro SOS del 006.

## Skills consultados

- Expo design system/native UI: adaptación al tema y componentes existentes.
- [Apple Design y Animate Expo](https://github.com/emilkowalski/skills): feedback inmediato, frecuencia de uso, reducción de movimiento y trabajo en UI. Instalados para turnos posteriores; guías leídas en esta tarea.
- [Design Taste Frontend](https://github.com/leonxlnx/taste-skill): jerarquía, verdad de datos y pantallas de operación; no se traslada una composición de dashboard de escritorio al mapa móvil.
- [Design Mobile Apps / Sleek](https://github.com/designed-by-ai/skills): instalado y examinado; su API requiere cuenta/clave y no se utilizó.
- [Uizze](https://uizze.com/): el enlace conduce a conexión con cuenta; no se conectó ni compró un servicio.

Las referencias del usuario gobiernan paleta y vehículos. Los videos compartidos de 6 y 7 segundos contienen un conductor y una rueda animados; se usaron como inspiración de ritmo. No se redistribuyeron como recursos de la app.
