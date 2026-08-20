"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/", label: "Accueil" },
  { href: "/classement", label: "Classement" },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="relative z-10 flex w-full items-center justify-between px-6 py-5 sm:px-12">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
      <Link href="/" className="flex items-center gap-3">
        <Image src="/art2/crest-icon.png" alt="" width={52} height={52} className="h-[52px] w-[52px] shrink-0 object-contain drop-shadow-[0_0_12px_rgba(232,193,90,0.3)]" />
        <span className="font-display text-xl font-black tracking-[0.08em] text-gold-bright sm:text-2xl">YRUD GAMES</span>
      </Link>
      <nav className="flex items-center gap-2 sm:gap-3">
        {NAV_LINKS.map((link) => {
          const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`group relative rounded-lg px-3.5 py-2 text-xs font-bold tracking-[0.12em] uppercase transition-colors sm:text-sm ${
                active
                  ? "bg-gold/15 text-gold-bright shadow-[inset_0_0_0_1px_rgba(232,193,90,0.35)]"
                  : "text-ink-muted hover:text-gold-bright"
              }`}
            >
              {link.label}
              {!active && (
                <span className="pointer-events-none absolute inset-x-3.5 bottom-1 h-px origin-center scale-x-0 bg-gold-bright/70 transition-transform duration-200 group-hover:scale-x-100" />
              )}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
