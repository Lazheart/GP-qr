"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { QrCode, ScanLine, Users, Upload, ShieldCheck } from "lucide-react";
import { EventItem } from "@/lib/db";

interface NavbarProps {
  events?: EventItem[];
  selectedEventId?: string;
  onSelectEvent?: (eventId: string) => void;
}

export function Navbar({ events = [], selectedEventId, onSelectEvent }: NavbarProps) {
  const pathname = usePathname();

  const navLinks = [
    { href: "/", label: "Inicio", icon: ShieldCheck },
    { href: "/#generador", label: "Generador", icon: QrCode },
    { href: "/#importar", label: "Carga Masiva", icon: Upload },
    { href: "/escanear", label: "Escáner", icon: ScanLine },
    { href: "/usuarios", label: "Asistentes", icon: Users },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/[0.08] bg-black/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-black font-bold text-sm tracking-tighter transition-transform group-hover:scale-105">
              ▲
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-tight text-white flex items-center gap-1.5">
                GPQR
                <span className="rounded bg-white/10 px-1.5 py-0.2 text-[10px] font-mono text-zinc-400">
                  v2.0
                </span>
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    isActive
                      ? "text-white bg-white/[0.08]"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Event Selector & Status */}
        <div className="flex items-center gap-3">
          {events.length > 0 && onSelectEvent && (
            <div className="flex items-center gap-2">
              <label htmlFor="navbar-event-select" className="hidden lg:inline text-[11px] text-zinc-400 font-mono">
                Evento:
              </label>
              <select
                id="navbar-event-select"
                value={selectedEventId}
                onChange={(e) => onSelectEvent(e.target.value)}
                className="h-8 rounded-md border border-white/10 bg-zinc-950 px-2.5 text-xs text-zinc-200 focus:border-white/30 focus:outline-none focus:ring-1 focus:ring-white/20"
              >
                {events.map((evt) => (
                  <option key={evt.id} value={evt.id} className="bg-zinc-950 text-white">
                    {evt.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="hidden sm:flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-zinc-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono">Supabase Ready</span>
          </div>

          <Link
            href="/escanear"
            className="flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-xs font-medium text-black hover:bg-zinc-200 transition-colors"
          >
            <ScanLine className="h-3.5 w-3.5" />
            <span>Terminal</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
