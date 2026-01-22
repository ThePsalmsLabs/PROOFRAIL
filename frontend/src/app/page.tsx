'use client'

import Link from 'next/link'
import { Container } from '@/components/layout/Container'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { WalletInfo } from '@/components/wallet/WalletInfo'
import { useWallet } from '@/components/WalletProvider'
import { Zap, Shield, Rocket, ArrowRight, CheckCircle } from 'lucide-react'

export default function Home() {
  const { address } = useWallet()

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-50 via-white to-bitcoin-50 dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-950 py-20">
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        <Container>
          <div className="relative z-10 text-center space-y-8 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 text-sm font-medium mb-4">
              <Zap className="h-4 w-4" />
              Payment Rails for AI Agents on Bitcoin L2
            </div>
            
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
              PROOFRAIL
            </h1>
            
            <p className="text-xl text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto">
              Automate DeFi operations with AI agents. Deposit, create jobs, and execute complex workflows on Stacks.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/vault">
                <Button size="lg" className="w-full sm:w-auto">
                  Get Started
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
              <Link href="/jobs">
                <Button variant="outline" size="lg" className="w-full sm:w-auto">
                  View Jobs
                </Button>
              </Link>
            </div>
          </div>
        </Container>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white dark:bg-neutral-900">
        <Container>
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-neutral-900 dark:text-neutral-50 mb-4">
              How It Works
            </h2>
            <p className="text-lg text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto">
              Simple, secure, and automated DeFi execution
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card variant="elevated" hoverable>
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center mb-4">
                  <Shield className="h-6 w-6 text-brand-600 dark:text-brand-400" />
                </div>
                <CardTitle>1. Deposit</CardTitle>
                <CardDescription>
                  Add USDCx to your vault. Funds are locked securely until job execution.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card variant="elevated" hoverable>
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center mb-4">
                  <Zap className="h-6 w-6 text-brand-600 dark:text-brand-400" />
                </div>
                <CardTitle>2. Create Job</CardTitle>
                <CardDescription>
                  Define your DeFi task with parameters. Assign an agent to execute it.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card variant="elevated" hoverable>
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center mb-4">
                  <Rocket className="h-6 w-6 text-brand-600 dark:text-brand-400" />
                </div>
                <CardTitle>3. Execute</CardTitle>
                <CardDescription>
                  Agents execute jobs automatically. You get verifiable receipts and results.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </Container>
      </section>

      {/* Features Grid */}
      <section className="py-20 bg-neutral-50 dark:bg-neutral-950">
        <Container>
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-neutral-900 dark:text-neutral-50 mb-4">
              Features
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { title: 'Secure Vault', desc: 'Funds locked until execution' },
              { title: 'Multi-Protocol', desc: 'Support for ALEX and more' },
              { title: 'Verifiable Receipts', desc: 'On-chain proof of execution' },
              { title: 'Agent Marketplace', desc: 'Connect with AI agents' },
              { title: 'Gas Efficient', desc: 'Optimized for Stacks' },
              { title: 'Open Source', desc: 'Transparent and auditable' },
            ].map((feature, i) => (
              <Card key={i} variant="default">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-brand-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold text-neutral-900 dark:text-neutral-50 mb-1">
                        {feature.title}
                      </h3>
                      <p className="text-sm text-neutral-600 dark:text-neutral-400">
                        {feature.desc}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </Container>
      </section>

      {/* Wallet Info Section */}
      {address && (
        <section className="py-20 bg-white dark:bg-neutral-900">
          <Container>
            <div className="max-w-2xl mx-auto">
              <WalletInfo />
            </div>
          </Container>
        </section>
      )}

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-brand-500 to-brand-700 text-white">
        <Container>
          <div className="text-center space-y-6 max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold">
              Ready to Get Started?
            </h2>
            <p className="text-xl text-brand-100">
              Connect your wallet and start automating DeFi operations today.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/vault">
                <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                  Go to Vault
                </Button>
              </Link>
              <Link href="/jobs/create">
                <Button size="lg" variant="outline" className="w-full sm:w-auto border-white text-white hover:bg-white/10">
                  Create Job
                </Button>
              </Link>
            </div>
          </div>
        </Container>
      </section>
    </div>
  )
}
