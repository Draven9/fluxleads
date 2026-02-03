import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ServiceWorkerRegister } from '@/components/pwa/ServiceWorkerRegister'
import { InstallBanner } from '@/components/pwa/InstallBanner'

import { Toaster } from 'react-hot-toast'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'Flux Leads',
  description: 'CRM Inteligente para Gestão de Vendas',
  icons: {
    icon: '/icons/logo-icon.png',
    shortcut: '/icons/logo-icon.png',
    apple: '/icons/logo-icon.png',
  },
}

/**
 * Componente React `RootLayout`.
 *
 * @param {{ children: ReactNode; }} {
  children,
} - Parâmetro `{
  children,
}`.
 * @returns {Element} Retorna um valor do tipo `Element`.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased bg-[var(--color-bg)] text-[var(--color-text-primary)]`}>
        <ServiceWorkerRegister />
        <InstallBanner />
        <Toaster position="top-right" toastOptions={{
          style: {
            background: '#1e293b', // dark-slate-800
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.1)',
          },
          duration: 4000
        }} />
        {children}
      </body>
    </html>
  )
}
