import type { Metadata, Viewport } from 'next'
import { Outfit } from 'next/font/google'
import './globals.css'

const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' })

export const metadata: Metadata = {
  title: 'CruciDrive — Transporte en Crucita',
  description:
    'Sistema hiperlocal de transporte y geolocalización en tiempo real para Crucita, Ecuador.',
}

export const viewport: Viewport = {
  themeColor: '#0b0f19',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className={`bg-background ${outfit.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
