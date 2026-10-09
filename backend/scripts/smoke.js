/**
 * Prueba de humo contra la BD y el backend reales (pasos 001, 002 y 003).
 *
 * Recorre: consentimiento y registro -> el conductor sube fotos y cédula -> un
 * conductor SIN aprobar no puede aceptar un viaje -> el administrador revisa y
 * aprueba -> despacho (003): disponibilidad -> oferta al conductor conectado ->
 * rechazo -> "sin conductor" -> nueva solicitud -> aceptación con chat -> en_curso ->
 * finalizado -> la tricimoto vuelve a disponible. Mide los bytes de la oferta y de cada
 * envío de ubicación y proyecta una jornada de 10 h (criterio 27).
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
 * al empezar.
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { io } = require('socket.io-client');

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
    });
  } catch (e) {
    throw new Error(`No se pudo conectar con ${API} (${e.cause?.code || e.message}). ¿Está corriendo "npm run dev" en otra terminal?`);
  }
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
};

// El servidor envía hora_servidor al conectar: se escucha desde antes para no perderla y
// se guarda el desfase de reloj medido en ese momento (plan R14).
const conectarSocket = (token) =>
  new Promise((resolve, reject) => {
    const s = io(API, { auth: { token }, transports: ['websocket'] });
    s.once('hora_servidor', ({ ahora }) => { s.desfaseMs = ahora - Date.now(); });
    s.once('connect', () => resolve(s));
    s.once('connect_error', (e) => reject(new Error(`Socket: ${e.message}`)));
  });

/** Espera un evento del socket que cumpla `filtro`; null si no llega a tiempo. */
const esperar = (socket, evento, filtro = () => true, ms = 8000) =>
  new Promise((resolve) => {
    const alRecibir = (datos) => {
      if (!filtro(datos)) return;
      clearTimeout(t);
      socket.off(evento, alRecibir);
      resolve(datos);
    };
    const t = setTimeout(() => {
      socket.off(evento, alRecibir);
      resolve(null);
    }, ms);
    socket.on(evento, alRecibir);
  });

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/** Bytes de un evento como viaja por Socket.io: `42["evento",{...}]`. */
const bytesEvento = (evento, datos) => Buffer.byteLength(`42${JSON.stringify([evento, datos])}`);

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
  const pas = await login(process.env.SMOKE_PASAJERO_EMAIL, process.env.SMOKE_PASAJERO_PASSWORD);
  const con = await login(process.env.SMOKE_CONDUCTOR_EMAIL, process.env.SMOKE_CONDUCTOR_PASSWORD);
  const adm = await login(process.env.SMOKE_ADMIN_EMAIL, process.env.SMOKE_ADMIN_PASSWORD);
  paso('Login de pasajero, conductor y administrador', true);

  // 0. Limpieza: viajes activos de corridas anteriores (un viaje activo por pasajero, criterio 13).
  for (const u of [pas, con]) {
    const { data: activos } = await u.sb.from('viajes').select('id, estado')
      .or(`pasajero_id.eq.${u.id},conductor_id.eq.${u.id}`).in('estado', ['solicitado', 'aceptado', 'en_curso']);
    for (const v of activos || []) {
      if (v.estado === 'en_curso') {
        await http(u.token, 'PATCH', `/api/viajes/${v.id}/estado`, { estado: 'finalizado' });
      } else {
        await http(u.token, 'PATCH', `/api/viajes/${v.id}/estado`, { estado: 'cancelado' });
      }
    }
    if (activos?.length) paso(`Se cerraron ${activos.length} viaje(s) activo(s) de corridas anteriores`, true);
  }

  const { data: perfilAdmin } = await adm.sb.from('perfiles').select('rol').eq('id', adm.id).maybeSingle();
  paso('La cuenta de administrador tiene rol admin', perfilAdmin?.rol === 'admin', `rol=${perfilAdmin?.rol}`);

  // 1. Registro con consentimiento (se omite si el perfil ya existe)
  const asegurarPerfil = async (u, cuerpo, etiqueta) => {
    const { data } = await u.sb.from('perfiles').select('rol').eq('id', u.id).maybeSingle();
    if (data) return paso(`Perfil de ${etiqueta} ya existe`, data.rol === cuerpo.rol, `rol=${data.rol}`);
    const sinConsentimiento = await http(u.token, 'POST', '/api/auth/registro', { ...cuerpo, consentimiento: false });
    paso(`Registro de ${etiqueta} sin consentimiento es rechazado`, sinConsentimiento.status === 400, `HTTP ${sinConsentimiento.status}`);
    const r = await http(u.token, 'POST', '/api/auth/registro', { ...cuerpo, consentimiento: true });
    return paso(`Registro de ${etiqueta} con consentimiento`, r.status === 201, `HTTP ${r.status}`);
  };
  await asegurarPerfil(pas, { rol: 'pasajero', nombre: 'Pasajero Prueba', telefono: '0990000001' }, 'pasajero');
  await asegurarPerfil(con, { rol: 'conductor', nombre: 'Conductor Prueba', telefono: '0990000003', placa: 'SMK-001' }, 'conductor');

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
    });
    viajeId = sol0.json.data?.id;
    const intento = await http(con.token, 'POST', '/api/viajes/aceptar', { viajeId });
    paso('Un conductor sin aprobar NO puede aceptar un viaje', intento.status >= 400, `HTTP ${intento.status}`);
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
      const foto = await fetch(urlFoto);
      paso('El enlace firmado descarga la foto de la cédula', foto.ok, `HTTP ${foto.status}`);
    }
    const aprobada = await http(adm.token, 'POST', `/api/admin/conductores/${con.id}/aprobar`);
    paso('El administrador aprueba al conductor', aprobada.status === 200, `HTTP ${aprobada.status}`);
  }

  // 5. Despacho (paso 003)
  const sCon = await conectarSocket(con.token);
  const sPas = await conectarSocket(pas.token);
  await dormir(500);
  paso('Sockets autenticados; el servidor envía su hora (R14)', Number.isFinite(sCon.desfaseMs),
    Number.isFinite(sCon.desfaseMs) ? `desfase=${sCon.desfaseMs} ms` : 'sin hora_servidor');

  const noDisp = await http(con.token, 'PATCH', '/api/conductores/disponibilidad', { disponible: false });
  const disp = await http(con.token, 'PATCH', '/api/conductores/disponibilidad', { disponible: true });
  paso('El conductor cambia su disponibilidad en el servidor (criterio 1)',
    noDisp.status === 200 && disp.status === 200 && disp.json.data?.estado === 'disponible',
    `HTTP ${noDisp.status}/${disp.status}, estado=${disp.json.data?.estado}`);

  // Ubicación reciente: sin ella no es candidato (criterio 2).
  const ubicacion = { sectorId: 'malecon', coords: MALECON };
  sCon.emit('update_location', ubicacion);
  await dormir(1000);

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
  if (!oferta1) throw new Error('Sin oferta, no se puede continuar.');

  const bytesOferta = bytesEvento('oferta_viaje', oferta1);
  const prohibidas = ['telefono', 'nombre', 'pasajeroNombre', 'pasajero_id', 'lat', 'lng', 'coords'];
  const conDatosPersonales = JSON.stringify(oferta1).match(new RegExp(`"(${prohibidas.join('|')})"`, 'g'));
  paso('La oferta pesa menos de 2 KB y no trae datos del pasajero (criterios 15 y 27)',
    bytesOferta < 2048 && !conDatosPersonales, `${bytesOferta} B${conDatosPersonales ? `, trae ${conDatosPersonales}` : ''}`);
  const quedan = Math.round((oferta1.venceEn - (Date.now() + (sCon.desfaseMs || 0))) / 1000);
  paso('La oferta vence en unos 15 s según el servidor (R14)', quedan >= 10 && quedan <= 16, `quedan ${quedan} s`);

  const sinConductor = esperar(sPas, 'viaje_sin_conductor', (d) => d.viajeId === viaje1.id, 10000);
  sCon.emit('rechazar_oferta', { viajeId: viaje1.id });
  const avisoSin = await sinConductor;
  paso('Tras el rechazo, sin más candidatos, el pasajero recibe "sin conductor" (criterios 6 y 11)', !!avisoSin);
  const { data: fila1 } = await pas.sb.from('viajes').select('estado').eq('id', viaje1.id).single();
  paso('El viaje queda como sin_conductor en la BD', fila1?.estado === 'sin_conductor', `estado=${fila1?.estado}`);

  // 5.2 Nueva solicitud ("Volver a pedir") aceptada
  sCon.emit('update_location', ubicacion);
  await dormir(1000);
  const ofertaB = esperar(sCon, 'oferta_viaje');
  const sol2 = await http(pas.token, 'POST', '/api/viajes/solicitar', SOLICITUD);
  const viaje = sol2.json.data;
  paso('Volver a pedir crea una solicitud nueva', sol2.status === 201 && viaje?.id, `HTTP ${sol2.status}`);
  if (!viaje?.id) throw new Error('Sin viaje, no se puede continuar.');
  const oferta2 = await ofertaB;
  paso('El mismo conductor recibe la nueva oferta', oferta2?.viajeId === viaje.id);

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

  const enCurso = await http(con.token, 'PATCH', `/api/viajes/${viaje.id}/estado`, { estado: 'en_curso' });
  paso('Estado en_curso', enCurso.status === 200, `HTTP ${enCurso.status}`);
  const fin = await http(pas.token, 'PATCH', `/api/viajes/${viaje.id}/estado`, { estado: 'finalizado' });
  paso('Estado finalizado', fin.status === 200, `HTTP ${fin.status}`);
  const { data: trici } = await con.sb.from('tricimotos').select('estado').eq('conductor_id', con.id).single();
  paso('Al terminar, la tricimoto vuelve sola a disponible (R11)', trici?.estado === 'disponible', `estado=${trici?.estado}`);

  // 5.4 Presupuesto de datos (criterio 27): 10 h con un envío de ubicación cada 5 s y 40 ofertas.
  const bytesUbicacion = bytesEvento('update_location', ubicacion);
  const ENVIOS = (10 * 3600) / 5;
  const OFERTAS = 40;
  // Margen x2 para cabeceras de WebSocket, TCP/TLS, pings de Socket.io y reintentos.
  const mb = ((bytesUbicacion * ENVIOS + bytesOferta * OFERTAS) * 2) / (1024 * 1024);
  paso('Jornada de 10 h por debajo de 15 MB (criterio 27)', mb < 15,
    `ubicación ${bytesUbicacion} B x ${ENVIOS} + oferta ${bytesOferta} B x ${OFERTAS}, x2 de margen = ${mb.toFixed(2)} MB`);

  // Deja al conductor fuera del despacho.
  await http(con.token, 'PATCH', '/api/conductores/disponibilidad', { disponible: false });
  sPas.close();
  sCon.close();

  console.log(fallos === 0 ? '\nPRUEBA DE HUMO: TODO OK' : `\nPRUEBA DE HUMO: ${fallos} fallo(s)`);
  process.exit(fallos === 0 ? 0 : 1);
})().catch((e) => {
  console.error(`\nERROR: ${e.message}`);
  process.exit(1);
});
