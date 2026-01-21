import Link from "next/link";
import { WalletConnectButton } from "./WalletConnectButton";

export function NavBar() {
  return (
    <header className="border-b border-zinc-800 bg-black/30 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-sm font-semibold text-zinc-100">
            PROOFRAIL
          </Link>
          <nav className="flex items-center gap-4 text-sm text-zinc-300">
            <Link href="/deposit" className="hover:text-zinc-100">
              Vault
            </Link>
            <Link href="/jobs" className="hover:text-zinc-100">
              Jobs
            </Link>
          </nav>
        </div>
        <WalletConnectButton />
      </div>
    </header>
  );
}

