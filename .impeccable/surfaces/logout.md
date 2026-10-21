# Cierre de sesión · Operate · adaptive

Extensión puntual del sistema existente solicitada por David tras un bloqueo de
la app al salir. Conservar papel, vino, arena, azul, Outfit/Inter, iconografía y
motion existentes. No comp nuevo, imágenes ni animación ornamental.

El usuario debe saber que la salida está en curso, no poder duplicarla y disponer
de error y reintento cuando Auth no confirma. El menú se cierra al cambiar la
identidad; solo el guard raíz navega. El administrador conserva título completo y
acciones Lugares/Cerrar sesión en una segunda fila adaptable a 360 px. Perfil y
verificación usan el botón compartido con busy/disabled. Objetivos de toque ≥48 en
Android, contenido legible, alerta accesible y sin prometer una salida falsa.

Quality bar: login/salida/recarga comprobables con los tres roles en web, sin
pantalla vacía ni cuenta anterior. No presentar esa evidencia como validación
Android física. Especificación y registro en `specs/002-identidad/cierre-sesion-campo.md`.

No detector web: UI React Native adaptive; revisar según ios.md/android.md.
