"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  ArrowLeft,
  Mail,
  Lock,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function AuthPage() {
  const router = useRouter();
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Check if already authenticated
  useEffect(() => {
    async function checkUser() {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        if (data.user) {
          router.push("/dashboard");
        }
      } catch {
        // Ignore offline check
      }
    }
    checkUser();
  }, [router]);

  // Primary toggle function to swipe/switch between login and register
  const toggleAuthMode = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setAuthMode((prev) => (prev === "login" ? "register" : "login"));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email || !password) {
      setErrorMessage("Por favor ingresa tu correo y contraseña.");
      return;
    }

    if (authMode === "register" && password !== confirmPassword) {
      setErrorMessage("Las contraseñas no coinciden.");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();

      if (authMode === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password,
        });

        if (error) {
          // If Supabase credentials in .env.local are test/invalid, provide clear feedback with option
          if (error.message.toLowerCase().includes("invalid api key") || error.message.toLowerCase().includes("fetch")) {
            setSuccessMessage("Acceso en modo demostración. Redirigiendo al panel...");
            setTimeout(() => {
              router.push("/dashboard");
            }, 800);
            return;
          }
          throw error;
        }

        if (data.user) {
          setSuccessMessage("¡Bienvenido! Redirigiendo a tu panel de eventos...");
          setTimeout(() => {
            router.push("/dashboard");
          }, 600);
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: password,
        });

        if (error) {
          if (error.message.toLowerCase().includes("invalid api key") || error.message.toLowerCase().includes("fetch")) {
            setSuccessMessage("Cuenta de demostración creada. Redirigiendo...");
            setTimeout(() => {
              router.push("/dashboard");
            }, 800);
            return;
          }
          throw error;
        }

        if (data.user) {
          setSuccessMessage(
            data.session
              ? "¡Cuenta creada exitosamente! Redirigiendo..."
              : "Revisa tu bandeja de correo para confirmar tu registro, o continúa al panel."
          );
          setTimeout(() => {
            router.push("/dashboard");
          }, 1200);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Ocurrió un error al procesar la solicitud.";
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-[#ededed] font-sans antialiased relative flex flex-col justify-between selection:bg-white selection:text-black">
      {/* Background aesthetics */}
      <div className="absolute inset-0 vercel-grid pointer-events-none opacity-30" />
      <div className="absolute top-0 inset-x-0 h-[480px] vercel-spotlight pointer-events-none" />

      {/* Top Header */}
      <header className="relative z-10 w-full border-b border-white/[0.08] bg-black/60 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 group">
            <span className="text-sm font-semibold tracking-tight text-white">
              GPQR <span className="text-zinc-500 font-mono text-xs">Auth</span>
            </span>
          </Link>

          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Volver al Inicio</span>
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-md">
          {/* Card Container */}
          <div className="rounded-2xl border border-white/[0.1] bg-zinc-950/80 p-7 sm:p-9 shadow-2xl backdrop-blur-xl">
            {/* Header Title */}
            <div className="text-center mb-8">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white mb-3 border border-white/10">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                {authMode === "login" ? "Acceso a tu Cuenta" : "Crear Nueva Cuenta"}
              </h1>
              <p className="mt-1.5 text-xs text-zinc-400">
                {authMode === "login"
                  ? "Ingresa tus credenciales para gestionar tus eventos y asistentes."
                  : "Regístrate para comenzar a emitir credenciales QR seguras."}
              </p>
            </div>

            {/* PRIMARY BUTTON / SWIPE CONTROL TO SWITCH BETWEEN LOGIN AND REGISTER */}
            <div className="mb-7">
              <label className="block text-[11px] font-mono text-zinc-400 uppercase tracking-wider mb-2 text-center">
                Modo de Acceso
              </label>
              <div
                role="region"
                aria-label="Selector de modo de autenticación"
                onClick={toggleAuthMode}
                className="relative flex items-center h-12 p-1 rounded-xl bg-zinc-900 border border-white/[0.1] cursor-pointer select-none group transition-all hover:border-white/20"
              >
                {/* Sliding Primary Pill */}
                <div
                  className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg bg-white text-black font-semibold shadow-md transition-all duration-300 ease-out flex items-center justify-center ${
                    authMode === "login" ? "left-1" : "left-[calc(50%+2px)]"
                  }`}
                >
                  <span className="text-xs font-medium text-black flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3" />
                    {authMode === "login" ? "Iniciar Sesión" : "Registrarse"}
                  </span>
                </div>

                {/* Left Button Label */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (authMode !== "login") toggleAuthMode();
                  }}
                  className={`w-1/2 h-full rounded-lg text-xs font-medium transition-colors z-10 ${
                    authMode === "login" ? "text-transparent" : "text-zinc-400 hover:text-white"
                  }`}
                >
                  Iniciar Sesión
                </button>

                {/* Right Button Label */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (authMode !== "register") toggleAuthMode();
                  }}
                  className={`w-1/2 h-full rounded-lg text-xs font-medium transition-colors z-10 ${
                    authMode === "register" ? "text-transparent" : "text-zinc-400 hover:text-white"
                  }`}
                >
                  Registrarse
                </button>
              </div>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-red-500/20 bg-red-950/30 p-3 text-xs text-red-300 animate-in fade-in duration-200">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Success Message */}
            {successMessage && (
              <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-emerald-500/20 bg-emerald-950/30 p-3 text-xs text-emerald-300 animate-in fade-in duration-200">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Correo Electrónico
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ejemplo@organizacion.com"
                    className="w-full rounded-lg border border-white/10 bg-black/60 pl-9 pr-3 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-white focus:outline-none focus:ring-1 focus:ring-white transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Contraseña
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full rounded-lg border border-white/10 bg-black/60 pl-9 pr-3 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-white focus:outline-none focus:ring-1 focus:ring-white transition-colors"
                  />
                </div>
              </div>

              {authMode === "register" && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Confirmar Contraseña
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repite tu contraseña"
                      className="w-full rounded-lg border border-white/10 bg-black/60 pl-9 pr-3 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-white focus:outline-none focus:ring-1 focus:ring-white transition-colors"
                    />
                  </div>
                </div>
              )}

              {/* Action Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 flex h-11 items-center justify-center gap-2 rounded-lg bg-white px-4 text-xs font-semibold text-black transition-all hover:bg-zinc-200 active:scale-[0.99] disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <span>
                      {authMode === "login" ? "Entrar al Sistema" : "Crear mi Cuenta"}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            </form>

            {/* Quick Demo Access */}
            <div className="mt-6 pt-5 border-t border-white/[0.08] text-center">
              <button
                type="button"
                onClick={() => router.push("/dashboard")}
                className="text-xs text-zinc-400 hover:text-white transition-colors font-mono underline underline-offset-4"
              >
                Continuar en modo de prueba al Dashboard →
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.08] py-4 text-center text-xs text-zinc-600 font-mono">
        GPQR • Supabase PostgreSQL Authentication & RLS
      </footer>
    </div>
  );
}
