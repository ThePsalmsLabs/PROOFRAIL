'use client'

import Link from 'next/link'
import { WalletConnectButton } from './WalletConnectButton'
import { Container } from './layout/Container'
import { Menu, X } from 'lucide-react'
import { useState } from 'react'

export function NavBar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-950/80 backdrop-blur-lg">
      <Container>
        <div className="flex items-center justify-between py-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
              <span className="text-white font-bold text-sm">P</span>
            </div>
            <span className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
              PROOFRAIL
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            <Link
              href="/vault"
              className="text-neutral-600 dark:text-neutral-400 hover:text-brand-500 transition-colors"
            >
              Vault
            </Link>
            <Link
              href="/jobs"
              className="text-neutral-600 dark:text-neutral-400 hover:text-brand-500 transition-colors"
            >
              Jobs
            </Link>
            <Link
              href="/docs"
              className="text-neutral-600 dark:text-neutral-400 hover:text-brand-500 transition-colors"
            >
              Docs
            </Link>
          </nav>

          {/* Wallet Button (Desktop) */}
          <div className="hidden md:block">
            <WalletConnectButton />
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-neutral-600 dark:text-neutral-400 hover:text-brand-500"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden pb-4 space-y-4 animate-slide-down">
            <nav className="flex flex-col gap-3 text-sm font-medium">
              <Link
                href="/vault"
                className="text-neutral-600 dark:text-neutral-400 hover:text-brand-500 py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Vault
              </Link>
              <Link
                href="/jobs"
                className="text-neutral-600 dark:text-neutral-400 hover:text-brand-500 py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Jobs
              </Link>
              <Link
                href="/docs"
                className="text-neutral-600 dark:text-neutral-400 hover:text-brand-500 py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Docs
              </Link>
            </nav>
            <WalletConnectButton />
          </div>
        )}
      </Container>
    </header>
  )
}
