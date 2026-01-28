import Link from 'next/link'
import { Container } from './Container'
import { Github, Twitter } from 'lucide-react'

export function Footer() {
  return (
    <footer className="border-t border-neutral-200 dark:border-neutral-800 mt-20">
      <Container className="py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-4">
            <h3 className="font-semibold text-neutral-900 dark:text-neutral-50">
              PROOFRAIL
            </h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Payment rails for AI agents on Bitcoin L2
            </p>
          </div>

          <div>
            <h4 className="font-medium text-neutral-900 dark:text-neutral-50 mb-4">
              Product
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/vault" className="text-neutral-600 dark:text-neutral-400 hover:text-brand-500">
                  Vault
                </Link>
              </li>
              <li>
                <Link href="/jobs" className="text-neutral-600 dark:text-neutral-400 hover:text-brand-500">
                  Jobs
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-medium text-neutral-900 dark:text-neutral-50 mb-4">
              Resources
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/docs" className="text-neutral-600 dark:text-neutral-400 hover:text-brand-500">
                  Documentation
                </Link>
              </li>
              <li>
                <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-neutral-600 dark:text-neutral-400 hover:text-brand-500">
                  GitHub
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-medium text-neutral-900 dark:text-neutral-50 mb-4">
              Connect
            </h4>
            <div className="flex gap-4">
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-neutral-600 dark:text-neutral-400 hover:text-brand-500"
              >
                <Github className="h-5 w-5" />
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-neutral-600 dark:text-neutral-400 hover:text-brand-500"
              >
                <Twitter className="h-5 w-5" />
              </a>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-neutral-200 dark:border-neutral-800 text-center text-sm text-neutral-500">
          <p>&copy; {new Date().getFullYear()} PROOFRAIL. Built on Stacks.</p>
        </div>
      </Container>
    </footer>
  )
}
