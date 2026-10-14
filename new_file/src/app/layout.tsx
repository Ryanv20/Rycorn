import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Rycon Port Operations · Los Angeles',
  description: 'A single-port operations console powered by the Rycon simulation engine.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>
}
