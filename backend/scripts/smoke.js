/**
 * Prueba de humo contra la BD y el backend reales (pasos 001 y 002).
 *
 * Recorre: consentimiento y registro -> el conductor sube fotos y cédula -> un
 * conductor SIN aprobar no puede aceptar un viaje -> el administrador revisa y
 * aprueba -> viaje de 3 pasajeros -> aceptación -> chat -> en_curso -> finalizado.
 *
 * Requisitos:
 *   - Backend corriendo (npm run dev) y backend/.env con SUPABASE_URL y SUPABASE_ANON_KEY.
 *   - TRES usuarios ya creados en Supabase Auth (email confirmado): pasajero, conductor y
 *     administrador (la cuenta admin se asigna con supabase/one-off/*_primer_admin.sql).
 *   - Credenciales por variables de entorno (no se guardan ni se imprimen):
 *       SMOKE_PASAJERO_EMAIL / SMOKE_PASAJERO_PASSWORD
 *       SMOKE_CONDUCTOR_EMAIL / SMOKE_CONDUCTOR_PASSWORD
 *       SMOKE_ADMIN_EMAIL / SMOKE_ADMIN_PASSWORD
 *   - Opcional: SMOKE_API (por defecto http://localhost:3000) y SMOKE_CEDULA (cédula válida de prueba).
 *
 * Deja en la BD un viaje finalizado, un conductor aprobado y 3 fotos de prueba en Storage.
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

const conectarSocket = (token) =>
  new Promise((resolve, reject) => {
    const s = io(API, { auth: { token }, transports: ['websocket'] });
    s.once('connect', () => resolve(s));
    s.once('connect_error', (e) => reject(new Error(`Socket: ${e.message}`)));
  });

(async () => {
  const pas = await login(process.env.SMOKE_PASAJERO_EMAIL, process.env.SMOKE_PASAJERO_PASSWORD);
  const con = await login(process.env.SMOKE_CONDUCTOR_EMAIL, process.env.SMOKE_CONDUCTOR_PASSWORD);
  const adm = await login(process.env.SMOKE_ADMIN_EMAIL, process.env.SMOKE_ADMIN_PASSWORD);
  paso('Login de pasajero, conductor y administrador', true);

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
  await asegurarPerfil(con, { rol: 'conductor', nombre: 'Conductor Prueba', telefono: '0990000002', placa: 'SMK-001' }, 'conductor');

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
    const cancel0 = await http(pas.token, 'PATCH', `/api/viajes/${viajeId}/estado`, { estado: 'cancelado' });
    paso('El pasajero cancela ese viaje de prueba', cancel0.status === 200, `HTTP ${cancel0.status}`);

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

  // 5. Viaje completo con el conductor ya aprobado
  const sol = await http(pas.token, 'POST', '/api/viajes/solicitar', {
    origen: { lat: -0.8699838, lng: -80.53995042 },
    destino: { lat: -0.80147852, lng: -80.52098189 },
    pasajeros: 3,
    sectorOrigenId: 'malecon',
    sectorDestinoId: 'la_boca',
    destinoDescripcion: 'Prueba de humo',
    tarifa: 99,
  });
  const viaje = sol.json.data;
  paso('Solicitud de viaje (3 pasajeros)', sol.status === 201 && viaje?.id, `HTTP ${sol.status}`);
  paso('Tarifa = 0,50 x 3 = 1,50 (ignora la enviada por el cliente)', Number(viaje?.tarifa) === 1.5, `tarifa=${viaje?.tarifa}`);
  if (!viaje?.id) throw new Error('Sin viaje, no se puede continuar.');

  const ace = await http(con.token, 'POST', '/api/viajes/aceptar', { viajeId: viaje.id });
  const threadId = ace.json.data?.chat?.threadId;
  paso('Aceptación por el conductor aprobado + hilo de chat', ace.status === 200 && !!threadId, `HTTP ${ace.status}`);
  if (!threadId) throw new Error('Sin hilo de chat, no se puede continuar.');

  const sPas = await conectarSocket(pas.token);
  const sCon = await conectarSocket(con.token);
  paso('Conexión de sockets autenticados', true);
  sPas.emit('join_chat', { threadId });
  sCon.emit('join_chat', { threadId });
  await new Promise((r) => setTimeout(r, 800));

  const recibido = new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), 5000);
    sPas.once('message_received', (m) => { clearTimeout(t); resolve(m); });
  });
  sCon.emit('send_message', { threadId, content: 'Voy en camino' });
  const msg = await recibido;
  paso('Mensaje del conductor llega al pasajero en tiempo real', msg?.content === 'Voy en camino');

  const hist = await http(pas.token, 'GET', `/api/chats/${threadId}/mensajes`);
  paso('Historial REST contiene el mensaje', hist.status === 200 && hist.json.data?.some((m) => m.content === 'Voy en camino'), `HTTP ${hist.status}`);
  sPas.close();
  sCon.close();

  const enCurso = await http(con.token, 'PATCH', `/api/viajes/${viaje.id}/estado`, { estado: 'en_curso' });
  paso('Estado en_curso', enCurso.status === 200, `HTTP ${enCurso.status}`);
  const fin = await http(pas.token, 'PATCH', `/api/viajes/${viaje.id}/estado`, { estado: 'finalizado' });
  paso('Estado finalizado', fin.status === 200, `HTTP ${fin.status}`);

  console.log(fallos === 0 ? '\nPRUEBA DE HUMO: TODO OK' : `\nPRUEBA DE HUMO: ${fallos} fallo(s)`);
  process.exit(fallos === 0 ? 0 : 1);
})().catch((e) => {
  console.error(`\nERROR: ${e.message}`);
  process.exit(1);
});
