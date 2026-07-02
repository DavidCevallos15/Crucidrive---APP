'use client'

import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet'
import L from 'leaflet'

// Crucita, Manabí, Ecuador
export const CRUCITA_CENTER: [number, number] = [-0.8683, -80.5357]
export const PICKUP: [number, number] = [-0.8695, -80.5368]
export const DESTINATION: [number, number] = [-0.8612, -80.5312]

const pickupIcon = L.divIcon({
  className: 'marker-pin',
  html: `<div style="width:20px;height:20px;border-radius:9999px;background:#14B8A6;border:3px solid #F1F5F9;box-shadow:0 0 0 6px rgba(20,184,166,0.25)"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
})

const destinationIcon = L.divIcon({
  className: 'marker-pin',
  html: `<svg width="34" height="42" viewBox="0 0 34 42" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M17 0C7.6 0 0 7.6 0 17c0 12.75 17 25 17 25s17-12.25 17-25C34 7.6 26.4 0 17 0z" fill="#F59E0B"/>
    <circle cx="17" cy="17" r="7" fill="#0B0F19"/>
  </svg>`,
  iconSize: [34, 42],
  iconAnchor: [17, 42],
})

const driverIcon = L.divIcon({
  className: 'marker-pin',
  html: `<div style="width:32px;height:32px;border-radius:9999px;background:rgba(13,148,136,0.9);border:2px solid rgba(255,255,255,0.7);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F1F5F9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
  </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
})

const DRIVERS: [number, number][] = [
  [-0.8656, -80.5341],
  [-0.8721, -80.5382],
  [-0.8638, -80.5399],
]

const ROUTE: [number, number][] = [
  PICKUP,
  [-0.8681, -80.5352],
  [-0.8662, -80.5338],
  [-0.8639, -80.5327],
  DESTINATION,
]

export default function MapView() {
  return (
    <MapContainer
      center={CRUCITA_CENTER}
      zoom={15}
      zoomControl={false}
      attributionControl={true}
      className="h-full w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      <Polyline
        positions={ROUTE}
        pathOptions={{
          color: '#14B8A6',
          weight: 4,
          opacity: 0.85,
          dashArray: '1 8',
          lineCap: 'round',
        }}
      />
      <Marker position={PICKUP} icon={pickupIcon} />
      <Marker position={DESTINATION} icon={destinationIcon} />
      {DRIVERS.map((pos, i) => (
        <Marker key={i} position={pos} icon={driverIcon} />
      ))}
    </MapContainer>
  )
}
