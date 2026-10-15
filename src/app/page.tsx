"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  QrCode,
  ScanLine,
  Upload,
  Users,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  FileSpreadsheet,
  Database,
  Lock,
  Zap,
  Sparkles,
  Layers,
  ChevronRight,
} from "lucide-react";

export default function HomePage() {
  const [activeDemoTab, setActiveDemoTab] = useState<"credencial" | "excel" | "scanner">("credencial");

  return (
    <div className="min-h-screen bg-black text-[#ededed] font-sans antialiased relative selection:bg-white selection:text-black">
      {/* Vercel subtle grid and gentle spotlight background */}
      <div className="absolute inset-0 vercel-grid pointer-events-none opacity-40" />
      <div className="absolute top-0 inset-x-0 h-[560px] vercel-spotlight pointer-events-no ne" />

      {/* Navigation Header */}
      <header className="sticky top-0 z-50 w-full border-b border-white/[0.08] bg-black/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex flex-col">
              <span className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                GPQR
              </span>
            </div>
          </Link>

          {/* Links */}
          <nav className="hidden md:flex items-center gap-6 text-xs text-zinc-400">
            <a href="#que-hace" className="hover:text-white transition-colors">
              ¿Qué es GPQR?
            </a>
            <a href="#como-funciona" className="hover:text-white transition-colors">
              Cómo Funciona
            </a>
          </nav>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <Link
              href="/auth"
              className="px-3 py-1.5 rounded-md text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/[0.05] transition-colors"
            >
              Iniciar Sesión
            </Link>
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 rounded-md bg-white px-3.5 py-1.5 text-xs font-semibold text-black hover:bg-zinc-200 transition-all shadow-sm"
            >
              <span>Ir al Dashboard</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative mx-auto max-w-7xl px-4 pt-20 pb-16 sm:px-6 lg:pt-28 lg:pb-24 text-center">
        {/* Pill Badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 mb-8 backdrop-blur-md">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-mono text-xs text-zinc-300">
            Protocolo de Acreditación y Validación de Asistencia
          </span>
        </div>

        {/* Heading */}
        <h1 className="mx-auto max-w-4xl text-4xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl">
          Control de Asistencia con Códigos QR{" "}
        </h1>

        {/* Subtitle */}
        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-zinc-400 sm:text-lg">
          GPQR transforma la logística de tus eventos: genera credenciales digitales instantáneas, procesa listas masivas de Excel y audita el ingreso en tiempo real.
        </p>

        {/* CTA Buttons */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/dashboard"
            className="flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 text-sm font-semibold text-black transition-all hover:bg-zinc-200 active:scale-95 shadow-lg shadow-white/5"
          >
            <Layers className="h-4 w-4" />
            <span>Abrir Dashboard de Eventos</span>
            <ArrowRight className="h-4 w-4" />
          </Link>

          <Link
            href="/auth"
            className="flex h-12 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.03] px-6 text-sm font-medium text-zinc-200 transition-all hover:bg-white/[0.08] hover:text-white"
          >
            <ShieldCheck className="h-4 w-4" />
            <span>Acceder o Crear Cuenta</span>
          </Link>
        </div>
      </section>

            {/* Section: ¿Qué hace el proyecto? */}
      <section id="que-hace" className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-mono uppercase tracking-wider text-zinc-400">
            Visión General
          </span>
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl mt-2">
            ¿Qué problema resuelve GPQR?
          </h2>
          <p className="mt-4 text-sm text-zinc-400 leading-relaxed">
            Las acreditaciones en papel y las listas manuales causan filas interminables, errores humanos y fraudes de acceso. GPQR ofrece un flujo integral, desde la creación del evento hasta la auditoría post-evento.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-xl border border-white/[0.08] bg-zinc-950/60 p-6 backdrop-blur-sm transition-all hover:border-white/20">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-white mb-4">
              <Zap className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-white">Cero Cuellos de Botella</h3>
            <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
              Escanea y valida credenciales en menos de medio segundo por persona. Procesa cientos de asistentes en minutos durante las horas pico de tu congreso o conferencia.
            </p>
          </div>

          <div className="rounded-xl border border-white/[0.08] bg-zinc-950/60 p-6 backdrop-blur-sm transition-all hover:border-white/20">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-white mb-4">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-white">Integración Nativa con Excel</h3>
            <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
              No tienes que reescribir tus listas. Sube el archivo Excel exportado de formularios de registro y descarga reportes con el estado y hora exacta de asistencia.
            </p>
          </div>

          <div className="rounded-xl border border-white/[0.08] bg-zinc-950/60 p-6 backdrop-blur-sm transition-all hover:border-white/20">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-white mb-4">
              <Lock className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-white">Prevención de Suplantación</h3>
            <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
              Cada código QR es único e intransferible. Una vez registrado el ingreso, cualquier intento posterior de escanear el mismo código es alertado como duplicado.
            </p>
          </div>
        </div>
      </section>

      {/* Interactive Demonstration Section */}
      <section className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="rounded-2xl border border-white/[0.1] bg-zinc-950/70 p-6 sm:p-10 backdrop-blur-xl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-white/[0.08] pb-6 mb-8 gap-4">
            <div>
              <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                Demostración Interactiva
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-white mt-1">
                ¿Cómo interactúa GPQR en un evento real?
              </h2>
            </div>

            {/* Toggle demo tabs */}
            <div className="flex rounded-lg border border-white/10 bg-black/60 p-1">
              <button
                onClick={() => setActiveDemoTab("credencial")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  activeDemoTab === "credencial"
                    ? "bg-white text-black font-semibold"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                1. Credencial QR
              </button>
              <button
                onClick={() => setActiveDemoTab("excel")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  activeDemoTab === "excel"
                    ? "bg-white text-black font-semibold"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                2. Carga Excel
              </button>
              <button
                onClick={() => setActiveDemoTab("scanner")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  activeDemoTab === "scanner"
                    ? "bg-white text-black font-semibold"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                3. Validación en Puerta
              </button>
            </div>
          </div>

          {/* Interactive Demo View Content */}
          {activeDemoTab === "credencial" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded bg-emerald-500/10 px-2 py-0.5 text-xs font-mono text-emerald-400 border border-emerald-500/20 mb-3">
                  QR Unico
                </span>
                <h3 className="text-lg font-semibold text-white">
                  Credencial Unica de Un Solo Uso
                </h3>
                <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                  Cada participante recibe un código QR asociado a un registro unico.
                </p>
                <ul className="mt-4 space-y-2 text-xs text-zinc-300">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-white" />
                    <span>Descargable en formato PNG de alta resolución o SVG vectorial</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-white" />
                    <span>Asociado al documento de identidad único del asistente</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-white" />
                    <span>Listo para imprimir en acreditaciones físicas o enviar por email</span>
                  </li>
                </ul>
              </div>

              {/* Sample Badge */}
              <div className="flex justify-center">
                <div className="w-full max-w-xs rounded-2xl border border-white/20 bg-gradient-to-b from-zinc-900 to-black p-6 text-center shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 inset-x-0 h-1 bg-white" />
                  <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono mb-4">
                    <span>GPQR PASS</span>
                    <span className="text-emerald-400">ACTIVO</span>
                  </div>
                  <div className="mx-auto flex h-36 w-36 items-center justify-center rounded-xl bg-white p-2">
                    <QrCode className="h-full w-full text-black" />
                  </div>
                  <h4 className="mt-4 text-sm font-bold text-white">Gabriel Pino</h4>
                  <p className="text-[11px] text-zinc-400 font-mono mt-0.5">DNI: 72938401</p>
                  <p className="mt-2 text-[10px] text-zinc-500 truncate font-mono">
                    Token: c0000000-0000-4000-8000-000000000001
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeDemoTab === "excel" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded bg-blue-500/10 px-2 py-0.5 text-xs font-mono text-blue-400 border border-blue-500/20 mb-3">
                  Importación Automatizada
                </span>
                <h3 className="text-lg font-semibold text-white">
                  Carga Masiva desde Hojas de Cálculo
                </h3>
                <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                  ¿Tienes cientos o miles de inscritos en un archivo Excel? Sube tu archivo .xlsx o .csv: el algoritmo inteligente reconoce los encabezados (DNI, Nombre, Email, Teléfono) y valida duplicados antes de insertarlos.
                </p>
                <div className="mt-6 flex gap-3">
                  <Link
                    href="/dashboard"
                    className="flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-zinc-200 transition-colors"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    <span>Probar Carga en el Dashboard</span>
                  </Link>
                </div>
              </div>

              {/* Sample Table Preview */}
              <div className="rounded-xl border border-white/10 bg-black/60 p-4 font-mono text-xs overflow-x-auto">
                <div className="text-[11px] text-zinc-400 mb-2 flex items-center justify-between">
                  <span>participantes_evento.xlsx</span>
                  <span className="text-emerald-400">Columnas detectadas</span>
                </div>
                <table className="w-full text-left text-[11px]">
                  <thead>
                    <tr className="border-b border-white/10 text-zinc-400">
                      <th className="py-1">Documento</th>
                      <th className="py-1">Nombre</th>
                      <th className="py-1">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-zinc-300">
                    <tr>
                      <td className="py-1.5 text-white">72938401</td>
                      <td className="py-1.5">Gabriel Pino</td>
                      <td className="py-1.5 text-emerald-400">✓ Válido</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 text-white">44892019</td>
                      <td className="py-1.5">Valeria Mendoza</td>
                      <td className="py-1.5 text-emerald-400">✓ Válido</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 text-white">10982344</td>
                      <td className="py-1.5">Carlos Silva</td>
                      <td className="py-1.5 text-emerald-400">✓ Válido</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeDemoTab === "scanner" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded bg-emerald-500/10 px-2 py-0.5 text-xs font-mono text-emerald-400 border border-emerald-500/20 mb-3">
                  scan_event_qr (RPC)
                </span>
                <h3 className="text-lg font-semibold text-white">
                  Validación Atómica y Registro de Auditoría
                </h3>
                <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                  Cuando la cámara escanea un código QR, el sistema ejecuta la función almacenada <code className="text-zinc-200">scan_event_qr</code> dentro de PostgreSQL. Esto garantiza que la actualización del estado y el registro en <code className="text-zinc-200">attendance_logs</code> ocurran en una sola transacción sin condiciones de carrera.
                </p>
                <ul className="mt-4 space-y-2 text-xs text-zinc-300">
                  <li className="flex items-center gap-2 text-emerald-400">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span><strong className="text-white">accepted:</strong> Ingreso aprobado y registrado en la base de datos</span>
                  </li>
                  <li className="flex items-center gap-2 text-amber-400">
                    <Clock className="h-4 w-4 shrink-0" />
                    <span><strong className="text-white">already_attended:</strong> Alerta inmediata si el QR ya fue utilizado</span>
                  </li>
                  <li className="flex items-center gap-2 text-red-400">
                    <ShieldCheck className="h-4 w-4 shrink-0" />
                    <span><strong className="text-white">invalid_qr:</strong> Rechazo instantáneo si no pertenece al evento</span>
                  </li>
                </ul>
              </div>

              {/* Sample Scanner Visual */}
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-5 text-center">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-black mb-3">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h4 className="text-base font-bold text-white">¡Asistencia Confirmada!</h4>
                <p className="text-xs text-zinc-300 mt-1">Gabriel Pino • DNI 72938401</p>
                <div className="mt-3 inline-block rounded bg-emerald-500/20 px-2.5 py-1 text-[11px] font-mono text-emerald-300">
                  Hora de ingreso: {new Date().toLocaleTimeString()}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
      {/* Section: Cómo Funciona en 4 Pasos */}
      <section id="como-funciona" className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 border-t border-white/[0.08]">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-mono uppercase tracking-wider text-zinc-400">
            Flujo de Trabajo
          </span>
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl mt-2">
            Simple, Rápido y Escalable
          </h2>
          <p className="mt-4 text-sm text-zinc-400 leading-relaxed">
            Cuatro etapas sencillas para llevar el control de tus eventos desde el registro hasta el informe final.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="rounded-xl border border-white/[0.08] bg-zinc-950/40 p-5 relative">
            <span className="font-mono text-2xl font-bold text-white/30">01</span>
            <h4 className="text-sm font-semibold text-white mt-2">Crea tu Evento</h4>
            <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
              Establece el nombre, fechas de inicio y término, ubicación y estado en el Dashboard.
            </p>
          </div>

          <div className="rounded-xl border border-white/[0.08] bg-zinc-950/40 p-5 relative">
            <span className="font-mono text-2xl font-bold text-white/30">02</span>
            <h4 className="text-sm font-semibold text-white mt-2">Registra o Carga Excel</h4>
            <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
              Agrega participantes uno a uno o sube una lista masiva con miles de filas en segundos.
            </p>
          </div>

          <div className="rounded-xl border border-white/[0.08] bg-zinc-950/40 p-5 relative">
            <span className="font-mono text-2xl font-bold text-white/30">03</span>
            <h4 className="text-sm font-semibold text-white mt-2">Emite Credenciales</h4>
            <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
              Descarga todas las imágenes QR en un paquete ZIP o impártelas digitalmente a tus asistentes.
            </p>
          </div>

          <div className="rounded-xl border border-white/[0.08] bg-zinc-950/40 p-5 relative">
            <span className="font-mono text-2xl font-bold text-white/30">04</span>
            <h4 className="text-sm font-semibold text-white mt-2">Valida en Puerta</h4>
            <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
              Abre el terminal de escáner en cualquier celular o laptop con cámara para auditar la entrada.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Bottom Banner */}
      <section className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 text-center">
        <h2 className="text-3xl font-bold text-white sm:text-4xl">
          ¿Listo para gestionar tu próximo evento?
        </h2>
        <p className="mt-3 text-sm text-zinc-400 max-w-xl mx-auto">
          Crea tus eventos, importa tus listas de Excel y comienza a emitir credenciales QR seguras en minutos.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-black hover:bg-zinc-200 transition-colors shadow-lg"
          >
            <span>Ir al Dashboard de Eventos</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.08] bg-black py-8 text-center text-xs text-zinc-500 font-mono">
        <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span> <a href="https://github.com/lazheart/GP-qr">GPQR</a> • <a href="https://github.com/lazheart">Lazheart</a></span>
          <div className="flex items-center gap-4 text-zinc-400">
            <Link href="/auth" className="hover:text-white transition-colors">
              Iniciar Sesión
            </Link>
            <span>•</span>
            <Link href="/dashboard" className="hover:text-white transition-colors">
              Dashboard
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
