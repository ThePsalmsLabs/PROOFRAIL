import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { NavBar } from "@/components/NavBar";
import { Footer } from "@/components/layout/Footer";
import { WalletProvider } from "@/components/WalletProvider";
import { Toaster } from "sonner";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "PROOFRAIL - Payment Rails for AI Agents",
  description: "Automate DeFi operations with AI agents on Stacks. Deposit, create jobs, and execute complex workflows.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} min-h-screen bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-50 antialiased font-sans`}
      >
        <WalletProvider>
          <NavBar />
          <main>{children}</main>
          <Footer />
          <Toaster position="top-right" richColors />
        </WalletProvider>
      </body>
    </html>
  );
}
