"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Khata" },
  { href: "/invoices", label: "Bills" },
  { href: "/collect", label: "Collect" },
  { href: "/payments", label: "Match Payments" },
  { href: "/reports", label: "Reports" },
];

export function NavBar() {
  const pathname = usePathname();
  return (
    <header className="bg-paytm-navy text-white sticky top-0 z-20 shadow-md">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg shrink-0">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-paytm-cyan text-white text-sm font-black">
            ₹
          </span>
          <span>
            Kirana<span className="text-paytm-cyan">Recon</span>
          </span>
        </Link>
        <nav className="flex items-center gap-1">
          {links.map((l) => {
            const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition ${
                  active ? "bg-paytm-cyan text-white font-semibold" : "text-blue-100 hover:bg-white/10"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
