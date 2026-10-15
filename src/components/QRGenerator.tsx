"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Download, Copy, Check, UserPlus, Sparkles, RefreshCw, Mail, Loader2 } from "lucide-react";
import { generateQRDataURL, generateQRSvg, downloadDataUrl } from "@/lib/qr";
import {
  EventItem,
  RegistrationItem,
  getStoredRegistrations,
  saveRegistrations,
  createRegistrationInSupabase,
  sendGuestTicketEmailAction,
} from "@/lib/db";

interface QRGeneratorProps {
  events: EventItem[];
  currentEventId: string;
  onAttendeeAdded?: () => void;
}

export function QRGenerator({
  events,
  currentEventId,
  onAttendeeAdded,
}: QRGeneratorProps) {
  const [fullName, setFullName] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [sendEmailImmediately, setSendEmailImmediately] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const selectedEvent = events.find((e) => e.id === currentEventId) || events[0];

  const [tokenUuid, setTokenUuid] = useState<string>("");

  useEffect(() => {
    setTokenUuid(crypto.randomUUID());
  }, [documentNumber]);

  const currentToken = tokenUuid || "00000000-0000-0000-0000-000000000000";

  const updateQR = useCallback(async (tokenText: string) => {
    setIsGenerating(true);
    try {
      const url = await generateQRDataURL(tokenText, {
        width: 450,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      });
      setQrDataUrl(url);
    } catch (err) {
      console.error("Error generating QR:", err);
    } finally {
      setIsGenerating(false);
    }
  }, []);

  useEffect(() => {
    updateQR(currentToken);
  }, [currentToken, updateQR]);

  const handleDownloadPNG = () => {
    if (!qrDataUrl) return;
    const cleanDoc = documentNumber.trim() || "sample";
    const cleanName = fullName.trim().replace(/\s+/g, "_") || "qr";
    downloadDataUrl(qrDataUrl, `QR_${cleanDoc}_${cleanName}.png`);
  };

  const handleDownloadSVG = async () => {
    const svgStr = await generateQRSvg(currentToken);
    const blob = new Blob([svgStr], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const cleanDoc = documentNumber.trim() || "sample";
    downloadDataUrl(url, `QR_${cleanDoc}.svg`);
    URL.revokeObjectURL(url);
  };

  const handleCopyToken = () => {
    navigator.clipboard.writeText(currentToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveAttendee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !documentNumber.trim() || !selectedEvent) return;

    const allRegs = getStoredRegistrations();
    // Verificar si ya existe en el evento
    const exists = allRegs.some(
      (r) =>
        r.event_id === selectedEvent.id &&
        r.document_number.trim() === documentNumber.trim()
    );

    if (exists) {
      alert("Ya existe un asistente registrado con este documento en este evento.");
      return;
    }

    const regId = crypto.randomUUID();
    const qrTok = currentToken;

    const newReg: RegistrationItem = {
      id: regId,
      event_id: selectedEvent.id,
      document_number: documentNumber.trim(),
      full_name: fullName.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      qr_token: qrTok,
      status: "registered",
      checked_in_at: null,
      created_at: new Date().toISOString(),
    };

    setIsSubmitting(true);
    let supabaseRegId: string | null = null;

    // Try Supabase insert
    try {
      const created = await createRegistrationInSupabase(selectedEvent.id, {
        document_number: documentNumber.trim(),
        full_name: fullName.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        qr_token: qrTok,
      });
      if (created?.data?.id) {
        supabaseRegId = created.data.id;
      }
    } catch (sbErr) {
      console.warn("Supabase insert registration warning:", sbErr);
    }

    // Enviar credencial por correo si está habilitado y tiene correo
    if (sendEmailImmediately && email.trim() && supabaseRegId) {
      try {
        await sendGuestTicketEmailAction({
          eventId: selectedEvent.id,
          registrationId: supabaseRegId,
        });
      } catch (mailErr) {
        console.warn("Envío de credencial por correo omitido o fallido:", mailErr);
      }
    }

    saveRegistrations([newReg, ...allRegs]);
    setSavedSuccess(true);
    setIsSubmitting(false);
    setTimeout(() => setSavedSuccess(false), 3000);

    // Reset next token
    setTokenUuid(crypto.randomUUID());

    if (onAttendeeAdded) onAttendeeAdded();

    // Limpiar formulario opcionalmente
    setFullName("");
    setDocumentNumber("");
    setEmail("");
    setPhone("");
  };

  return (
    <div className="w-full rounded-xl border border-white/[0.08] bg-zinc-950/60 p-6 backdrop-blur-sm">
      <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-white" />
            <h3 className="text-base font-medium text-white tracking-tight">
              Generador de Códigos QR
            </h3>
          </div>
          <p className="mt-1 text-xs text-zinc-400">
            Crea credenciales de acceso instantáneas y descarga el código en alta definición.
          </p>
        </div>

        <div className="mt-2 sm:mt-0">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-mono text-zinc-300">
            <Sparkles className="h-3 w-3 text-zinc-400" />
            {selectedEvent ? selectedEvent.name : "Evento activo"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Formulario */}
        <form onSubmit={handleSaveAttendee} className="space-y-4 lg:col-span-7">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Nombre Completo *
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ej. Valeria Mendoza"
                className="w-full rounded-md border border-white/10 bg-black/60 px-3 py-2 text-xs text-white placeholder-zinc-600 focus:border-white/30 focus:outline-none focus:ring-1 focus:ring-white/20"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                N° Documento / DNI *
              </label>
              <input
                type="text"
                required
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
                placeholder="Ej. 74839201"
                className="w-full rounded-md border border-white/10 bg-black/60 px-3 py-2 text-xs text-white placeholder-zinc-600 focus:border-white/30 focus:outline-none focus:ring-1 focus:ring-white/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Correo Electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ejemplo@correo.com"
                className="w-full rounded-md border border-white/10 bg-black/60 px-3 py-2 text-xs text-white placeholder-zinc-600 focus:border-white/30 focus:outline-none focus:ring-1 focus:ring-white/20"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Teléfono / WhatsApp
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+51 987 654 321"
                className="w-full rounded-md border border-white/10 bg-black/60 px-3 py-2 text-xs text-white placeholder-zinc-600 focus:border-white/30 focus:outline-none focus:ring-1 focus:ring-white/20"
              />
            </div>
          </div>

          <div className="rounded-md border border-white/[0.06] bg-black/40 p-3">
            <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1">
              <span>Token Único de Acceso:</span>
              <button
                type="button"
                onClick={handleCopyToken}
                className="flex items-center gap-1 text-zinc-300 hover:text-white transition-colors"
              >
                {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                <span>{copied ? "Copiado" : "Copiar"}</span>
              </button>
            </div>
            <p className="font-mono text-xs text-zinc-200 truncate select-all">
              {currentToken}
            </p>
          </div>

          {email.trim().length > 0 && (
            <label className="flex items-center gap-2.5 cursor-pointer select-none text-xs text-zinc-300 bg-white/[0.02] border border-white/[0.08] p-3 rounded-lg hover:border-white/20 transition-colors">
              <input
                type="checkbox"
                checked={sendEmailImmediately}
                onChange={(e) => setSendEmailImmediately(e.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-black/80 text-white focus:ring-0 focus:ring-offset-0 cursor-pointer"
              />
              <span className="flex items-center gap-1.5 text-zinc-300 font-medium">
                <Mail className="h-3.5 w-3.5 text-emerald-400" />
                Enviar credencial oficial y código QR a este correo al guardar
              </span>
            </label>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={!fullName.trim() || !documentNumber.trim()}
              className="flex items-center gap-1.5 rounded-md bg-white px-4 py-2 text-xs font-medium text-black hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {savedSuccess ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  <span>¡Asistente Registrado!</span>
                </>
              ) : (
                <>
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>Guardar Asistente</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDownloadPNG}
              disabled={!qrDataUrl}
              className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs font-medium text-zinc-200 hover:bg-white/[0.08] hover:text-white transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              <span>PNG (800px)</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadSVG}
              className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs font-medium text-zinc-200 hover:bg-white/[0.08] hover:text-white transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              <span>SVG Vector</span>
            </button>
          </div>
        </form>

        {/* Credencial / Ticket Visualizer */}
        <div className="flex flex-col items-center justify-center lg:col-span-5">
          <div className="w-full max-w-[320px] rounded-xl border border-white/[0.12] bg-gradient-to-b from-zinc-900/90 to-black p-5 shadow-2xl relative overflow-hidden">
            {/* Subtle top edge highlight */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 mb-4">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold tracking-tight text-white">▲ GPQR</span>
                <span className="text-[10px] font-mono text-zinc-500 uppercase">Pase Digital</span>
              </div>
              <span className="text-[10px] font-mono rounded bg-white/10 px-1.5 py-0.5 text-zinc-300">
                {selectedEvent?.status.toUpperCase() || "OPEN"}
              </span>
            </div>

            {/* QR Box */}
            <div className="flex flex-col items-center justify-center rounded-lg bg-white p-3.5 shadow-inner">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrDataUrl}
                  alt="QR Code"
                  className="h-44 w-44 object-contain"
                />
              ) : (
                <div className="flex h-44 w-44 items-center justify-center text-zinc-400">
                  <RefreshCw className="h-6 w-6 animate-spin" />
                </div>
              )}
            </div>

            {/* Ticket Info */}
            <div className="mt-4 space-y-1.5 text-left">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                  Asistente
                </p>
                <p className="text-xs font-medium text-white truncate">
                  {fullName.trim() || "Nombre del Participante"}
                </p>
              </div>

              <div className="flex justify-between items-center pt-1 border-t border-white/[0.06]">
                <div>
                  <p className="text-[10px] font-mono uppercase text-zinc-500">Documento</p>
                  <p className="text-xs font-mono text-zinc-300">
                    {documentNumber.trim() || "••••••••"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-mono uppercase text-zinc-500">Evento</p>
                  <p className="text-[11px] text-zinc-300 truncate max-w-[120px]">
                    {selectedEvent?.name || "GPQR Summit"}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-2 border-t border-dashed border-white/10 text-center">
              <span className="text-[9px] font-mono text-zinc-500">
                Escanear en la puerta para validar acceso
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
