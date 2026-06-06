import type { Metadata } from "next";
import "./globals.css";
import { NavBar } from "@/components/NavBar";

export const metadata: Metadata = {
  title: "Kirana Recon — Paytm",
  description: "Reconcile UPI payments to invoices for Kirana stores",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <NavBar />
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-6">{children}</main>
        <footer className="text-center text-xs text-slate-400 py-6">
          Kirana Recon · UPI reconciliation · powered by Paytm
        </footer>
      </body>
    </html>
  );
}
