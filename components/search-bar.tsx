'use client'

import { Search, User } from 'lucide-react'

export default function SearchBar() {
  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-[1000] flex items-center gap-3 p-4 pt-[calc(env(safe-area-inset-top)+16px)]">
      <div className="glass pointer-events-auto flex h-13 flex-1 items-center gap-3 rounded-full px-5">
        <Search className="size-5 shrink-0 text-primary-light" aria-hidden="true" />
        <input
          type="text"
          placeholder="¿A dónde vas?"
          defaultValue="Malecón de Crucita"
          className="w-full bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
          aria-label="Buscar destino"
        />
      </div>
      <button
        type="button"
        className="glass press pointer-events-auto flex size-13 shrink-0 items-center justify-center rounded-full"
        aria-label="Perfil de usuario"
      >
        <User className="size-5 text-foreground" aria-hidden="true" />
      </button>
    </header>
  )
}
