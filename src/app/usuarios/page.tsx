"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Users,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Download,
  Trash2,
  QrCode,
  FileSpreadsheet,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import {
  fetchEventsFromSupabase,
  fetchRegistrationsFromSupabase,
  getStoredEvents,
  getStoredRegistrations,
  saveRegistrations,
  EventItem,
  RegistrationItem,
} from "@/lib/db";
import { exportAttendanceToExcel } from "@/lib/excel";
import { generateQRDataURL, downloadDataUrl } from "@/lib/qr";

export default function UsuariosPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [registrations, setRegistrations] = useState<RegistrationItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "checked_in" | "pending">("all");
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data: loadedEvents } = await fetchEventsFromSupabase();
    const eventList = loadedEvents && loadedEvents.length > 0 ? loadedEvents : getStoredEvents();
    setEvents(eventList);
    const initialId = selectedEventId || (eventList[0]?.id ?? "");
    if (!selectedEventId && initialId) {
      setSelectedEventId(initialId);
    }
    if (initialId) {
      const { data: regs } = await fetchRegistrationsFromSupabase(initialId);
      setRegistrations(regs || getStoredRegistrations(initialId));
    }
    setLoading(false);
  }, [selectedEventId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSelectEvent = async (id: string) => {
    setSelectedEventId(id);
    const { data: regs } = await fetchRegistrationsFromSupabase(id);
    setRegistrations(regs || getStoredRegistrations(id));
  };

  const currentEvent = events.find((e) => e.id === selectedEventId) || events[0];

  const handleToggleCheckin = (regId: string) => {
    const all = getStoredRegistrations();
    const updated = all.map((r) => {
      if (r.id === regId) {
        return {
          ...r,
          checked_in_at: r.checked_in_at ? null : new Date().toISOString(),
        };
      }
      return r;
    });
    saveRegistrations(updated);
    setRegistrations(updated.filter((r) => r.event_id === selectedEventId));
  };

  const handleDeleteAttendee = (regId: string) => {
    if (!confirm("¿Seguro que deseas eliminar este asistente?")) return;
    const all = getStoredRegistrations();
    const updated = all.filter((r) => r.id !== regId);
    saveRegistrations(updated);
    setRegistrations(updated.filter((r) => r.event_id === selectedEventId));
  };

  const handleDownloadSingleQR = async (reg: RegistrationItem) => {
    const dataUrl = await generateQRDataURL(reg.qr_token, { width: 500 });
    const cleanDoc = reg.document_number.replace(/\s+/g, "_");
    downloadDataUrl(dataUrl, `QR_${cleanDoc}.png`);
  };

  const filteredRegistrations = registrations.filter((reg) => {
    const matchesSearch =
      reg.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reg.document_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (reg.email && reg.email.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;
    if (statusFilter === "checked_in") return reg.checked_in_at !== null;
    if (statusFilter === "pending") return reg.checked_in_at === null;
    return true;
  });

  return (
    <div className="min-h-screen bg-black text-[#ededed] font-sans antialiased relative selection:bg-white selection:text-black flex flex-col">
      <div className="absolute inset-0 vercel-grid pointer-events-none opacity-30" />
      <div className="absolute top-0 inset-x-0 h-64 vercel-spotlight pointer-events-none" />

      <Navbar
        events={events}
        selectedEventId={selectedEventId}
        onSelectEvent={handleSelectEvent}
      />

      <main className="relative mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors font-mono"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Volver al Panel General</span>
          </Link>

          <button
            type="button"
            onClick={() => {
              if (selectedEventId) {
                window.open(`/api/eventos/${selectedEventId}/export`, "_blank");
              }
            }}
            className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/[0.08] hover:text-white transition-colors"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
            <span>Exportar Lista (.xlsx)</span>
          </button>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-zinc-950/70 p-6 backdrop-blur-md">
          {/* Header */}
          <div className="mb-6 flex flex-col gap-1">
            <h2 className="text-lg font-semibold text-white tracking-tight flex items-center gap-2">
              <Users className="h-4 w-4 text-zinc-300" />
              Gestión de Asistentes — {currentEvent?.name}
            </h2>
            <p className="text-xs text-zinc-400">
              Visualiza, filtra y administra la acreditación manual de los participantes.
            </p>
          </div>

          {/* Filtros y Buscador */}
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por DNI, nombre o correo..."
                className="w-full rounded-md border border-white/10 bg-black/60 pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-600 focus:border-white/30 focus:outline-none focus:ring-1 focus:ring-white/20"
              />
            </div>

            <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/40 p-1 text-xs">
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={`rounded px-2.5 py-1 text-[11px] transition-colors ${
                  statusFilter === "all"
                    ? "bg-white text-black font-medium"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Todos ({registrations.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("checked_in")}
                className={`rounded px-2.5 py-1 text-[11px] transition-colors ${
                  statusFilter === "checked_in"
                    ? "bg-white text-black font-medium"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Asistieron ({registrations.filter((r) => r.checked_in_at).length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("pending")}
                className={`rounded px-2.5 py-1 text-[11px] transition-colors ${
                  statusFilter === "pending"
                    ? "bg-white text-black font-medium"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Pendientes ({registrations.filter((r) => !r.checked_in_at).length})
              </button>
            </div>
          </div>

          {/* Tabla de Asistentes */}
          <div className="overflow-hidden rounded-lg border border-white/[0.08] bg-black/60">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-950/90 text-[11px] font-mono text-zinc-400 border-b border-white/[0.08]">
                <tr>
                  <th className="py-2.5 px-3">Estado</th>
                  <th className="py-2.5 px-3">Documento</th>
                  <th className="py-2.5 px-3">Nombre Completo</th>
                  <th className="py-2.5 px-3">Contacto</th>
                  <th className="py-2.5 px-3">Ingreso</th>
                  <th className="py-2.5 px-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04] text-zinc-300 font-mono">
                {filteredRegistrations.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-zinc-500">
                      No se encontraron asistentes con el criterio especificado.
                    </td>
                  </tr>
                ) : (
                  filteredRegistrations.map((reg) => (
                    <tr key={reg.id} className="hover:bg-white/[0.02]">
                      <td className="py-2.5 px-3">
                        {reg.checked_in_at ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            Confirmado
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
                      <td className="py-2.5 px-3 text-zinc-400 text-[11px]">
                        <div>{reg.email || "-"}</div>
                        {reg.phone && <div className="text-zinc-600">{reg.phone}</div>}
                      </td>
                      <td className="py-2.5 px-3 text-zinc-400 text-[11px]">
                        {reg.checked_in_at
                          ? new Date(reg.checked_in_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleToggleCheckin(reg.id)}
                            className={`rounded px-2 py-1 text-[10px] border transition-colors ${
                              reg.checked_in_at
                                ? "border-amber-500/20 text-amber-400 hover:bg-amber-500/10"
                                : "border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10"
                            }`}
                          >
                            {reg.checked_in_at ? "Anular" : "Marcar Entrada"}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDownloadSingleQR(reg)}
                            className="rounded p-1 text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                            title="Descargar QR PNG"
                          >
                            <QrCode className="h-3.5 w-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteAttendee(reg.id)}
                            className="rounded p-1 text-zinc-500 hover:text-red-400 hover:bg-red-950/20 transition-colors"
                            title="Eliminar registro"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <footer className="border-t border-white/[0.08] bg-black py-6 text-center text-xs text-zinc-600 font-mono">
        GPQR • Sistema de Gestión de Asistentes
      </footer>
    </div>
  );
}
