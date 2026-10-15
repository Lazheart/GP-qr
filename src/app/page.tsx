"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  QrCode,
  ScanLine,
  Upload,
  Users,
  CheckCircle2,
  Clock,
  ArrowRight,
  Download,
  Calendar,
  MapPin,
  TrendingUp,
  FileSpreadsheet,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { QRGenerator } from "@/components/QRGenerator";
import { ExcelUploader } from "@/components/ExcelUploader";
import { QRScanner } from "@/components/QRScanner";
import {
  getStoredEvents,
  getStoredRegistrations,
  calculateEventStats,
  EventItem,
  RegistrationItem,
  EventStats,
} from "@/lib/db";
import { exportAttendanceToExcel } from "@/lib/excel";

export default function HomePage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [registrations, setRegistrations] = useState<RegistrationItem[]>([]);
  const [stats, setStats] = useState<EventStats>({
    total: 0,
    checkedIn: 0,
    pending: 0,
    attendanceRate: 0,
  });
  const [activeTab, setActiveTab] = useState<"generador" | "importar" | "escanear" | "asistentes">("generador");

  const loadData = useCallback(() => {
    const loadedEvents = getStoredEvents();
    setEvents(loadedEvents);

    const initialEventId = selectedEventId || (loadedEvents[0]?.id ?? "");
    if (!selectedEventId && initialEventId) {
      setSelectedEventId(initialEventId);
    }

    if (initialEventId) {
      const currentRegs = getStoredRegistrations(initialEventId);
      setRegistrations(currentRegs);
      setStats(calculateEventStats(initialEventId));
    }
  }, [selectedEventId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSelectEvent = (eventId: string) => {
    setSelectedEventId(eventId);
    const currentRegs = getStoredRegistrations(eventId);
    setRegistrations(currentRegs);
    setStats(calculateEventStats(eventId));
  };

  const currentEvent = events.find((e) => e.id === selectedEventId) || events[0];

  const handleExportExcel = () => {
    if (!currentEvent) return;
    exportAttendanceToExcel(registrations, currentEvent.name);
  };

  return (
    <div className="min-h-screen bg-black text-[#ededed] font-sans antialiased relative selection:bg-white selection:text-black">
      {/* Vercel subtle grid and gentle spotlight background */}
      <div className="absolute inset-0 vercel-grid pointer-events-none opacity-40" />
      <div className="absolute top-0 inset-x-0 h-[480px] vercel-spotlight pointer-events-none" />

      {/* Navigation */}
      <Navbar
        events={events}
        selectedEventId={selectedEventId}
        onSelectEvent={handleSelectEvent}
      />

      {/* Hero Section */}
      <section className="relative mx-auto max-w-7xl px-4 pt-16 pb-12 sm:px-6 lg:pt-24 lg:pb-16 text-center">
        {/* Vercel Pill Badge */}
        <div className="inline-flex items-center gap-2 vercel-badge mb-6">
          <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
          <span className="font-mono text-xs text-zinc-300">
            GPQR Enterprise Attendance Protocol
          </span>
          <ArrowRight className="h-3 w-3 text-zinc-500" />
        </div>

        {/* Hero Heading */}
        <h1 className="mx-auto max-w-4xl text-4xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl">
          Control de Asistencia y Códigos QR{" "}
          <span className="vercel-gradient-text block mt-1">
            de Alta Confiabilidad.
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mx-auto mt-6 max-w-2xl text-sm leading-relaxed text-zinc-400 sm:text-base">
          Genera credenciales digitales instantáneas, procesa listas masivas de Excel
          y audita el acceso en tiempo real con escaneo de cámara y base de datos relacional.
        </p>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => setActiveTab("escanear")}
            className="flex h-10 items-center justify-center gap-2 rounded-md bg-white px-5 text-xs font-medium text-black transition-all hover:bg-zinc-200 active:scale-95"
          >
            <ScanLine className="h-4 w-4" />
            <span>Abrir Terminal de Escáner</span>
          </button>

          <button
            onClick={() => setActiveTab("importar")}
            className="flex h-10 items-center justify-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-5 text-xs font-medium text-zinc-200 transition-all hover:bg-white/[0.08] hover:text-white"
          >
            <Upload className="h-4 w-4" />
            <span>Carga Masiva Excel</span>
          </button>

          <Link
            href="/usuarios"
            className="flex h-10 items-center justify-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-5 text-xs font-medium text-zinc-200 transition-all hover:bg-white/[0.08] hover:text-white"
          >
            <Users className="h-4 w-4" />
            <span>Lista de Asistentes</span>
          </Link>
        </div>
      </section>

      {/* Panel de Métricas / Stats del Evento Seleccionado */}
      <section className="relative mx-auto max-w-7xl px-4 pb-8 sm:px-6">
        <div className="rounded-xl border border-white/[0.08] bg-zinc-950/70 p-5 backdrop-blur-md">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b border-white/[0.06] pb-4 mb-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400" />
              <h2 className="text-sm font-semibold text-white tracking-tight">
                {currentEvent ? currentEvent.name : "Evento Principal"}
              </h2>
              {currentEvent?.location && (
                <span className="flex items-center gap-1 text-[11px] text-zinc-400 font-mono">
                  <MapPin className="h-3 w-3 text-zinc-500" />
                  {currentEvent.location}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportExcel}
                className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/[0.08] hover:text-white transition-colors"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
                <span>Exportar Reporte (.xlsx)</span>
              </button>
            </div>
          </div>

          {/* Tarjetas de estadísticas */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded-lg border border-white/[0.06] bg-black/40 p-4">
              <div className="flex items-center justify-between text-zinc-400 mb-1">
                <span className="text-[11px] font-mono uppercase tracking-wider">
                  Total Registrados
                </span>
                <Users className="h-3.5 w-3.5 text-zinc-500" />
              </div>
              <p className="text-2xl font-bold font-mono text-white">{stats.total}</p>
              <p className="text-[10px] text-zinc-500 mt-1 font-mono">Capacidad global</p>
            </div>

            <div className="rounded-lg border border-white/[0.06] bg-black/40 p-4">
              <div className="flex items-center justify-between text-zinc-400 mb-1">
                <span className="text-[11px] font-mono uppercase tracking-wider">
                  Confirmados
                </span>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              </div>
              <p className="text-2xl font-bold font-mono text-emerald-400">
                {stats.checkedIn}
              </p>
              <p className="text-[10px] text-zinc-500 mt-1 font-mono">Ingresaron al evento</p>
            </div>

            <div className="rounded-lg border border-white/[0.06] bg-black/40 p-4">
              <div className="flex items-center justify-between text-zinc-400 mb-1">
                <span className="text-[11px] font-mono uppercase tracking-wider">
                  Pendientes
                </span>
                <Clock className="h-3.5 w-3.5 text-zinc-400" />
              </div>
              <p className="text-2xl font-bold font-mono text-zinc-200">
                {stats.pending}
              </p>
              <p className="text-[10px] text-zinc-500 mt-1 font-mono">Faltan por ingresar</p>
            </div>

            <div className="rounded-lg border border-white/[0.06] bg-black/40 p-4">
              <div className="flex items-center justify-between text-zinc-400 mb-1">
                <span className="text-[11px] font-mono uppercase tracking-wider">
                  Tasa de Asistencia
                </span>
                <TrendingUp className="h-3.5 w-3.5 text-zinc-300" />
              </div>
              <p className="text-2xl font-bold font-mono text-white">
                {stats.attendanceRate}%
              </p>
              <div className="mt-2 h-1 w-full rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-white transition-all duration-500"
                  style={{ width: `${stats.attendanceRate}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tabs Principales de Herramientas */}
      <section className="relative mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        {/* Tab Buttons */}
        <div className="mb-6 flex items-center justify-center border-b border-white/[0.08] pb-px">
          <div className="inline-flex rounded-lg border border-white/10 bg-zinc-950 p-1">
            <button
              onClick={() => setActiveTab("generador")}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-xs font-medium transition-all ${
                activeTab === "generador"
                  ? "bg-white text-black shadow"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <QrCode className="h-3.5 w-3.5" />
              <span>Generador Individual</span>
            </button>

            <button
              onClick={() => setActiveTab("importar")}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-xs font-medium transition-all ${
                activeTab === "importar"
                  ? "bg-white text-black shadow"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Carga Masiva Excel</span>
            </button>

            <button
              onClick={() => setActiveTab("escanear")}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-xs font-medium transition-all ${
                activeTab === "escanear"
                  ? "bg-white text-black shadow"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <ScanLine className="h-3.5 w-3.5" />
              <span>Terminal Escáner</span>
            </button>

            <button
              onClick={() => setActiveTab("asistentes")}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-xs font-medium transition-all ${
                activeTab === "asistentes"
                  ? "bg-white text-black shadow"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>Lista de Asistentes</span>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="transition-all">
          {activeTab === "generador" && (
            <div id="generador">
              <QRGenerator
                events={events}
                currentEventId={selectedEventId}
                onAttendeeAdded={loadData}
              />
            </div>
          )}

          {activeTab === "importar" && (
            <div id="importar">
              <ExcelUploader
                events={events}
                currentEventId={selectedEventId}
                onImportCompleted={loadData}
              />
            </div>
          )}

          {activeTab === "escanear" && (
            <div id="escanear">
              <QRScanner
                events={events}
                currentEventId={selectedEventId}
                onScanCompleted={loadData}
              />
            </div>
          )}

          {activeTab === "asistentes" && (
            <div className="w-full rounded-xl border border-white/[0.08] bg-zinc-950/60 p-6 backdrop-blur-sm">
              <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h3 className="text-base font-medium text-white tracking-tight">
                    Asistentes Registrados en {currentEvent?.name}
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Control individual de asistencia y tokens generados.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href="/usuarios"
                    className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-zinc-200 hover:bg-white/[0.08] transition-colors"
                  >
                    <span>Gestión Avanzada</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>

              {registrations.length === 0 ? (
                <div className="py-12 text-center text-zinc-500">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-xs">No hay asistentes registrados todavía.</p>
                  <p className="text-[11px] text-zinc-600 mt-1">
                    Crea uno con el generador o importa un archivo Excel.
                  </p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-white/[0.08] bg-black/60">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-950/90 text-[11px] font-mono text-zinc-400 border-b border-white/[0.08]">
                      <tr>
                        <th className="py-2.5 px-3">Estado</th>
                        <th className="py-2.5 px-3">Documento</th>
                        <th className="py-2.5 px-3">Nombre Completo</th>
                        <th className="py-2.5 px-3">Token QR</th>
                        <th className="py-2.5 px-3">Hora de Ingreso</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04] text-zinc-300 font-mono">
                      {registrations.map((reg) => (
                        <tr key={reg.id} className="hover:bg-white/[0.02]">
                          <td className="py-2.5 px-3">
                            {reg.checked_in_at ? (
                              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                                Asistió
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500">
                                <span className="h-1.5 w-1.5 rounded-full bg-zinc-600" />
                                Pendiente
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-white font-semibold">
                            {reg.document_number}
                          </td>
                          <td className="py-2.5 px-3 text-zinc-200">
                            {reg.full_name}
                          </td>
                          <td className="py-2.5 px-3 text-zinc-500 text-[11px] truncate max-w-[150px]">
                            {reg.qr_token}
                          </td>
                          <td className="py-2.5 px-3 text-zinc-400 text-[11px]">
                            {reg.checked_in_at
                              ? new Date(reg.checked_in_at).toLocaleTimeString()
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Footer Minimalista Estilo Vercel */}
      <footer className="border-t border-white/[0.08] bg-black py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-white">▲ GPQR</span>
            <span>—</span>
            <span>Gabriel Pino QR Architecture</span>
          </div>

          <div className="flex items-center gap-6 font-mono text-[11px]">
            <Link href="/" className="hover:text-white transition-colors">
              Inicio
            </Link>
            <Link href="/escanear" className="hover:text-white transition-colors">
              Terminal
            </Link>
            <Link href="/usuarios" className="hover:text-white transition-colors">
              Asistentes
            </Link>
            <span className="text-zinc-700">|</span>
            <span className="text-zinc-400">Next.js 16 • Turbopack • Apache 2.0</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
