# 015 · Acceso con Google y correo verificado

Estado: **Aprobada por David el 4 nov 2026**, con las propuestas:
- **P1:** la licencia de conducir se pide en el registro por pasos del `016` (criterio 12).
- **P2:** no se pide nada más al pasajero.
- **P3:** no se verifica el teléfono (D-04).
- **P4:** si alguien entra con Google con el correo de una cuenta sin confirmar, Google toma esa cuenta.
- **P5:** la recuperación de contraseña por correo entra en este paso.
- **Envío de correos:** SMTP propio con Resend (gratis hasta 100 correos al día) y un **dominio propio verificado**, para que los correos no caigan en spam. El correo de Supabase solo envía unos pocos por hora. Comprar el dominio es tarea de David; mientras tanto se puede probar con el correo de Supabase.

Se redactó como 013 y se renumeró porque el 013 quedó para las encomiendas con contraoferta (D-19). Que la app no revele si un correo existe ya lo exige D-18 (criterios 21 y 22 del 007); aquí se aplica a las pantallas nuevas. La plantilla del correo de confirmación está en `supabase/templates/confirmar-registro.html`.

## Por qué
Hoy una cuenta se crea con correo y contraseña. Si hay que confirmar el correo antes de entrar quedó como pregunta abierta en `002-identidad` y depende de una opción del proveedor de autenticación, no de una regla del producto. David pide que la entrada ofrezca dos caminos:

1. **Continuar con Google**: un toque, sin contraseña, y el correo ya viene verificado.
2. **Crear cuenta con correo**: la cuenta solo sirve después de confirmar el correo.

Confirmar el correo evita cuentas con correos mal escritos (que después no se pueden recuperar) y cuentas basura. Google reduce la fricción para pasajeros y conductores con poca paciencia para formularios.

## Historias
- Como **pasajero o conductor**, quiero entrar con mi cuenta de Google sin crear ni recordar una contraseña.
- Como **usuario que prefiere su correo**, quiero crear la cuenta con correo y contraseña y confirmarla con un enlace que me llega al correo.
- Como **usuario que no recibió el correo**, quiero pedir que me lo reenvíen sin crear otra cuenta.
- Como **sistema**, quiero que ninguna cuenta con correo sin confirmar abra sesión ni cree un perfil.
- Como **usuario que entró con Google**, quiero poder cerrar sesión y eliminar mi cuenta aunque no tenga contraseña.

## Criterios de aceptación
1. **Dado** que se abre la pantalla de entrada, **cuando** el usuario no tiene sesión, **entonces** ve una ilustración propia, un título y una frase corta, y debajo dos botones grandes: «Continuar con Google» (principal) y «Continuar con correo» (secundario). Es la misma estructura que la pantalla de entrada de InDrive que compartió David el 4 nov 2026, pero con la paleta del 011 y **sin la opción por teléfono** (D-04). «Explorar el mapa» se queda como enlace discreto.
1a. **Dado** «Continuar con correo», **cuando** se abre, **entonces** hay una sola pantalla con correo, contraseña, «Entrar» y un enlace «¿No tienes cuenta? Créala». La app **nunca revela** si un correo ya está registrado: si el correo o la contraseña no coinciden, el mensaje es el mismo («Correo o contraseña incorrectos»), para que nadie pueda averiguar quién usa la app.
1b. **Dado** el pie de la pantalla de entrada, **cuando** se muestra, **entonces** enlaza a los Términos de uso y a la Política de privacidad. Ese pie **no** reemplaza el consentimiento LOPDP explícito y con fecha: sigue pidiéndose en «Completa tu perfil» (criterio 1 del 002).
2. **Dado** un registro con correo y contraseña válidos, **cuando** se envía, **entonces** no se abre ninguna sesión. Se muestra «Revisa tu correo», con el correo usado y un botón para reenviar, que se puede usar como máximo una vez cada 60 s.
3. **Dado** una cuenta con el correo sin confirmar, **cuando** intenta entrar, **entonces** se rechaza con un mensaje claro y la opción de reenviar el correo. No se crea un perfil.
4. **Dado** el enlace de confirmación abierto en el mismo teléfono, **cuando** el usuario lo toca, **entonces** vuelve a la app con la sesión iniciada y llega a «Completa tu perfil». Si lo abre en otro dispositivo, ve una página que le pide volver a la app y entrar. El enlace es de un solo uso y caduca.
5. **Dado** un usuario nuevo que elige Google, **cuando** autoriza, **entonces** se crea la cuenta con el correo marcado como verificado y llega a «Completa tu perfil» con el nombre ya puesto (lo puede editar). Teléfono, rol y consentimiento siguen siendo obligatorios (criterio 1 del 002).
6. **Dado** un usuario que cancela o cierra la ventana de Google, **cuando** vuelve, **entonces** está en la pantalla de entrada, sin error rojo y sin cuenta creada.
7. **Dado** un correo que ya tiene una cuenta confirmada con contraseña, **cuando** esa persona entra con Google usando el mismo correo, **entonces** entra a **la misma** cuenta, con su perfil, rol y viajes, y no se crea una cuenta duplicada (ver P4 para correos sin confirmar).
8. **Dado** un conductor que entra con Google, **cuando** completa su perfil, **entonces** igual pasa por la verificación (cédula y fotos) y por la aprobación del administrador (D-04). Entrar con Google no aprueba a nadie.
9. **Dado** un usuario que entró con Google, **cuando** elimina su cuenta, **entonces** confirma con una nueva autorización de Google más la palabra ELIMINAR, en lugar de la contraseña, y se borran los mismos datos que en una cuenta con correo.
10. **Dado** un usuario que entró con Google, **cuando** cierra sesión, **entonces** la próxima vez puede elegir otra cuenta de Google. Cerrar sesión no deja datos de la cuenta anterior (igual que el arreglo del 002).
11. **Dado** el registro con Google, **cuando** se guarda la cuenta, **entonces** de Google solo se guarda el correo y el nombre. No se guarda la foto, los contactos ni ningún otro dato (LOPDP: minimización).
12. **Dado** las cuentas de prueba que ya existen (confirmadas), **cuando** se activa la confirmación obligatoria, **entonces** siguen entrando y la prueba de humo pasa igual.

## Decisiones pendientes (David)
- **P1 · Datos del conductor.** Hoy se piden: nombre, teléfono, placa, consentimiento, cédula (con dígito verificador), foto del conductor, foto de la cédula y foto de la tricimoto con la placa. ¿Se agregan algunos de estos?
  - a) Licencia de conducir: número, tipo, fecha de vencimiento y foto.
  - b) Matrícula vigente de la tricimoto (foto).
  - c) Cooperativa o permiso de operación (depende de D-07, el aliado institucional).
  - d) Contacto de emergencia.
  - Lo que se agregue tiene que justificarse por seguridad u operación (LOPDP: no pedir más de lo necesario).
- **P2 · Datos del pasajero.** Hoy se piden: nombre, teléfono y consentimiento. Propuesta: no agregar nada obligatorio. Un contacto de emergencia opcional encaja mejor en `006-sos-admin`.
- **P3 · Verificar el teléfono.** Propuesta: sigue fuera por D-04 (no hay SMS en el MVP).
- **P4 · Mismo correo sin confirmar.** Si alguien se registró con correo, no confirmó y después entra con Google con ese correo, ¿Google toma la cuenta y se descarta la contraseña sin confirmar? Propuesta: sí, porque Google demuestra que el correo es suyo.
- **P5 · Recuperar contraseña por correo.** ¿Entra en este paso o va aparte? Encaja aquí porque comparte el envío de correos y los enlaces de vuelta a la app.

## Fuera de alcance
Apple, Facebook u otros proveedores. SMS/OTP (D-04). Cambiar los roles o la aprobación de conductores del 002. Los datos nuevos del conductor quedan fuera hasta que David responda P1 (si los aprueba, se agregan aquí antes de pasar al plan).
