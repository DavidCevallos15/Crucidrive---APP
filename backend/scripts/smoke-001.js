/**
 * Prueba de humo del paso 001 (T16) contra la BD y el backend reales.
 *
 * Recorre: registro de perfiles -> solicitud (3 pasajeros) -> aceptación ->
 * chat por socket + historial REST -> en_curso -> finalizado.
 *
 * Requisitos:
 *   - Backend corriendo (npm run dev) y backend/.env con SUPABASE_URL y SUPABASE_ANON_KEY.
 *   - Dos usuarios ya creados en Supabase Auth (email confirmado).
 *   - Credenciales por variables de entorno (no se guardan ni se imprimen):
 *       SMOKE_PASAJERO_EMAIL, SMOKE_PASAJERO_PASSWORD,
 *       SMOKE_CONDUCTOR_EMAIL, SMOKE_CONDUCTOR_PASSWORD
 *   - Opcional: SMOKE_API (por defecto http://localhost:3000).
 *
 * Deja en la BD un viaje finalizado de 3 pasajeros y los perfiles creados.
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { io } = require('socket.io-client');

const API = process.env.SMOKE_API || 'http://localhost:3000';
const requeridas = [
  'SUPABASE_URL', 'SUPABASE_ANON_KEY',
  'SMOKE_PASAJERO_EMAIL', 'SMOKE_PASAJERO_PASSWORD',
  'SMOKE_CONDUCTOR_EMAIL', 'SMOKE_CONDUCTOR_PASSWORD',
];
const faltan = requeridas.filter((k) => !process.env[k]);
if (faltan.length) {
  console.error(`Faltan variables de entorno: ${faltan.join(', ')}`);
  process.exit(2);
}

let fallos = 0;
const paso = (nombre, ok, detalle = '') => {
  if (!ok) fallos += 1;
  console.log(`${ok ? 'OK   ' : 'FALLO'} ${nombre}${detalle ? ` — ${detalle}` : ''}`);
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
  paso('Login de pasajero y conductor', true);

  // 1. Registro de perfiles (se omite si ya existen)
  const asegurarPerfil = async (u, cuerpo, etiqueta) => {
    const { data } = await u.sb.from('perfiles').select('rol').eq('id', u.id).maybeSingle();
    if (data) return paso(`Perfil de ${etiqueta} ya existe`, data.rol === cuerpo.rol, `rol=${data.rol}`);
    const r = await http(u.token, 'POST', '/api/auth/registro', cuerpo);
    return paso(`Registro de ${etiqueta}`, r.status === 201, `HTTP ${r.status}`);
  };
  await asegurarPerfil(pas, { rol: 'pasajero', nombre: 'Pasajero Prueba', telefono: '0990000001' }, 'pasajero');
  await asegurarPerfil(con, { rol: 'conductor', nombre: 'Conductor Prueba', telefono: '0990000002', placa: 'SMK-001' }, 'conductor');

  // 2. Solicitud: 3 pasajeros => 1,50 USD calculado por la BD (se intenta colar otra tarifa)
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

  // 3. Aceptación por el conductor
  const ace = await http(con.token, 'POST', '/api/viajes/aceptar', { viajeId: viaje.id });
  const threadId = ace.json.data?.chat?.threadId;
  paso('Aceptación por el conductor + hilo de chat', ace.status === 200 && !!threadId, `HTTP ${ace.status}`);
  if (!threadId) throw new Error('Sin hilo de chat, no se puede continuar.');

  // 4. Chat por socket
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

  // 5. Estados
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
