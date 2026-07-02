'use client'

import dynamic from 'next/dynamic'
import SearchBar from '@/components/search-bar'
import TripSheet from '@/components/trip-sheet'

const MapView = dynamic(() => import('@/components/map-view'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-background">
      <span className="text-sm text-muted-foreground">Cargando mapa…</span>
    </div>
  ),
})

export default function PassengerMapPage() {
  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <MapView />
      <SearchBar />
      <TripSheet />
    </main>
  )
}
