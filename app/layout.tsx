import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Chat App',
  description: 'Real-time chat application with voice and video calls',
  generator: 'v0.dev',
  icons: {
    icon: '/app_logo.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
