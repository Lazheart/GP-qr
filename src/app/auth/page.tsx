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
  Eye,
  EyeOff,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function AuthPage() {
  const router = useRouter();
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Check if already authenticated & prefetch dashboard route
  useEffect(() => {
    // Pre-cargar la ruta del dashboard en segundo plano para que la navegación sea instantánea
    router.prefetch("/dashboard");

    async function checkUser() {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        if (data.user) {
          setIsRedirecting(true);
          router.replace("/dashboard");
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
          throw error;
        }

        if (data.user) {
          // Activar inmediatamente la pantalla de carga para transición suave
          setIsRedirecting(true);
          setSuccessMessage("¡Bienvenido! Accediendo a tu panel...");
          // Redirigir de inmediato al dashboard
          router.replace("/dashboard");

          // Respaldo de seguridad en caso de que el cliente demore la navegación suave
          setTimeout(() => {
            if (window.location.pathname !== "/dashboard") {
              window.location.assign("/dashboard");
            }
          }, 1200);
          return;
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: password,
        });

        if (error) {
          throw error;
        }

        if (data.user) {
          if (data.session) {
            setIsRedirecting(true);
            setSuccessMessage("¡Cuenta creada exitosamente! Accediendo...");
            router.replace("/dashboard");
            setTimeout(() => {
              if (window.location.pathname !== "/dashboard") {
                window.location.assign("/dashboard");
              }
            }, 1200);
            return;
          } else {
            setSuccessMessage(
              "Revisa tu bandeja de correo para confirmar tu registro, o continúa al panel."
            );
            setTimeout(() => {
              setIsRedirecting(true);
              router.replace("/dashboard");
            }, 600);
            return;
          }
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Ocurrió un error al procesar la solicitud.";
      setErrorMessage(msg);
      setIsLoading(false);
      setIsRedirecting(false);
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
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full rounded-lg border border-white/10 bg-black/60 pl-9 pr-10 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-white focus:outline-none focus:ring-1 focus:ring-white transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2.5 top-2.5 text-zinc-500 hover:text-white transition-colors"
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
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
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repite tu contraseña"
                      className="w-full rounded-lg border border-white/10 bg-black/60 pl-9 pr-10 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-white focus:outline-none focus:ring-1 focus:ring-white transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      className="absolute right-2.5 top-2.5 text-zinc-500 hover:text-white transition-colors"
                      aria-label={showConfirmPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Action Submit Button */}
              <button
                type="submit"
                disabled={isLoading || isRedirecting}
                className="w-full mt-2 flex h-11 items-center justify-center gap-2 rounded-lg bg-white px-4 text-xs font-semibold text-black transition-all hover:bg-zinc-200 active:scale-[0.99] disabled:opacity-50"
              >
                {isLoading || isRedirecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <span>
                      {authMode === "login" ? "Ingresar" : "Registrarse"}
                    </span>
                  </>
                )}
              </button>
            </form>

          </div>
        </div>
      </main>

      {/* Pantalla de Carga / Cargapantalla de Transición */}
      {isRedirecting && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-xl animate-in fade-in duration-200 select-none"
        >
          {/* Fondo sutil y spotlight */}
          <div className="absolute inset-0 vercel-grid pointer-events-none opacity-25" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] bg-white/[0.04] rounded-full blur-3xl pointer-events-none" />

          {/* Tarjeta / Contenedor central */}
          <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-sm">
            {/* Icono con aro de luz y pulsación */}
            <div className="relative mb-5">
              <div className="absolute -inset-2 rounded-2xl bg-gradient-to-r from-white/20 via-zinc-400/20 to-white/20 blur-md opacity-75 animate-pulse" />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-white/20 bg-zinc-950 shadow-2xl">
                <ShieldCheck className="h-8 w-8 text-white animate-pulse" />
              </div>
            </div>

            {/* Badge de estado */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-3">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              <span>Autenticación concedida</span>
            </div>

            <h2 className="text-xl font-bold tracking-tight text-white mb-1.5">
              Accediendo a tu Panel
            </h2>
            <p className="text-xs text-zinc-400 max-w-[260px] leading-relaxed">
              Sincronizando tus credenciales y preparando el gestor de eventos...
            </p>

            {/* Barra de progreso fluida (Indeterminate Shimmer) */}
            <div className="w-56 h-1.5 bg-zinc-800/80 rounded-full overflow-hidden mt-6 relative border border-white/10">
              <div className="h-full bg-gradient-to-r from-transparent via-white to-transparent w-2/3 animate-shimmer-slide" />
            </div>

            <span className="text-[10px] text-zinc-500 font-mono mt-3">
              GPQR • Conexión Segura
            </span>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.08] py-4 text-center text-xs text-zinc-600 font-mono">
        GPQR • Supabase PostgreSQL Authentication & RLS
      </footer>
    </div>
  );
}
