/**
 * Prueba de humo contra la BD y el backend reales (pasos 001 a 004).
 *
 * Recorre: consentimiento y registro -> el conductor sube fotos y cédula -> un
 * conductor SIN aprobar no puede aceptar un viaje -> el administrador revisa y
 * aprueba -> despacho (003): disponibilidad -> oferta al conductor conectado ->
 * rechazo -> "sin conductor" -> nueva solicitud -> aceptación con chat -> en_curso ->
 * finalizado -> la tricimoto vuelve a disponible. Mide los bytes de la oferta y de cada
 * envío de ubicación y proyecta una jornada de 10 h (criterio 27).
 * Paso 005: llegada, inicio y final por el conductor con sus funciones de la BD, chat en solo
 * lectura al terminar y calificación del pasajero (una sola vez).
 * Paso 004: registro y reasignación del teléfono para avisos (11), la ubicación del conductor en
 * un viaje llega solo a su pasajero, por socket y por REST (13, 14, 15), límite del REST y
 * proyección de 10 h en segundo plano con avisos (18).
 *
 * Requisitos:
 *   - Backend corriendo (npm run dev) y backend/.env con SUPABASE_URL, SUPABASE_ANON_KEY y
 *     SUPABASE_SERVICE_ROLE_KEY (el despachador la necesita).
 *   - Que no haya OTRO conductor disponible y conectado: el guion espera ser el único candidato.
 *   - TRES usuarios ya creados en Supabase Auth (email confirmado): pasajero, conductor y
 *     administrador (la cuenta admin se asigna con supabase/one-off/*_primer_admin.sql).
 *   - Credenciales por variables de entorno (no se guardan ni se imprimen):
 *       SMOKE_PASAJERO_EMAIL / SMOKE_PASAJERO_PASSWORD
 *       SMOKE_CONDUCTOR_EMAIL / SMOKE_CONDUCTOR_PASSWORD
 *       SMOKE_ADMIN_EMAIL / SMOKE_ADMIN_PASSWORD
 *   - Opcional: SMOKE_API (por defecto http://localhost:3000) y SMOKE_CEDULA (cédula válida de prueba).
 *
 * Deja en la BD un viaje sin_conductor, uno finalizado, un conductor aprobado (y no disponible al
 * terminar) y 3 fotos de prueba en Storage. Los viajes activos de corridas anteriores se cancelan
 * al empezar, solo si pertenecen a estas cuentas y tienen la referencia "Prueba de humo".
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { io } = require('socket.io-client');
const {
  conectarSocket: conectar, esperar, esperarCondicion, cerrarViajesDePrueba, dormir, bytesEvento,
  bytesHttp, proyeccionJornada,
} = require('./smokeHelpers');
const { avisoOferta, avisoRetirada } = require('../src/avisos/mensajes');

const API = process.env.SMOKE_API || 'http://localhost:3000';
const CEDULA = process.env.SMOKE_CEDULA || '1710034065';
const requeridas = [
  'SUPABASE_URL', 'SUPABASE_ANON_KEY',
  'SMOKE_PASAJERO_EMAIL', 'SMOKE_PASAJERO_PASSWORD',
  'SMOKE_CONDUCTOR_EMAIL', 'SMOKE_CONDUCTOR_PASSWORD',
  'SMOKE_ADMIN_EMAIL', 'SMOKE_ADMIN_PASSWORD',
];
const faltan = requeridas.filter((k) => !process.env[k]);
if (faltan.length) {
  console.error(`Faltan variables de entorno: ${faltan.join(', ')}`);
  process.exit(2);
}

// JPEG mínimo de 1x1 pixel: suficiente para probar el bucket (solo acepta image/jpeg).
const JPEG_MINIMO = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
  'base64'
);

let fallos = 0;
let pas;
let con;
const sockets = [];
// Token de avisos ficticio: se borra antes del despacho para no mandarle avisos reales a Expo.
const TOKEN_PRUEBA = 'ExponentPushToken[pruebaDeHumo0004]';
const paso = (nombre, ok, detalle = '') => {
  if (!ok) fallos += 1;
  console.log(`${ok ? 'OK   ' : 'FALLO'} ${nombre}${detalle ? ` - ${detalle}` : ''}`);
  return ok;
};

const login = async (email, password) => {
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Login fallido (${email}): ${error.message}`);
  return { sb, token: data.session.access_token, id: data.user.id };
};

const http = async (token, method, ruta, cuerpo) => {
  let res;
  try {
    res = await fetch(`${API}${ruta}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      signal: AbortSignal.timeout(10000),
    });
  } catch (e) {
    throw new Error(`No se pudo conectar con ${API} (${e.cause?.code || e.message}). ¿Está corriendo "npm run dev" en otra terminal?`);
  }
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
};

/** POST /api/conductores/ubicacion midiendo los bytes de texto de la petición y la respuesta. */
const ubicacionRest = async (token, cuerpo) => {
  const url = `${API}/api/conductores/ubicacion`;
  const json = JSON.stringify(cuerpo);
  const cabeceras = {
    'content-type': 'application/json', authorization: `Bearer ${token}`, 'content-length': String(Buffer.byteLength(json)),
  };
  const res = await fetch(url, { method: 'POST', headers: cabeceras, body: json, signal: AbortSignal.timeout(10000) });
  const cuerpoRespuesta = await res.text();
  const cabecerasRespuesta = {};
  res.headers.forEach((valor, nombre) => { cabecerasRespuesta[nombre] = valor; });
  return {
    status: res.status,
    bytes: bytesHttp({ metodo: 'POST', url, cabeceras, cuerpo: json, status: res.status, cabecerasRespuesta, cuerpoRespuesta }),
  };
};

/** Espera un tiempo fijo y dice si llegó el evento (para comprobar que NO llega). */
const recibe = (socket, evento, ms = 2500) => esperar(socket, evento, () => true, ms).then((d) => d !== null);

const conectarSocket = async (token) => {
  const socket = await conectar(io, API, token);
  sockets.push(socket);
  socket.on('error_message', (mensaje) => console.error(`[Socket del guion] ${mensaje}`));
  return socket;
};

/** Espera la escritura real del GPS; un retardo fijo no garantiza que el conductor sea candidato. */
const guardarUbicacion = async (socket, usuario, ubicacion) => {
  const { data: anterior, error } = await usuario.sb.from('tricimotos')
    .select('ubicacion_en').eq('conductor_id', usuario.id).single();
  if (error) throw new Error('No se pudo leer la ubicación anterior del conductor.');
  socket.emit('update_location', ubicacion);
  await esperarCondicion(async () => {
    const { data, error: lecturaError } = await usuario.sb.from('tricimotos')
      .select('ubicacion_en, sector_id').eq('conductor_id', usuario.id).single();
    if (lecturaError) throw new Error('No se pudo comprobar la ubicación del conductor.');
    return data?.ubicacion_en && data.ubicacion_en !== anterior?.ubicacion_en
      && data.sector_id === ubicacion.sectorId;
  }, 'El backend no guardó una nueva ubicación GPS del conductor.');
};

const MALECON = { lat: -0.8699838, lng: -80.53995042 };
const LA_BOCA = { lat: -0.80147852, lng: -80.52098189 };
const SOLICITUD = {
  origen: MALECON,
  destino: LA_BOCA,
  pasajeros: 3,
  sectorOrigenId: 'malecon',
  sectorDestinoId: 'la_boca',
  destinoDescripcion: 'Prueba de humo',
  tarifa: 99,
};

(async () => {
  pas = await login(process.env.SMOKE_PASAJERO_EMAIL, process.env.SMOKE_PASAJERO_PASSWORD);
  con = await login(process.env.SMOKE_CONDUCTOR_EMAIL, process.env.SMOKE_CONDUCTOR_PASSWORD);
  const adm = await login(process.env.SMOKE_ADMIN_EMAIL, process.env.SMOKE_ADMIN_PASSWORD);
  if (new Set([pas.id, con.id, adm.id]).size !== 3) throw new Error('Usa tres cuentas distintas para los roles del guion.');
  paso('Login de pasajero, conductor y administrador', true);

  const { data: perfilAdmin } = await adm.sb.from('perfiles').select('rol').eq('id', adm.id).maybeSingle();
  if (!paso('La cuenta de administrador tiene rol admin', perfilAdmin?.rol === 'admin', `rol=${perfilAdmin?.rol}`)) {
    throw new Error('La cuenta SMOKE_ADMIN debe tener el rol admin antes de ejecutar el guion.');
  }

  // 0. Solo rastros identificados de este guion, comprobando cada respuesta.
  const cerrados = await cerrarViajesDePrueba(pas, con, http);
  paso('Limpieza de viajes de prueba de corridas anteriores', true, `${cerrados} cerrados`);

  // 1. Registro con consentimiento (se omite si el perfil ya existe)
  const asegurarPerfil = async (u, cuerpo, etiqueta) => {
    const { data } = await u.sb.from('perfiles').select('rol').eq('id', u.id).maybeSingle();
    if (data) return paso(`Perfil de ${etiqueta} ya existe`, data.rol === cuerpo.rol, `rol=${data.rol}`);
    const sinConsentimiento = await http(u.token, 'POST', '/api/auth/registro', { ...cuerpo, consentimiento: false });
    paso(`Registro de ${etiqueta} sin consentimiento es rechazado`, sinConsentimiento.status === 400, `HTTP ${sinConsentimiento.status}`);
    const r = await http(u.token, 'POST', '/api/auth/registro', { ...cuerpo, consentimiento: true });
    return paso(`Registro de ${etiqueta} con consentimiento`, r.status === 201, `HTTP ${r.status}`);
  };
  if (!await asegurarPerfil(pas, { rol: 'pasajero', nombre: 'Pasajero Prueba', telefono: '0990000001' }, 'pasajero')
      || !await asegurarPerfil(con, { rol: 'conductor', nombre: 'Conductor Prueba', telefono: '0990000003', placa: 'SMK-001' }, 'conductor')) {
    throw new Error('No se pudieron preparar los perfiles de prueba.');
  }

  // 2. Verificación del conductor: fotos a Storage privado + cédula
  const estadoInicial = await http(con.token, 'GET', '/api/conductores/verificacion');
  const yaAprobado = estadoInicial.json.data?.estado === 'aprobado';
  if (!yaAprobado) {
    const sinFotos = await http(con.token, 'POST', '/api/conductores/verificacion', { cedula: CEDULA });
    const hayFotos = sinFotos.status !== 400;
    if (!hayFotos) paso('Sin fotos subidas, la verificación se rechaza', true, 'HTTP 400');

    for (const tipo of ['conductor', 'cedula', 'vehiculo']) {
      const { error } = await con.sb.storage.from('verificacion')
        .upload(`${con.id}/${tipo}.jpg`, JPEG_MINIMO, { contentType: 'image/jpeg', upsert: true });
      paso(`El conductor sube la foto "${tipo}"`, !error, error ? error.message : '');
    }
    const otro = await con.sb.storage.from('verificacion')
      .upload(`${pas.id}/conductor.jpg`, JPEG_MINIMO, { contentType: 'image/jpeg', upsert: true });
    paso('No puede subir archivos a la carpeta de otra persona', !!otro.error);

    const cedulaMala = await http(con.token, 'POST', '/api/conductores/verificacion', { cedula: '1710034066' });
    paso('Una cédula con dígito verificador incorrecto se rechaza', cedulaMala.status === 400, `HTTP ${cedulaMala.status}`);
    const enviada = await http(con.token, 'POST', '/api/conductores/verificacion', { cedula: CEDULA });
    paso('El conductor envía su verificación', [200, 201].includes(enviada.status), `HTTP ${enviada.status}`);
  } else {
    paso('El conductor ya estaba aprobado (se omite la subida)', true);
  }

  // 3. Un conductor sin aprobar no opera
  let viajeId;
  if (!yaAprobado) {
    const sol0 = await http(pas.token, 'POST', '/api/viajes/solicitar', {
      origen: { lat: -0.8699838, lng: -80.53995042 }, destino: { lat: -0.80147852, lng: -80.52098189 }, pasajeros: 1,
      destinoDescripcion: 'Prueba de humo',
    });
    viajeId = sol0.json.data?.id;
    if (!viajeId) throw new Error(`No se pudo crear el viaje del conductor sin aprobar (HTTP ${sol0.status}).`);
    const intento = await http(con.token, 'POST', '/api/viajes/aceptar', { viajeId });
    paso('Un conductor sin aprobar NO puede aceptar un viaje', intento.status === 403, `HTTP ${intento.status}`);
    // Sin candidatos, el despachador puede cerrarlo como sin_conductor antes de que el pasajero cancele.
    await http(pas.token, 'PATCH', `/api/viajes/${viajeId}/estado`, { estado: 'cancelado' });
    const { data: fila0 } = await pas.sb.from('viajes').select('estado').eq('id', viajeId).single();
    paso('Ese viaje de prueba queda cerrado', ['cancelado', 'sin_conductor'].includes(fila0?.estado), `estado=${fila0?.estado}`);

    const comoConductor = await http(con.token, 'GET', '/api/admin/conductores');
    paso('Un conductor no puede usar el panel de administrador', comoConductor.status === 403, `HTTP ${comoConductor.status}`);

    // 4. El administrador revisa y aprueba
    const lista = await http(adm.token, 'GET', '/api/admin/conductores?estado=pendiente');
    const mia = (lista.json.data || []).find((s) => s.conductor_id === con.id);
    paso('El administrador ve la solicitud pendiente con la placa', !!mia && mia.placa === 'SMK-001', `HTTP ${lista.status}`);
    const detalle = await http(adm.token, 'GET', `/api/admin/conductores/${con.id}`);
    const urlFoto = detalle.json.data?.fotos?.cedula;
    paso('El administrador recibe enlaces firmados de las fotos', !!urlFoto, `HTTP ${detalle.status}`);
    if (urlFoto) {
      const foto = await fetch(urlFoto, { signal: AbortSignal.timeout(10000) });
      paso('El enlace firmado descarga la foto de la cédula', foto.ok, `HTTP ${foto.status}`);
    }
    const aprobada = await http(adm.token, 'POST', `/api/admin/conductores/${con.id}/aprobar`);
    paso('El administrador aprueba al conductor', aprobada.status === 200, `HTTP ${aprobada.status}`);
  }

  // 4b. Teléfono para avisos (paso 004, criterio 11)
  const malo = await http(pas.token, 'POST', '/api/dispositivos', { token: 'no-es-un-token' });
  paso('Un identificador de avisos inválido se rechaza', malo.status === 400, `HTTP ${malo.status}`);
  const tokenDe = async (u) => {
    const { data, error } = await u.sb.from('dispositivos_push').select('token').eq('token', TOKEN_PRUEBA);
    if (error) throw new Error('No se pudo leer dispositivos_push.');
    return data.length > 0;
  };
  const reg = await http(pas.token, 'POST', '/api/dispositivos', { token: TOKEN_PRUEBA });
  paso('El pasajero registra su teléfono y lo ve como propio', reg.status === 204 && await tokenDe(pas), `HTTP ${reg.status}`);
  const reasignado = await http(con.token, 'POST', '/api/dispositivos', { token: TOKEN_PRUEBA });
  paso('Si el teléfono inicia sesión con otra cuenta, el token pasa a esa cuenta (criterio 11)',
    reasignado.status === 204 && await tokenDe(con) && !await tokenDe(pas), `HTTP ${reasignado.status}`);
  const olvidado = await http(con.token, 'DELETE', `/api/dispositivos/${encodeURIComponent(TOKEN_PRUEBA)}`);
  paso('Al cerrar sesión el token se borra (criterio 11)', olvidado.status === 204 && !await tokenDe(con), `HTTP ${olvidado.status}`);

  // 5. Despacho (paso 003)
  const sCon = await conectarSocket(con.token);
  const sPas = await conectarSocket(pas.token);
  paso('Sockets autenticados; el servidor envía su hora (R14)', Number.isFinite(sCon.desfaseMs),
    Number.isFinite(sCon.desfaseMs) ? `desfase=${sCon.desfaseMs} ms` : 'sin hora_servidor');

  // Paso 004 (criterio 5): ponerse disponible exige el consentimiento vigente (0.2).
  const consentimiento = await http(con.token, 'POST', '/api/auth/consentimiento', { consentimiento: true });
  paso('El conductor acepta el consentimiento vigente', consentimiento.status === 201,
    `HTTP ${consentimiento.status}, versión ${consentimiento.json.data?.version}`);

  const noDisp = await http(con.token, 'PATCH', '/api/conductores/disponibilidad', { disponible: false });
  const disp = await http(con.token, 'PATCH', '/api/conductores/disponibilidad', { disponible: true });
  if (!paso('El conductor cambia su disponibilidad en el servidor (criterio 1)',
    noDisp.status === 200 && disp.status === 200 && disp.json.data?.estado === 'disponible',
    `HTTP ${noDisp.status}/${disp.status}, estado=${disp.json.data?.estado}`)) {
    throw new Error('El conductor no está disponible: no se puede probar el despacho.');
  }

  // Ubicación reciente: sin ella no es candidato (criterio 2).
  const ubicacion = { sectorId: 'malecon', coords: MALECON };
  await guardarUbicacion(sCon, con, ubicacion);

  // 5.1 Oferta, rechazo y "sin conductor"
  const ofertaA = esperar(sCon, 'oferta_viaje');
  const sol1 = await http(pas.token, 'POST', '/api/viajes/solicitar', SOLICITUD);
  const viaje1 = sol1.json.data;
  paso('Solicitud de viaje (3 pasajeros)', sol1.status === 201 && viaje1?.id, `HTTP ${sol1.status}`);
  paso('Tarifa = 0,50 x 3 = 1,50 (ignora la enviada por el cliente)', Number(viaje1?.tarifa) === 1.5, `tarifa=${viaje1?.tarifa}`);
  if (!viaje1?.id) throw new Error('Sin viaje, no se puede continuar.');

  const doble = await http(pas.token, 'POST', '/api/viajes/solicitar', SOLICITUD);
  paso('Una segunda solicitud con un viaje activo se rechaza (criterio 13)', doble.status === 409, `HTTP ${doble.status}`);

  const oferta1 = await ofertaA;
  paso('La oferta llega al conductor conectado (criterio 4)', oferta1?.viajeId === viaje1.id,
    oferta1 ? `fase=${oferta1.fase}, distancia=${oferta1.distanciaM} m` : 'no llegó en 8 s (¿hay otro conductor disponible?)');
  if (oferta1?.viajeId !== viaje1.id) throw new Error('No llegó una oferta para el viaje solicitado; no se continúa.');

  const bytesOferta = bytesEvento('oferta_viaje', oferta1);
  const prohibidas = ['telefono', 'nombre', 'pasajeroNombre', 'pasajero_id', 'lat', 'lng', 'coords'];
  const conDatosPersonales = JSON.stringify(oferta1).match(new RegExp(`"(${prohibidas.join('|')})"`, 'g'));
  paso('La oferta pesa menos de 2 KB y no trae datos del pasajero (criterios 15 y 27)',
    bytesOferta < 2048 && !conDatosPersonales, `${bytesOferta} B${conDatosPersonales ? `, trae ${conDatosPersonales}` : ''}`);
  const quedan = Math.round((oferta1.venceEn - (Date.now() + sCon.desfaseMs)) / 1000);
  paso('La oferta vence en unos 15 s según el servidor (R14)', quedan >= 10 && quedan <= 16, `quedan ${quedan} s`);

  const sinConductor = esperar(sPas, 'viaje_sin_conductor', (d) => d.viajeId === viaje1.id, 10000);
  sCon.emit('rechazar_oferta', { viajeId: viaje1.id });
  const avisoSin = await sinConductor;
  paso('Tras el rechazo, sin más candidatos, el pasajero recibe "sin conductor" (criterios 6 y 11)', !!avisoSin);
  const { data: fila1 } = await pas.sb.from('viajes').select('estado').eq('id', viaje1.id).single();
  paso('El viaje queda como sin_conductor en la BD', fila1?.estado === 'sin_conductor', `estado=${fila1?.estado}`);

  // 5.2 Nueva solicitud ("Volver a pedir") aceptada
  await guardarUbicacion(sCon, con, ubicacion);
  const ofertaB = esperar(sCon, 'oferta_viaje');
  const sol2 = await http(pas.token, 'POST', '/api/viajes/solicitar', SOLICITUD);
  const viaje = sol2.json.data;
  paso('Volver a pedir crea una solicitud nueva', sol2.status === 201 && viaje?.id, `HTTP ${sol2.status}`);
  if (!viaje?.id) throw new Error('Sin viaje, no se puede continuar.');
  const oferta2 = await ofertaB;
  paso('El mismo conductor recibe la nueva oferta', oferta2?.viajeId === viaje.id);
  if (oferta2?.viajeId !== viaje.id) throw new Error('No llegó la nueva oferta; aceptar sin ella daría un 409 esperado.');

  const avisoAceptado = esperar(sPas, 'viaje_aceptado', (d) => d.viajeId === viaje.id);
  const ace = await http(con.token, 'POST', '/api/viajes/aceptar', { viajeId: viaje.id });
  const threadId = ace.json.data?.chat?.threadId;
  paso('Aceptación por el conductor con la oferta vigente + hilo de chat (criterio 10)', ace.status === 200 && !!threadId, `HTTP ${ace.status}`);
  if (!threadId) throw new Error('Sin hilo de chat, no se puede continuar.');
  const aceptado = await avisoAceptado;
  paso('El pasajero recibe nombre, placa y teléfono sin recargar (criterios 10 y 16)',
    !!aceptado?.conductor?.nombre && !!aceptado?.conductor?.placa && !!aceptado?.conductor?.telefono && aceptado?.chat?.threadId === threadId,
    aceptado ? `placa=${aceptado.conductor?.placa}` : 'no llegó viaje_aceptado');

  const otraVez = await http(con.token, 'POST', '/api/viajes/aceptar', { viajeId: viaje.id });
  paso('Aceptar de nuevo un viaje ya tomado responde 409 (criterio 8)', otraVez.status === 409, `HTTP ${otraVez.status}`);
  const ocupado = await http(con.token, 'PATCH', '/api/conductores/disponibilidad', { disponible: false });
  paso('Con un viaje en curso no puede cambiar su disponibilidad (criterio 3)', ocupado.status === 409, `HTTP ${ocupado.status}`);

  // 5.2b Seguimiento del conductor (paso 004): solo su pasajero recibe la posición.
  const sAdm = await conectarSocket(adm.token);
  const deEsteViaje = (d) => d.viajeId === viaje.id;
  const posicionSocket = esperar(sPas, 'conductor_ubicacion', deEsteViaje, 5000);
  const terceroSocket = recibe(sAdm, 'conductor_ubicacion');
  const conductorSocket = recibe(sCon, 'conductor_ubicacion');
  sCon.emit('update_location', ubicacion);
  const posicion = await posicionSocket;
  paso('El pasajero recibe la posición de su conductor por socket (criterio 13)',
    !!posicion && posicion.lat === MALECON.lat && posicion.lng === MALECON.lng && !!posicion.en,
    posicion ? `${bytesEvento('conductor_ubicacion', posicion)} B` : 'no llegó en 5 s');
  const [alTercero, alConductor] = await Promise.all([terceroSocket, conductorSocket]);
  paso('Ningún otro usuario recibe esa posición (criterio 14)', !alTercero && !alConductor,
    `tercero=${alTercero}, conductor=${alConductor}`);

  const posicionRest = esperar(sPas, 'conductor_ubicacion', deEsteViaje, 5000);
  const terceroRest = recibe(sAdm, 'conductor_ubicacion');
  const rest1 = await ubicacionRest(con.token, ubicacion);
  const llegoRest = await posicionRest;
  paso('Envío por REST: 204 y el pasajero recibe la posición (plan P11)', rest1.status === 204 && !!llegoRest,
    `HTTP ${rest1.status}, ${rest1.bytes} B por envío`);
  paso('Por REST tampoco la recibe un tercero (criterio 14)', !await terceroRest);
  const rest2 = await ubicacionRest(con.token, ubicacion);
  const rest3 = await ubicacionRest(con.token, ubicacion);
  paso('Un tercer envío por REST en 5 s responde 429 (límite por conductor)', rest2.status === 204 && rest3.status === 429,
    `HTTP ${rest2.status}/${rest3.status}`);

  // 5.3 Chat
  sPas.emit('join_chat', { threadId });
  sCon.emit('join_chat', { threadId });
  await dormir(800);
  const recibido = esperar(sPas, 'message_received', (m) => m.content === 'Voy en camino', 5000);
  sCon.emit('send_message', { threadId, content: 'Voy en camino' });
  const msg = await recibido;
  paso('Mensaje del conductor llega al pasajero en tiempo real', msg?.content === 'Voy en camino');

  const hist = await http(pas.token, 'GET', `/api/chats/${threadId}/mensajes`);
  paso('Historial REST contiene el mensaje', hist.status === 200 && hist.json.data?.some((m) => m.content === 'Voy en camino'), `HTTP ${hist.status}`);

  // 5.3b Viaje en curso (005). Termina el conductor: si terminara el pasajero, contaría para su sanción.
  const llegada = await http(con.token, 'POST', `/api/viajes/${viaje.id}/llegada`);
  paso('«Llegué» del conductor (005, criterio 3)', llegada.status === 200 && Boolean(llegada.json.data?.llegado_en), `HTTP ${llegada.status}`);
  const enCurso = await http(con.token, 'POST', `/api/viajes/${viaje.id}/iniciar`);
  paso('Estado en_curso', enCurso.status === 200 && enCurso.json.data?.estado === 'en_curso', `HTTP ${enCurso.status}`);
  const fin = await http(con.token, 'POST', `/api/viajes/${viaje.id}/terminar`);
  paso('Estado finalizado por el conductor', fin.status === 200 && fin.json.data?.finalizado_por === 'conductor', `HTTP ${fin.status}`);
  const errorChat = esperar(sCon, 'error_message', (m) => String(m).includes('chat se cerró'), 5000);
  sCon.emit('send_message', { threadId, content: 'Gracias' });
  paso('Con el viaje terminado el chat queda en solo lectura (005, criterio 7)', Boolean(await errorChat));
  const calif = await http(pas.token, 'POST', `/api/viajes/${viaje.id}/calificar`, { estrellas: 5, comentario: 'Prueba de humo' });
  const otra = await http(pas.token, 'POST', `/api/viajes/${viaje.id}/calificar`, { estrellas: 1 });
  paso('El pasajero califica una sola vez (005, criterio 15)', calif.status === 200 && otra.status === 409, `HTTP ${calif.status}/${otra.status}`);
  const { data: trici } = await con.sb.from('tricimotos').select('estado').eq('conductor_id', con.id).single();
  paso('Al terminar, la tricimoto vuelve sola a disponible (R11)', trici?.estado === 'disponible', `estado=${trici?.estado}`);
  const despues = recibe(sPas, 'conductor_ubicacion');
  await guardarUbicacion(sCon, con, ubicacion);
  paso('Con el viaje finalizado, el pasajero deja de recibir la posición (criterio 15)', !await despues);

  // 5.4 Presupuesto de datos (criterio 27): 10 h con un envío de ubicación cada 5 s y 40 ofertas.
  const bytesUbicacion = bytesEvento('update_location', ubicacion);
  const ENVIOS = (10 * 3600) / 5;
  const OFERTAS = 40;
  // Margen x2 para cabeceras de WebSocket, TCP/TLS, pings de Socket.io y reintentos.
  const mb = ((bytesUbicacion * ENVIOS + bytesOferta * OFERTAS) * 2) / (1024 * 1024);
  paso('Proyección de ubicación y ofertas en 10 h por debajo de 15 MB (criterio 27)', mb < 15,
    `ubicación ${bytesUbicacion} B x ${ENVIOS} + oferta ${bytesOferta} B x ${OFERTAS}, x2 de margen = ${mb.toFixed(2)} MB`);

  // 5.5 Presupuesto del 004 (criterio 18): 10 h disponible en segundo plano. Peor caso de la
  // frecuencia adaptativa (en movimiento todo el día, cada UBICACION_FONDO_MOV_SEG), 40 ofertas
  // por socket con su aviso y su retirada, y los pings de Socket.io (cada 25 s, unos 10 B).
  const fondoMovSeg = disp.json.data?.ubicacion?.fondoMovSeg;
  const bytesAvisos = Buffer.byteLength(JSON.stringify(avisoOferta(oferta1, [TOKEN_PRUEBA], (id) => id)))
    + Buffer.byteLength(JSON.stringify(avisoRetirada(oferta1.viajeId, [TOKEN_PRUEBA])));
  const comun = { horas: 10, ofertas: OFERTAS, bytesOferta, bytesAvisos, pingSeg: 25, bytesPing: 10 };
  if (paso('El servidor entrega la frecuencia de envío en segundo plano (plan P12)', Number.isInteger(fondoMovSeg),
    `fondoMovSeg=${fondoMovSeg}`)) {
    const porSocket = proyeccionJornada({ ...comun, envioSeg: fondoMovSeg, bytesEnvio: bytesUbicacion });
    paso('Proyección de 10 h en segundo plano por debajo de 15 MB (criterio 18)', porSocket.mb < 15,
      `ubicación ${bytesUbicacion} B x ${porSocket.envios} + (oferta ${bytesOferta} B + avisos ${bytesAvisos} B) x ${OFERTAS} + pings x ${porSocket.pings}, x2 = ${porSocket.mb.toFixed(2)} MB`);
    const porRest = proyeccionJornada({ ...comun, envioSeg: fondoMovSeg, bytesEnvio: rest1.bytes });
    console.log(`      Referencia: si todos los envíos fueran por REST (${rest1.bytes} B cada uno) serían ${porRest.mb.toFixed(2)} MB`);
  }

  // Deja al conductor fuera del despacho.
  const fuera = await http(con.token, 'PATCH', '/api/conductores/disponibilidad', { disponible: false });
  paso('El conductor queda fuera del despacho al terminar', fuera.status === 200 && fuera.json.data?.estado === 'inactivo');
})().catch((e) => {
  console.error(`\nERROR: ${e.message}`);
  fallos += 1;
}).finally(async () => {
  // No dejar una oferta activa y al conductor disponible tras un fallo intermedio.
  if (pas && con) {
    // El token ficticio no debe quedar en la BD si el guion se cortó a mitad.
    for (const u of [pas, con]) {
      await http(u.token, 'DELETE', `/api/dispositivos/${encodeURIComponent(TOKEN_PRUEBA)}`).catch(() => {});
    }
  }
  if (pas && con && sockets.length) {
    try {
      await cerrarViajesDePrueba(pas, con, http);
      const fuera = await http(con.token, 'PATCH', '/api/conductores/disponibilidad', { disponible: false });
      if (fuera.status !== 200) throw new Error(`Disponibilidad HTTP ${fuera.status}`);
    } catch (error) {
      paso('Limpieza final', false, error.message);
    }
  }
  for (const socket of sockets) socket.close();
  console.log(fallos === 0 ? '\nPRUEBA DE HUMO: TODO OK' : `\nPRUEBA DE HUMO: ${fallos} fallo(s)`);
  process.exitCode = fallos === 0 ? 0 : 1;
});
