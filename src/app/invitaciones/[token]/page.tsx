"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Calendar,
  MapPin,
  Mail,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  Loader2,
  ScanLine,
  LogOut,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface InvitationData {
  event_id: string;
  event_name: string;
  event_location?: string | null;
  starts_at: string;
  ends_at: string;
  invited_email: string;
  status: "pending" | "accepted" | "revoked" | "expired";
  expires_at: string;
  is_valid: boolean;
}

function AceptarInvitacionContent({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const resolvedParams = use(params);
  const token = resolvedParams.token;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);

  // 1. Cargar detalles de la invitación y estado de sesión
  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const supabase = createClient();
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user?.email) {
          setCurrentUserEmail(authData.user.email.toLowerCase().trim());
        }

        // Consultar invitación pública
        const res = await fetch(`/api/invitaciones/${token}`);
        const data = await res.json();

        if (!res.ok || !data.success) {
          setErrorMessage(data.error || "La invitación no es válida o ha caducado.");
        } else {
          setInvitation(data.invitation);
        }
      } catch (err) {
        setErrorMessage("Error de conexión al cargar la invitación.");
      } finally {
        setLoading(false);
      }
    }

    if (token) {
      init();
    }
  }, [token]);

  // Manejar aceptación de la invitación
  const handleAccept = async () => {
    if (!token) return;
    setIsAccepting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/invitaciones/${token}`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.error || "No se pudo aceptar la invitación.");
      } else {
        setSuccessMessage("¡Invitación aceptada con éxito! Ya formas parte del equipo de validación.");
        if (invitation) {
          setInvitation({ ...invitation, status: "accepted" });
        }
      }
    } catch (err) {
      setErrorMessage("Error de red al procesar la aceptación.");
    } finally {
      setIsAccepting(false);
    }
  };

  const handleLogout = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      setCurrentUserEmail(null);
      router.refresh();
    } catch {
      // Ignorar
    }
  };

  const isEmailMatching =
    currentUserEmail &&
    invitation &&
    currentUserEmail.toLowerCase() === invitation.invited_email.toLowerCase();

  return (
    <div className="min-h-screen bg-black text-[#ededed] font-sans antialiased relative selection:bg-white selection:text-black flex flex-col justify-between">
      {/* Background decorations */}
      <div className="absolute inset-0 vercel-grid pointer-events-none opacity-30" />
      <div className="absolute top-0 inset-x-0 h-96 vercel-spotlight pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 w-full border-b border-white/[0.08] bg-black/60 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 group">
            <span className="text-sm font-semibold tracking-tight text-white">
              GPQR <span className="text-zinc-500 font-mono text-xs">Acceso Privado</span>
            </span>
          </Link>
          <Link
            href="/"
            className="text-xs text-zinc-400 hover:text-white transition-colors font-mono"
          >
            Inicio
          </Link>
        </div>
      </header>

      {/* Main card */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-lg">
          <div className="rounded-2xl border border-white/[0.1] bg-zinc-950/80 p-7 sm:p-9 shadow-2xl backdrop-blur-xl">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 text-zinc-400 gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-white" />
                <span className="text-xs font-mono">Verificando invitación...</span>
              </div>
            ) : errorMessage && !invitation ? (
              <div className="text-center py-8">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-red-950/40 border border-red-500/20 text-red-400 mb-4">
                  <AlertCircle className="h-6 w-6" />
                </div>
                <h1 className="text-lg font-bold text-white mb-2">Invitación No Disponible</h1>
                <p className="text-xs text-zinc-400 mb-6">{errorMessage}</p>
                <Link
                  href="/"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-zinc-200 transition-colors"
                >
                  Volver al Inicio
                </Link>
              </div>
            ) : invitation ? (
              <div>
                {/* Badge de tipo de rol */}
                <div className="text-center mb-6">
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-white mb-3 border border-white/10">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
                    Invitación de Validador
                  </h1>
                  <p className="mt-1 text-xs text-zinc-400">
                    Has sido invitado a formar parte del equipo de control de acceso.
                  </p>
                </div>

                {/* Tarjeta de detalles del evento */}
                <div className="rounded-xl border border-white/[0.08] bg-zinc-900/60 p-5 mb-6 space-y-3">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                      Evento
                    </span>
                    <h2 className="text-base font-semibold text-white mt-0.5">
                      {invitation.event_name}
                    </h2>
                  </div>

                  {invitation.event_location && (
                    <div className="flex items-center gap-2 text-xs text-zinc-300">
                      <MapPin className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                      <span>{invitation.event_location}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-xs text-zinc-300">
                    <Calendar className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                    <span>
                      {new Date(invitation.starts_at).toLocaleDateString("es-ES", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-zinc-300">
                    <Mail className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                    <span>
                      Invitado a:{" "}
                      <strong className="text-white font-mono">{invitation.invited_email}</strong>
                    </span>
                  </div>
                </div>

                {/* Mensajes de error o éxito */}
                {errorMessage && (
                  <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-red-500/20 bg-red-950/30 p-3 text-xs text-red-300">
                    <AlertCircle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {successMessage && (
                  <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-emerald-500/20 bg-emerald-950/30 p-3 text-xs text-emerald-300">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                    <div>
                      <p className="font-semibold text-white">¡Acceso Concedido!</p>
                      <p className="mt-0.5">{successMessage}</p>
                    </div>
                  </div>
                )}

                {/* Acciones según estado */}
                {invitation.status === "accepted" || successMessage ? (
                  <div className="space-y-3">
                    <Link
                      href={`/escanear`}
                      className="w-full flex h-11 items-center justify-center gap-2 rounded-lg bg-white px-4 text-xs font-semibold text-black hover:bg-zinc-200 transition-colors"
                    >
                      <ScanLine className="h-4 w-4" />
                      <span>Abrir Terminal de Validación</span>
                    </Link>
                    <Link
                      href="/dashboard"
                      className="w-full flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] text-xs text-zinc-300 hover:text-white hover:bg-white/[0.08] transition-colors"
                    >
                      Ir al Dashboard
                    </Link>
                  </div>
                ) : invitation.status === "revoked" ? (
                  <div className="text-center py-4 text-xs text-amber-400 border border-amber-500/20 bg-amber-950/30 rounded-lg p-3">
                    Esta invitación ha sido revocada por el organizador del evento.
                  </div>
                ) : invitation.status === "expired" || !invitation.is_valid ? (
                  <div className="text-center py-4 text-xs text-zinc-400 border border-white/10 bg-white/[0.02] rounded-lg p-3">
                    Esta invitación ha expirado. Solicita al organizador un nuevo enlace.
                  </div>
                ) : !currentUserEmail ? (
                  <div className="space-y-4">
                    <div className="rounded-lg border border-amber-500/20 bg-amber-950/20 p-3.5 text-xs text-amber-300/90 leading-relaxed">
                      Para aceptar esta invitación, debes iniciar sesión con la cuenta{" "}
                      <strong className="text-white font-mono">{invitation.invited_email}</strong>.
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <Link
                        href={`/auth?redirect=/invitaciones/${token}`}
                        className="flex h-10 items-center justify-center rounded-lg bg-white text-xs font-semibold text-black hover:bg-zinc-200 transition-colors"
                      >
                        Iniciar Sesión
                      </Link>
                      <Link
                        href={`/auth?mode=register&redirect=/invitaciones/${token}`}
                        className="flex h-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-xs font-medium text-white hover:bg-white/[0.08] transition-colors"
                      >
                        Crear Cuenta
                      </Link>
                    </div>
                  </div>
                ) : !isEmailMatching ? (
                  <div className="space-y-4">
                    <div className="rounded-lg border border-amber-500/30 bg-amber-950/30 p-3.5 text-xs text-amber-200 leading-relaxed">
                      Has iniciado sesión como <strong className="text-white font-mono">{currentUserEmail}</strong>, pero esta invitación fue dirigida a <strong className="text-white font-mono">{invitation.invited_email}</strong>.
                    </div>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full flex h-10 items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/[0.05] text-xs text-white hover:bg-white/[0.1] transition-colors"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span>Cerrar sesión e ingresar con {invitation.invited_email}</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <button
                      type="button"
                      disabled={isAccepting}
                      onClick={handleAccept}
                      className="w-full flex h-11 items-center justify-center gap-2 rounded-lg bg-white px-4 text-xs font-semibold text-black hover:bg-zinc-200 active:scale-[0.99] transition-all disabled:opacity-50"
                    >
                      {isAccepting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Sparkles className="h-3.5 w-3.5" />
                          <span>Aceptar Invitación y Unirse al Evento</span>
                        </>
                      )}
                    </button>
                    <p className="text-[11px] text-zinc-500 text-center font-mono">
                      Tu usuario ({currentUserEmail}) quedará autorizado como escáner.
                    </p>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.08] py-4 text-center text-xs text-zinc-600 font-mono">
        GPQR • Validación Segura con Row Level Security
      </footer>
    </div>
  );
}

export default function AceptarInvitacionPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-black flex items-center justify-center text-xs text-zinc-500 font-mono">
          Cargando invitación...
        </div>
      }
    >
      <AceptarInvitacionContent params={params} />
    </React.Suspense>
  );
}
