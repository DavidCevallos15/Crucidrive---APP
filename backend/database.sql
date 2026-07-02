-- Script de Inicialización de Base de Datos para CruciDrive (Supabase PostgreSQL + PostGIS)
-- Este script crea las tablas, habilitación de PostGIS, índices y políticas RLS necesarias.

-- 1. Habilitar la extensión de geolocalización PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Crear Tabla: public.perfiles
CREATE TABLE IF NOT EXISTS public.perfiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  rol VARCHAR NOT NULL CHECK (rol IN ('pasajero', 'conductor', 'admin')),
  nombre VARCHAR NOT NULL,
  telefono VARCHAR UNIQUE NOT NULL,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS en perfiles
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;

-- Políticas para perfiles
CREATE POLICY "Permitir lectura de perfiles a todos los autenticados" ON public.perfiles
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Permitir inserción de perfil propio a usuarios autenticados" ON public.perfiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Permitir actualización de perfil propio" ON public.perfiles
  FOR UPDATE USING (auth.uid() = id);

-- 3. Crear Tabla: public.tricimotos
CREATE TABLE IF NOT EXISTS public.tricimotos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conductor_id UUID UNIQUE NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  placa VARCHAR UNIQUE NOT NULL,
  estado VARCHAR NOT NULL CHECK (estado IN ('disponible', 'ocupado', 'inactivo')) DEFAULT 'inactivo',
  ubicacion_actual GEOGRAPHY(POINT, 4326),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS en tricimotos
ALTER TABLE public.tricimotos ENABLE ROW LEVEL SECURITY;

-- Políticas para tricimotos
CREATE POLICY "Permitir lectura de tricimotos a todos los autenticados" ON public.tricimotos
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Permitir actualización de tricimoto a su propio conductor" ON public.tricimotos
  FOR UPDATE USING (auth.uid() = conductor_id);

CREATE POLICY "Permitir inserción de tricimoto al conductor propio" ON public.tricimotos
  FOR INSERT WITH CHECK (auth.uid() = conductor_id);

-- 4. Crear Tabla: public.viajes
CREATE TABLE IF NOT EXISTS public.viajes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pasajero_id UUID REFERENCES public.perfiles(id) ON DELETE SET NULL,
  conductor_id UUID REFERENCES public.perfiles(id) ON DELETE SET NULL,
  origen GEOGRAPHY(POINT, 4326) NOT NULL,
  destino GEOGRAPHY(POINT, 4326) NOT NULL,
  estado VARCHAR NOT NULL CHECK (estado IN ('solicitado', 'aceptado', 'en_curso', 'finalizado', 'cancelado')) DEFAULT 'solicitado',
  tarifa DECIMAL(5,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS en viajes
ALTER TABLE public.viajes ENABLE ROW LEVEL SECURITY;

-- Políticas para viajes
CREATE POLICY "Permitir lectura de viajes propios (pasajero o conductor)" ON public.viajes
  FOR SELECT USING (auth.uid() = pasajero_id OR auth.uid() = conductor_id);

CREATE POLICY "Permitir crear viaje a pasajeros" ON public.viajes
  FOR INSERT WITH CHECK (auth.uid() = pasajero_id);

CREATE POLICY "Permitir actualizar viaje a involucrados" ON public.viajes
  FOR UPDATE USING (auth.uid() = pasajero_id OR auth.uid() = conductor_id);

-- 5. Crear Tabla: public.threads (Hilos de chat)
CREATE TABLE IF NOT EXISTS public.threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  viaje_id UUID UNIQUE REFERENCES public.viajes(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS en threads
ALTER TABLE public.threads ENABLE ROW LEVEL SECURITY;

-- 6. Crear Tabla: public.thread_members (Miembros de chat)
CREATE TABLE IF NOT EXISTS public.thread_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.perfiles(id) ON DELETE CASCADE,
  UNIQUE(thread_id, user_id)
);

-- Habilitar RLS en thread_members
ALTER TABLE public.thread_members ENABLE ROW LEVEL SECURITY;

-- Políticas de lectura en threads y miembros
CREATE POLICY "Permitir lectura de miembros a integrantes" ON public.thread_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.thread_members tm
      WHERE tm.thread_id = thread_members.thread_id AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Permitir lectura de threads a miembros" ON public.threads
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.thread_members tm
      WHERE tm.thread_id = threads.id AND tm.user_id = auth.uid()
    )
  );

-- 7. Crear Tabla: public.messages
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.perfiles(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS en messages
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Políticas para messages (lectura e inserción)
CREATE POLICY "Permitir lectura de mensajes a miembros del hilo" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.thread_members 
      WHERE thread_members.thread_id = messages.thread_id 
      AND thread_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Permitir inserción de mensajes a miembros del hilo" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.thread_members 
      WHERE thread_members.thread_id = messages.thread_id 
      AND thread_members.user_id = auth.uid()
    )
  );

-- 8. Crear Índices para Optimización
CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON public.messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_thread_members_thread_id ON public.thread_members(thread_id);
CREATE INDEX IF NOT EXISTS idx_thread_members_user_id ON public.thread_members(user_id);
CREATE INDEX IF NOT EXISTS idx_threads_viaje_id ON public.threads(viaje_id);
CREATE INDEX IF NOT EXISTS idx_tricimotos_conductor_id ON public.tricimotos(conductor_id);
CREATE INDEX IF NOT EXISTS idx_viajes_pasajero ON public.viajes(pasajero_id);
CREATE INDEX IF NOT EXISTS idx_viajes_conductor ON public.viajes(conductor_id);
