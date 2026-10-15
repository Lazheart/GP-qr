"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import {
  QrCode,
  Calendar,
  MapPin,
  CheckCircle2,
  Clock,
  AlertCircle,
  Download,
  Share2,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { generateQRDataURL, downloadDataUrl } from "@/lib/qr";

interface TicketData {
  event_name: string;
  event_location?: string | null;
  starts_at: string;
  ends_at: string;
  participant_name: string;
  status: string;
  is_checked_in: boolean;
  checked_in_at?: string | null;
}

function GuestTicketContent({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const resolvedParams = use(params);
  const token = resolvedParams.token;

  const [loading, setLoading] = useState(true);
  const [ticket, setTicket] = useState<TicketData | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTicket() {
      if (!token) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/ticket/${token}`);
        const data = await res.json();

        if (!res.ok || !data.success) {
          setErrorMessage(data.error || "No se encontró la credencial.");
        } else {
          setTicket(data.ticket);
          const url = await generateQRDataURL(token, { width: 500, margin: 2 });
          setQrDataUrl(url);
        }
      } catch (err) {
        setErrorMessage("Error al cargar la credencial.");
      } finally {
        setLoading(false);
      }
    }

    fetchTicket();
  }, [token]);

  const handleDownload = () => {
    if (!qrDataUrl || !ticket) return;
    const cleanName = ticket.participant_name.replace(/\s+/g, "_");
    downloadDataUrl(qrDataUrl, `Pase_${cleanName}.png`);
  };

  return (
    <div className="min-h-screen bg-black text-[#ededed] font-sans antialiased relative selection:bg-white selection:text-black flex flex-col justify-between">
      {/* Background aesthetics */}
      <div className="absolute inset-0 vercel-grid pointer-events-none opacity-30" />
      <div className="absolute top-0 inset-x-0 h-96 vercel-spotlight pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 w-full border-b border-white/[0.08] bg-black/60 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold tracking-tight text-white">
              GPQR <span className="text-zinc-500 font-mono text-xs">Pase Digital</span>
            </span>
          </div>
          <span className="text-[11px] font-mono text-zinc-500">Credencial Oficial</span>
        </div>
      </header>

      {/* Ticket Container */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-sm sm:max-w-md">
          {loading ? (
            <div className="rounded-2xl border border-white/[0.1] bg-zinc-950/80 p-12 text-center shadow-2xl backdrop-blur-xl">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-white mb-3" />
              <p className="text-xs font-mono text-zinc-400">Generando pase de acceso...</p>
            </div>
          ) : errorMessage || !ticket ? (
            <div className="rounded-2xl border border-white/[0.1] bg-zinc-950/80 p-8 text-center shadow-2xl backdrop-blur-xl">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-red-950/40 border border-red-500/20 text-red-400 mb-4">
                <AlertCircle className="h-6 w-6" />
              </div>
              <h1 className="text-base font-bold text-white mb-2">Credencial No Encontrada</h1>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {errorMessage || "Este código no corresponde a un participante activo."}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-white/[0.12] bg-zinc-950 shadow-2xl backdrop-blur-xl">
              {/* Ticket Top Banner */}
              <div className="border-b border-white/[0.08] bg-gradient-to-b from-white/[0.06] to-transparent p-6 text-center">
                <span className="inline-block rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-mono text-zinc-300 mb-2">
                  Pase Personal e Intransferible
                </span>
                <h1 className="text-xl font-bold tracking-tight text-white">
                  {ticket.event_name}
                </h1>
                {ticket.event_location && (
                  <div className="mt-1 flex items-center justify-center gap-1.5 text-xs text-zinc-400">
                    <MapPin className="h-3.5 w-3.5 text-zinc-500" />
                    <span>{ticket.event_location}</span>
                  </div>
                )}
              </div>

              {/* QR Image & Status */}
              <div className="p-6 flex flex-col items-center">
                <div className="relative rounded-2xl bg-white p-4 shadow-xl border border-white/20">
                  {qrDataUrl && (
                    <img
                      src={qrDataUrl}
                      alt="Código QR de Acceso"
                      className="h-56 w-56 sm:h-64 sm:w-64 object-contain"
                    />
                  )}
                </div>

                {/* Attendee Name */}
                <div className="mt-5 text-center">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                    Asistente
                  </span>
                  <h2 className="text-lg font-bold text-white tracking-tight">
                    {ticket.participant_name}
                  </h2>
                </div>

                {/* Check-in status badge */}
                <div className="mt-4 w-full">
                  {ticket.is_checked_in ? (
                    <div className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/40 py-2.5 px-4 text-xs font-medium text-emerald-300">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      <span>
                        Asistencia Registrada
                        {ticket.checked_in_at &&
                          ` (${new Date(ticket.checked_in_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`}
                      </span>
                    </div>
                  ) : ticket.status === "cancelled" ? (
                    <div className="flex items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-950/40 py-2.5 px-4 text-xs font-medium text-red-300">
                      <AlertCircle className="h-4 w-4 text-red-400" />
                      <span>Inscripción Cancelada</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] py-2.5 px-4 text-xs font-medium text-zinc-300">
                      <Clock className="h-4 w-4 text-amber-400" />
                      <span>Pendiente de Ingreso en Puerta</span>
                    </div>
                  )}
                </div>

                {/* Download Button */}
                <div className="mt-6 w-full flex gap-3">
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="flex-1 flex h-11 items-center justify-center gap-2 rounded-lg bg-white px-4 text-xs font-semibold text-black hover:bg-zinc-200 transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    <span>Guardar Imagen</span>
                  </button>
                </div>
              </div>

              {/* Security info footer */}
              <div className="border-t border-white/[0.08] bg-black/40 px-6 py-4 text-center">
                <p className="text-[11px] text-zinc-400">
                  Presenta este código en la entrada del evento para validar tu asistencia.
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.08] py-4 text-center text-xs text-zinc-600 font-mono">
        GPQR Protocolo de Acceso • Código Cifrado
      </footer>
    </div>
  );
}

export default function GuestTicketPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-black flex items-center justify-center text-xs text-zinc-500 font-mono">
          Cargando credencial...
        </div>
      }
    >
      <GuestTicketContent params={params} />
    </React.Suspense>
  );
}
