"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, ScanLine } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { QRScanner } from "@/components/QRScanner";
import { fetchEventsFromSupabase, getStoredEvents, EventItem } from "@/lib/db";

export default function EscanearPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAuthorizedEvents() {
      setLoading(true);
      const { data, error } = await fetchEventsFromSupabase();
      if (!error && data && data.length > 0) {
        setEvents(data);
        setSelectedEventId(data[0].id);
      } else {
        const local = getStoredEvents();
        setEvents(local);
        if (local.length > 0) {
          setSelectedEventId(local[0].id);
        }
      }
      setLoading(false);
    }
    loadAuthorizedEvents();
  }, []);

  return (
    <div className="min-h-screen bg-black text-[#ededed] font-sans antialiased relative selection:bg-white selection:text-black flex flex-col">
      <div className="absolute inset-0 vercel-grid pointer-events-none opacity-30" />
      <div className="absolute top-0 inset-x-0 h-64 vercel-spotlight pointer-events-none" />

      <Navbar
        events={events}
        selectedEventId={selectedEventId}
        onSelectEvent={setSelectedEventId}
      />

      <main className="relative mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors font-mono"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Volver al Panel General</span>
          </Link>

          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] text-zinc-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="font-mono">Modo Acceso Puerta</span>
          </div>
        </div>

        <QRScanner
          events={events}
          currentEventId={selectedEventId}
        />
      </main>

      <footer className="border-t border-white/[0.08] bg-black py-6 text-center text-xs text-zinc-600 font-mono">
        GPQR Terminal de Validación • Modo de Alta Fidelidad
      </footer>
    </div>
  );
}
