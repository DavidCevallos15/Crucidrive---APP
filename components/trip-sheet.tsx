'use client'

import { MapPin, Navigation, Clock, Wallet } from 'lucide-react'
import SosButton from './sos-button'

export default function TripSheet() {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1000]">
      {/* SOS flotante sobre la ficha */}
      <div className="pointer-events-auto mb-4 flex justify-end px-4">
        <SosButton />
      </div>

      <section
        aria-label="Información del viaje"
        className="glass-strong pointer-events-auto rounded-t-3xl px-5 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-3"
      >
        {/* Asa del bottom sheet */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-glass-border" aria-hidden="true" />

        {/* Origen y destino */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Navigation className="size-4 shrink-0 text-primary-light" aria-hidden="true" />
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Origen</span>
              <span className="text-sm font-medium">Tu ubicación actual</span>
            </div>
          </div>
          <div className="ml-2 h-4 w-px border-l border-dashed border-glass-border" aria-hidden="true" />
          <div className="flex items-center gap-3">
            <MapPin className="size-4 shrink-0 text-secondary" aria-hidden="true" />
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Destino</span>
              <span className="text-sm font-medium">Malecón de Crucita</span>
            </div>
          </div>
        </div>

        {/* Tarifa y detalles */}
        <div className="mt-5 flex items-center justify-between rounded-2xl border border-glass-border bg-glass p-4">
          <div className="flex flex-col">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Wallet className="size-3.5" aria-hidden="true" />
              Tarifa estimada
            </span>
            <span className="text-2xl font-bold text-foreground">$1.50</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="size-3.5" aria-hidden="true" />
              Llegada
            </span>
            <span className="text-lg font-semibold text-primary-light">6 min</span>
          </div>
        </div>

        {/* Botón de acción */}
        <button
          type="button"
          className="press mt-4 w-full rounded-full bg-secondary py-4 text-base font-bold text-[#0F172A] shadow-lg shadow-secondary/30"
        >
          Solicitar viaje
        </button>
      </section>
    </div>
  )
}
