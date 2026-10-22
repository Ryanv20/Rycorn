import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Rycorn Port Console · Port of Los Angeles',
  description: 'Port of Los Angeles vessel and cargo operations powered by the Rycon simulation API.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>
}
