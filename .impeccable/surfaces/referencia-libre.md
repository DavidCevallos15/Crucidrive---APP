# Referencia libre · 003 criterio 20

Mode: Operate. Platform: adaptive. Refinamiento del sistema 011/012, sin cambiar paleta, tipo ni geometría.

Pedido de David: «que el usuario también pueda ingresar el nombre del lugar así sea que no se encuentre». El criterio 20 y D-09 ya permiten referencias por sector. Botón «Usar este nombre» después del buscador, disponible durante carga, fallo o coincidencias; campo editable con nombre, explicación de ubicación aproximada y sector obligatorio. Destino y origen pueden quedar en el mismo sector. Aplica también a encomiendas, con precio a convenir. No crea lugares en catálogo ni coordenadas de negocios.

QUALITY BAR: conservar el texto y hacerlo reconocible en ficha y solicitud, nombres/acciones accesibles, 48 puntos mínimo, desplazamiento bajo cabecera SOS fija en 360×640 y lectura en pantalla amplia. Reutilizar GlassInput/GlassButton y tema vino/arena/papel. No nueva animación.

Evidencia: `.impeccable/review/referencia-libre/`; capturas web con nombres explícitamente de prueba, sin enviar solicitudes. Se comprobó origen/destino en Malecón, nombre vacío deshabilita sectores, ficha editable y conservación al pasar a encomienda. Pruebas: 388 frontend y 388 backend; tsc y export web correctos. CORS local preflight 204 y origen exacto 127.0.0.1:8082 verificados. Sin Android físico ni pruebas de cuenta/conductor en este flujo. No detector web por plataforma adaptive.
