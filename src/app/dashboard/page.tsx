"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Calendar,
  MapPin,
  Users,
  Plus,
  ArrowLeft,
  Search,
  Upload,
  UserPlus,
  ScanLine,
  CheckCircle2,
  Clock,
  Download,
  Trash2,
  QrCode,
  FileSpreadsheet,
  LogOut,
  Sparkles,
  Layers,
  ChevronRight,
  Filter,
  Check,
  AlertCircle,
  Copy,
  ExternalLink,
  ShieldCheck,
  Mail,
  Loader2,
  MoreVertical,
  Pencil,
  Archive,
  ArchiveRestore,
  FileEdit,
  PlayCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  EventItem,
  RegistrationItem,
  EventStats,
  getStoredEvents,
  saveEvents,
  getStoredRegistrations,
  saveRegistrations,
  calculateEventStats,
  fetchEventsFromSupabase,
  createEventInSupabase,
  updateEventInSupabase,
  deleteEventInSupabase,
  fetchRegistrationsFromSupabase,
  scanEventQRWithSupabase,
  sendGuestTicketEmailAction,
} from "@/lib/db";
import { exportAttendanceToExcel, downloadExcelTemplate } from "@/lib/excel";
import { generateQRDataURL, downloadDataUrl, generateQRCodesZip } from "@/lib/qr";
import { ExcelUploader } from "@/components/ExcelUploader";
import { QRGenerator } from "@/components/QRGenerator";
import { QRScanner } from "@/components/QRScanner";
import { EventTeamManager } from "@/components/EventTeamManager";

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryEventId = searchParams.get("evento");

  const [userEmail, setUserEmail] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("user_email");
    }
    return null;
  });
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(queryEventId);
  const [registrations, setRegistrations] = useState<RegistrationItem[]>([]);
  const [stats, setStats] = useState<EventStats>({ total: 0, checkedIn: 0, pending: 0, attendanceRate: 0 });

  // UI state
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
  const [detailTab, setDetailTab] = useState<"asistentes" | "cargar_excel" | "registrar_manual" | "validadores" | "escanear">("asistentes");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "checked_in" | "pending">("all");
  const [activeQRModal, setActiveQRModal] = useState<RegistrationItem | null>(null);
  const [modalQRDataUrl, setModalQRDataUrl] = useState<string>("");
  const [copiedToken, setCopiedToken] = useState(false);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);
  const [emailNotification, setEmailNotification] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // New Event Form State
  const [newEventName, setNewEventName] = useState("");
  const [newEventDescription, setNewEventDescription] = useState("");
  const [newEventLocation, setNewEventLocation] = useState("");
  const [newEventStartsAt, setNewEventStartsAt] = useState(
    new Date().toISOString().slice(0, 16)
  );
  const [newEventEndsAt, setNewEventEndsAt] = useState(
    new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 16)
  );
  const [newEventStatus, setNewEventStatus] = useState<"draft" | "open" | "closed">("open");
  const [formError, setFormError] = useState<string | null>(null);

  // Tabs for events list
  const [eventsFilterTab, setEventsFilterTab] = useState<"activos" | "borradores" | "archivados" | "todos">("activos");
  const [openMenuEventId, setOpenMenuEventId] = useState<string | null>(null);

  // Edit Event Modal State
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editStartsAt, setEditStartsAt] = useState("");
  const [editEndsAt, setEditEndsAt] = useState("");
  const [editStatus, setEditStatus] = useState<"draft" | "open" | "closed">("open");
  const [editIsArchived, setEditIsArchived] = useState(false);
  const [isUpdatingEvent, setIsUpdatingEvent] = useState(false);
  const [editFormError, setEditFormError] = useState<string | null>(null);

  // Close card menus when clicking outside
  useEffect(() => {
    const handleCloseMenu = () => setOpenMenuEventId(null);
    window.addEventListener("click", handleCloseMenu);
    return () => window.removeEventListener("click", handleCloseMenu);
  }, []);

  // Helper for local datetime string
  const toDatetimeLocal = (isoStr?: string | null): string => {
    if (!isoStr) return new Date().toISOString().slice(0, 16);
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 16);
    const offset = d.getTimezoneOffset();
    const localDate = new Date(d.getTime() - offset * 60 * 1000);
    return localDate.toISOString().slice(0, 16);
  };

  // Load authenticated user info (middleware already guards access)
  useEffect(() => {
    async function loadUser() {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        if (data.user) {
          const email = data.user.email || "Usuario Conectado";
          setUserEmail(email);
          setCurrentUserId(data.user.id);
          if (typeof window !== "undefined" && data.user.email) {
            sessionStorage.setItem("user_email", data.user.email);
          }
        }
      } catch {
        // Session will be handled by middleware
      }
    }
    loadUser();
  }, []);

  // Load events
  const loadEventsData = useCallback(async () => {
    // 1. Try Supabase
    const { data, error } = await fetchEventsFromSupabase();
    if (!error && data) {
      setEvents(data);
      saveEvents(data);
      return data;
    }
    // 2. Fallback to stored (only on network/auth error)
    const local = getStoredEvents();
    setEvents(local);
    return local;
  }, []);

  useEffect(() => {
    loadEventsData();
  }, [loadEventsData]);

  // Load event registrations
  const loadRegistrations = useCallback(async (eventId: string) => {
    // Try Supabase first
    const { data, error } = await fetchRegistrationsFromSupabase(eventId);
    let list: RegistrationItem[] = [];
    if (!error && data) {
      list = data;
    } else {
      // Fallback to stored only on network/auth error
      list = getStoredRegistrations(eventId);
    }
    setRegistrations(list);
    setStats(calculateEventStats(eventId, list));
  }, []);

  useEffect(() => {
    if (selectedEventId) {
      loadRegistrations(selectedEventId);
    }
  }, [selectedEventId, loadRegistrations]);

  // Handle Event Creation
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!newEventName.trim()) {
      setFormError("El nombre del evento es requerido.");
      return;
    }

    if (new Date(newEventEndsAt) < new Date(newEventStartsAt)) {
      setFormError("La fecha de término debe ser posterior a la de inicio.");
      return;
    }

    const payload = {
      name: newEventName.trim(),
      description: newEventDescription.trim() || undefined,
      location: newEventLocation.trim() || undefined,
      starts_at: new Date(newEventStartsAt).toISOString(),
      ends_at: new Date(newEventEndsAt).toISOString(),
      status: newEventStatus,
    };

    try {
      // 1. Try Supabase
      const { data, error } = await createEventInSupabase(payload);
      const newEvent: EventItem = data || {
        id: crypto.randomUUID(),
        ...payload,
        created_at: new Date().toISOString(),
      };

      const updated = [newEvent, ...events];
      setEvents(updated);
      saveEvents(updated);

      // Select new event immediately
      setSelectedEventId(newEvent.id);
      setIsCreatingEvent(false);

      // Reset form
      setNewEventName("");
      setNewEventDescription("");
      setNewEventLocation("");
    } catch (err) {
      setFormError("No se pudo crear el evento: " + String(err));
    }
  };

  // Open Edit Modal with event data
  const handleOpenEditModal = (evt: EventItem) => {
    setEditingEvent(evt);
    setEditName(evt.name || "");
    setEditDescription(evt.description || "");
    setEditLocation(evt.location || "");
    setEditStartsAt(toDatetimeLocal(evt.starts_at));
    setEditEndsAt(toDatetimeLocal(evt.ends_at));
    setEditStatus(evt.status === "cancelled" ? "closed" : evt.status);
    setEditIsArchived(Boolean(evt.archived_at));
    setEditFormError(null);
    setOpenMenuEventId(null);
  };

  // Save Edited Event
  const handleSaveEditEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvent) return;
    setEditFormError(null);

    if (!editName.trim()) {
      setEditFormError("El nombre del evento es requerido.");
      return;
    }

    if (new Date(editEndsAt) < new Date(editStartsAt)) {
      setEditFormError("La fecha de término debe ser posterior a la de inicio.");
      return;
    }

    setIsUpdatingEvent(true);
    try {
      const payload = {
        name: editName.trim(),
        description: editDescription.trim() || null,
        location: editLocation.trim() || null,
        starts_at: new Date(editStartsAt).toISOString(),
        ends_at: new Date(editEndsAt).toISOString(),
        status: editStatus,
        archived_at: editIsArchived
          ? (editingEvent.archived_at || new Date().toISOString())
          : null,
      };

      const { data, error } = await updateEventInSupabase(editingEvent.id, payload);
      if (error) {
        setEditFormError("Error al actualizar evento: " + error.message);
        setIsUpdatingEvent(false);
        return;
      }

      const updatedItem: EventItem = data || {
        ...editingEvent,
        ...payload,
        updated_at: new Date().toISOString(),
      };

      const updatedEvents = events.map((ev) =>
        ev.id === editingEvent.id ? updatedItem : ev
      );
      setEvents(updatedEvents);
      saveEvents(updatedEvents);
      setEditingEvent(null);
    } catch (err) {
      setEditFormError("Error inesperado: " + String(err));
    } finally {
      setIsUpdatingEvent(false);
    }
  };

  // Toggle Archive / Unarchive quickly from 3-dots menu
  const handleToggleArchiveEvent = async (evt: EventItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setOpenMenuEventId(null);
    const newArchivedAt = evt.archived_at ? null : new Date().toISOString();
    const newStatus = !evt.archived_at && evt.status === "open" ? "closed" : evt.status;

    try {
      const { data, error } = await updateEventInSupabase(evt.id, {
        archived_at: newArchivedAt,
        status: newStatus,
      });

      const updatedItem: EventItem = data || {
        ...evt,
        archived_at: newArchivedAt,
        status: newStatus,
        updated_at: new Date().toISOString(),
      };

      const updatedEvents = events.map((ev) =>
        ev.id === evt.id ? updatedItem : ev
      );
      setEvents(updatedEvents);
      saveEvents(updatedEvents);
    } catch (err) {
      alert("No se pudo actualizar el estado de archivo: " + String(err));
    }
  };

  // Quick change status (e.g. Borrador, Abierto) from 3-dots menu
  const handleQuickChangeStatus = async (
    evt: EventItem,
    newStatus: "draft" | "open" | "closed",
    e?: React.MouseEvent
  ) => {
    e?.stopPropagation();
    setOpenMenuEventId(null);
    try {
      const shouldUnarchive = newStatus !== "closed" && Boolean(evt.archived_at);
      const updates = {
        status: newStatus,
        ...(shouldUnarchive ? { archived_at: null } : {}),
      };

      const { data, error } = await updateEventInSupabase(evt.id, updates);

      const updatedItem: EventItem = data || {
        ...evt,
        status: newStatus,
        archived_at: shouldUnarchive ? null : evt.archived_at,
        updated_at: new Date().toISOString(),
      };

      const updatedEvents = events.map((ev) =>
        ev.id === evt.id ? updatedItem : ev
      );
      setEvents(updatedEvents);
      saveEvents(updatedEvents);
    } catch (err) {
      alert("No se pudo cambiar el estado del evento: " + String(err));
    }
  };

  // Logout
  const handleLogout = async () => {
    try {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("user_email");
      }
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // Ignore
    }
    router.push("/auth");
  };

  const selectedEvent = events.find((e) => e.id === selectedEventId) || null;
  const isOwner = Boolean(
    selectedEvent && currentUserId && selectedEvent.created_by === currentUserId
  );

  // Fallback tab if non-owner is in an admin-only tab
  useEffect(() => {
    if (!isOwner && (detailTab === "validadores" || detailTab === "cargar_excel" || detailTab === "registrar_manual")) {
      setDetailTab("asistentes");
    }
  }, [isOwner, detailTab]);

  // Toggle Checkin for attendee via server-side verification
  const handleToggleCheckin = async (reg: RegistrationItem) => {
    if (!selectedEvent) return;
    if (reg.checked_in_at) {
      alert("La asistencia de este participante ya fue confirmada previamente.");
      return;
    }
    const res = await scanEventQRWithSupabase(selectedEvent.id, reg.qr_token);
    alert(res.message);
    loadRegistrations(selectedEvent.id);
  };

  // Delete attendee (only allowed for owner)
  const handleDeleteAttendee = async (regId: string) => {
    if (!isOwner) {
      alert("Solo el creador del evento puede eliminar participantes.");
      return;
    }
    if (!confirm("¿Deseas eliminar este registro de participante?")) return;
    try {
      const supabase = createClient();
      await supabase.from("event_registrations").delete().eq("id", regId);
      if (selectedEventId) {
        loadRegistrations(selectedEventId);
      }
    } catch (e) {
      alert("Error al eliminar participante: " + String(e));
    }
  };

  // Enviar credencial oficial por correo electrónico mediante Gmail SMTP
  const handleSendTicketEmail = async (reg: RegistrationItem) => {
    if (!selectedEventId || !reg.email) return;
    setSendingEmailId(reg.id);
    setEmailNotification(null);
    try {
      const res = await sendGuestTicketEmailAction({
        eventId: selectedEventId,
        registrationId: reg.id,
      });
      if (res.success) {
        setEmailNotification({
          type: "success",
          text: `Credencial enviada exitosamente a ${reg.email}`,
        });
        setTimeout(() => setEmailNotification(null), 5000);
      } else {
        setEmailNotification({
          type: "error",
          text: res.error || "No se pudo enviar el correo.",
        });
      }
    } catch (err) {
      setEmailNotification({
        type: "error",
        text: "Error de comunicación con el servidor de correo.",
      });
    } finally {
      setSendingEmailId(null);
    }
  };

  // Secure Server-Side Excel Export
  const handleExportAttendance = () => {
    if (!selectedEvent) return;
    window.open(`/api/eventos/${selectedEvent.id}/export`, "_blank");
  };

  // Open QR modal
  const handleOpenQRModal = async (reg: RegistrationItem) => {
    setActiveQRModal(reg);
    const url = await generateQRDataURL(reg.qr_token, { width: 450 });
    setModalQRDataUrl(url);
  };

  // Download Bulk ZIP
  const handleDownloadBulkZIP = async () => {
    if (!selectedEvent || registrations.length === 0) return;
    setIsDownloadingZip(true);
    try {
      const blob = await generateQRCodesZip(registrations, selectedEvent.name);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Credenciales_QRs_${selectedEvent.name.replace(/\s+/g, "_")}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Error al comprimir los códigos QR en archivo ZIP.");
    } finally {
      setIsDownloadingZip(false);
    }
  };

  // Filter registrations
  const filteredRegistrations = registrations.filter((reg) => {
    const matchSearch =
      reg.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reg.document_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (reg.email && reg.email.toLowerCase().includes(searchTerm.toLowerCase()));
    if (!matchSearch) return false;
    if (statusFilter === "checked_in") return reg.checked_in_at !== null;
    if (statusFilter === "pending") return reg.checked_in_at === null;
    return true;
  });

  return (
    <div className="min-h-screen bg-black text-[#ededed] font-sans antialiased relative selection:bg-white selection:text-black flex flex-col">
      {/* Background aesthetics */}
      <div className="absolute inset-0 vercel-grid pointer-events-none opacity-30" />
      <div className="absolute top-0 inset-x-0 h-64 vercel-spotlight pointer-events-none" />

      {/* Top Navbar */}
      <header className="sticky top-0 z-40 w-full border-b border-white/[0.08] bg-black/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 group">
              <span className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
                GPQR
                <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-mono text-zinc-300">
                  Dashboard
                </span>
              </span>
            </Link>

            {/* Breadcrumb if event selected */}
            {selectedEvent && (
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-zinc-400">
                <ChevronRight className="h-3.5 w-3.5 text-zinc-600" />
                <button
                  onClick={() => setSelectedEventId(null)}
                  className="hover:text-white transition-colors"
                >
                  Eventos
                </button>
                <ChevronRight className="h-3.5 w-3.5 text-zinc-600" />
                <span className="text-white font-medium truncate max-w-[200px]">
                  {selectedEvent.name}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* User status */}
            <div className="hidden md:flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-zinc-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-mono truncate max-w-[180px]">{userEmail}</span>
            </div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
              title="Cerrar Sesión"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="relative z-10 mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        {/* ========================================================================= */}
        {/* VIEW 1: EVENT LIST (WHEN NO EVENT IS SELECTED)                           */}
        {/* ========================================================================= */}
        {!selectedEvent && (
          <div className="space-y-8 animate-in fade-in duration-200">
            {/* Top Overview & Action Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/[0.08] pb-6">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                  Panel de Eventos
                </h1>
                <p className="mt-1 text-xs sm:text-sm text-zinc-400">
                  Crea y gestiona tus eventos para emitir acreditaciones y auditar asistencias.
                </p>
              </div>

              <button
                onClick={() => setIsCreatingEvent(true)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-black hover:bg-zinc-200 transition-all shadow-md active:scale-95"
              >
                <Plus className="h-4 w-4" />
                <span>Crear Nuevo Evento</span>
              </button>
            </div>

            {/* Events Tabs Navigation & Summary */}
            <div className="space-y-4">
              {/* Filter Tabs Bar */}
              <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.08] pb-4">
                <button
                  type="button"
                  onClick={() => setEventsFilterTab("activos")}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-medium transition-all ${
                    eventsFilterTab === "activos"
                      ? "bg-white text-black shadow-md font-semibold"
                      : "border border-white/10 bg-zinc-950/60 text-zinc-400 hover:text-white hover:bg-zinc-900"
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Activos</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-mono font-semibold ${
                      eventsFilterTab === "activos"
                        ? "bg-black/10 text-black"
                        : "bg-white/10 text-zinc-300"
                    }`}
                  >
                    {events.filter((e) => !e.archived_at && e.status !== "draft").length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setEventsFilterTab("borradores")}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-medium transition-all ${
                    eventsFilterTab === "borradores"
                      ? "bg-amber-400 text-black shadow-md font-semibold"
                      : "border border-white/10 bg-zinc-950/60 text-zinc-400 hover:text-white hover:bg-zinc-900"
                  }`}
                >
                  <FileEdit className="h-3.5 w-3.5" />
                  <span>Borradores</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-mono font-semibold ${
                      eventsFilterTab === "borradores"
                        ? "bg-black/15 text-black"
                        : "bg-white/10 text-zinc-300"
                    }`}
                  >
                    {events.filter((e) => !e.archived_at && e.status === "draft").length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setEventsFilterTab("archivados")}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-medium transition-all ${
                    eventsFilterTab === "archivados"
                      ? "bg-purple-500 text-white shadow-md font-semibold"
                      : "border border-white/10 bg-zinc-950/60 text-zinc-400 hover:text-white hover:bg-zinc-900"
                  }`}
                >
                  <Archive className="h-3.5 w-3.5" />
                  <span>Archivados</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-mono font-semibold ${
                      eventsFilterTab === "archivados"
                        ? "bg-white/20 text-white"
                        : "bg-white/10 text-zinc-300"
                    }`}
                  >
                    {events.filter((e) => Boolean(e.archived_at)).length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setEventsFilterTab("todos")}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-medium transition-all ${
                    eventsFilterTab === "todos"
                      ? "bg-zinc-200 text-black shadow-md font-semibold"
                      : "border border-white/10 bg-zinc-950/60 text-zinc-400 hover:text-white hover:bg-zinc-900"
                  }`}
                >
                  <Layers className="h-3.5 w-3.5" />
                  <span>Todos</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-mono font-semibold ${
                      eventsFilterTab === "todos"
                        ? "bg-black/10 text-black"
                        : "bg-white/10 text-zinc-300"
                    }`}
                  >
                    {events.length}
                  </span>
                </button>
              </div>

              {/* Subtitle helper */}
              <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500">
                <span>
                  {eventsFilterTab === "activos" && "Mostrando eventos activos y abiertos para acreditación"}
                  {eventsFilterTab === "borradores" && "Mostrando eventos en borrador en preparación"}
                  {eventsFilterTab === "archivados" && "Mostrando eventos archivados fuera de circulación"}
                  {eventsFilterTab === "todos" && "Mostrando historial completo de eventos registrados"}
                </span>
                <span>
                  Haz clic en un evento para gestionarlo o usa los 3 puntos para opciones rápidas
                </span>
              </div>
            </div>

            {/* Events Grid */}
            <div>
              {(() => {
                const displayedEvents = events.filter((e) => {
                  if (eventsFilterTab === "activos") return !e.archived_at && e.status !== "draft";
                  if (eventsFilterTab === "borradores") return !e.archived_at && e.status === "draft";
                  if (eventsFilterTab === "archivados") return Boolean(e.archived_at);
                  return true;
                });

                if (displayedEvents.length === 0) {
                  return (
                    <div className="rounded-2xl border border-dashed border-white/15 p-12 text-center bg-zinc-950/40">
                      {eventsFilterTab === "borradores" ? (
                        <>
                          <FileEdit className="mx-auto h-10 w-10 text-amber-500/60 mb-3" />
                          <h3 className="text-base font-semibold text-white">No tienes eventos en borrador</h3>
                          <p className="mt-1 text-xs text-zinc-400 max-w-md mx-auto">
                            Puedes guardar eventos como borrador mientras defines los detalles y el equipo.
                          </p>
                          <button
                            onClick={() => {
                              setNewEventStatus("draft");
                              setIsCreatingEvent(true);
                            }}
                            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-zinc-200 transition-colors"
                          >
                            <Plus className="h-4 w-4" />
                            <span>Crear Evento en Borrador</span>
                          </button>
                        </>
                      ) : eventsFilterTab === "archivados" ? (
                        <>
                          <Archive className="mx-auto h-10 w-10 text-purple-400/60 mb-3" />
                          <h3 className="text-base font-semibold text-white">No tienes eventos archivados</h3>
                          <p className="mt-1 text-xs text-zinc-400 max-w-md mx-auto">
                            Los eventos finalizados o que archives desde el menú de 3 puntos se mostrarán aquí.
                          </p>
                        </>
                      ) : eventsFilterTab === "activos" ? (
                        <>
                          <Sparkles className="mx-auto h-10 w-10 text-emerald-400/60 mb-3" />
                          <h3 className="text-base font-semibold text-white">No hay eventos activos en este momento</h3>
                          <p className="mt-1 text-xs text-zinc-400 max-w-md mx-auto">
                            Crea un evento nuevo o activa uno de tus borradores para comenzar con las acreditaciones.
                          </p>
                          <button
                            onClick={() => {
                              setNewEventStatus("open");
                              setIsCreatingEvent(true);
                            }}
                            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-zinc-200 transition-colors"
                          >
                            <Plus className="h-4 w-4" />
                            <span>Crear Evento Activo</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <Calendar className="mx-auto h-10 w-10 text-zinc-600 mb-3" />
                          <h3 className="text-base font-semibold text-white">No tienes eventos creados aún</h3>
                          <p className="mt-1 text-xs text-zinc-400 max-w-md mx-auto">
                            Crea tu primer evento para comenzar a cargar participantes desde Excel o emitir credenciales QR.
                          </p>
                          <button
                            onClick={() => setIsCreatingEvent(true)}
                            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-zinc-200 transition-colors"
                          >
                            <Plus className="h-4 w-4" />
                            <span>Crear Evento</span>
                          </button>
                        </>
                      )}
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {displayedEvents.map((evt) => {
                      const eventStats = calculateEventStats(evt.id);
                      const isEventOwner = Boolean(
                        currentUserId && evt.created_by && evt.created_by === currentUserId
                      ) || !evt.created_by;

                      return (
                        <div
                          key={evt.id}
                          onClick={() => setSelectedEventId(evt.id)}
                          className="group relative flex flex-col justify-between rounded-xl border border-white/[0.1] bg-zinc-950/70 p-5 backdrop-blur-sm transition-all hover:border-white/30 hover:bg-zinc-900/50 cursor-pointer shadow-lg"
                        >
                          <div>
                            {/* Card Top: Status Badges and 3-Dots Menu */}
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {evt.archived_at && (
                                  <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-mono font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                    <Archive className="h-3 w-3" />
                                    Archivado
                                  </span>
                                )}

                                <span
                                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-mono font-medium ${
                                    evt.status === "open"
                                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                      : evt.status === "draft"
                                      ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                      : "bg-red-500/10 text-red-400 border border-red-500/20"
                                  }`}
                                >
                                  <span
                                    className={`h-1.5 w-1.5 rounded-full ${
                                      evt.status === "open"
                                        ? "bg-emerald-400 animate-pulse"
                                        : evt.status === "draft"
                                        ? "bg-amber-400"
                                        : "bg-red-400"
                                    }`}
                                  />
                                  {evt.status === "open"
                                    ? "Abierto"
                                    : evt.status === "draft"
                                    ? "Borrador"
                                    : "Cerrado"}
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono text-zinc-500">
                                  {new Date(evt.starts_at).toLocaleDateString()}
                                </span>

                                {/* 3-Dots Menu Button */}
                                <div className="relative">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenMenuEventId(openMenuEventId === evt.id ? null : evt.id);
                                    }}
                                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-zinc-400 hover:text-white hover:bg-white/[0.1] hover:border-white/20 transition-all"
                                    title="Opciones del evento"
                                  >
                                    <MoreVertical className="h-4 w-4" />
                                  </button>

                                  {/* Dropdown Menu */}
                                  {openMenuEventId === evt.id && (
                                    <div
                                      onClick={(e) => e.stopPropagation()}
                                      className="absolute right-0 top-full mt-1.5 z-30 w-52 rounded-xl border border-white/15 bg-zinc-950 p-1.5 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
                                    >
                                      <div className="px-2.5 py-1.5 text-[10px] font-mono text-zinc-500 uppercase tracking-wider border-b border-white/[0.06] mb-1">
                                        Gestión de Evento
                                      </div>

                                      {/* Edit action */}
                                      <button
                                        type="button"
                                        onClick={() => handleOpenEditModal(evt)}
                                        className="w-full flex items-center gap-2 px-2.5 py-2 text-xs text-zinc-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors text-left font-medium"
                                      >
                                        <Pencil className="h-3.5 w-3.5 text-zinc-400" />
                                        <span>Editar evento</span>
                                      </button>

                                      {/* Quick status transitions */}
                                      {evt.status !== "draft" && isEventOwner && (
                                        <button
                                          type="button"
                                          onClick={(e) => handleQuickChangeStatus(evt, "draft", e)}
                                          className="w-full flex items-center gap-2 px-2.5 py-2 text-xs text-amber-300 hover:text-amber-200 hover:bg-amber-500/10 rounded-lg transition-colors text-left"
                                        >
                                          <FileEdit className="h-3.5 w-3.5 text-amber-400" />
                                          <span>Pasar a Borrador</span>
                                        </button>
                                      )}

                                      {evt.status !== "open" && isEventOwner && (
                                        <button
                                          type="button"
                                          onClick={(e) => handleQuickChangeStatus(evt, "open", e)}
                                          className="w-full flex items-center gap-2 px-2.5 py-2 text-xs text-emerald-300 hover:text-emerald-200 hover:bg-emerald-500/10 rounded-lg transition-colors text-left"
                                        >
                                          <PlayCircle className="h-3.5 w-3.5 text-emerald-400" />
                                          <span>Publicar / Abrir</span>
                                        </button>
                                      )}

                                      {/* Archive / Unarchive toggle */}
                                      {isEventOwner && (
                                        evt.archived_at ? (
                                          <button
                                            type="button"
                                            onClick={(e) => handleToggleArchiveEvent(evt, e)}
                                            className="w-full flex items-center gap-2 px-2.5 py-2 text-xs text-indigo-300 hover:text-indigo-200 hover:bg-indigo-500/10 rounded-lg transition-colors text-left"
                                          >
                                            <ArchiveRestore className="h-3.5 w-3.5 text-indigo-400" />
                                            <span>Desarchivar evento</span>
                                          </button>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={(e) => handleToggleArchiveEvent(evt, e)}
                                            className="w-full flex items-center gap-2 px-2.5 py-2 text-xs text-purple-300 hover:text-purple-200 hover:bg-purple-500/10 rounded-lg transition-colors text-left"
                                          >
                                            <Archive className="h-3.5 w-3.5 text-purple-400" />
                                            <span>Pasar a Archivado</span>
                                          </button>
                                        )
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Event Title */}
                            <h3 className="text-base font-bold text-white group-hover:text-zinc-100 transition-colors line-clamp-1">
                              {evt.name}
                            </h3>

                            {evt.description && (
                              <p className="mt-1.5 text-xs text-zinc-400 line-clamp-2">
                                {evt.description}
                              </p>
                            )}

                            {evt.location && (
                              <div className="mt-3 flex items-center gap-1.5 text-xs text-zinc-400">
                                <MapPin className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                                <span className="truncate">{evt.location}</span>
                              </div>
                            )}
                          </div>

                          {/* Event Stats Footer */}
                          <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5 text-zinc-400">
                              <Users className="h-3.5 w-3.5 text-zinc-500" />
                              <span>{eventStats.total} inscritos</span>
                            </div>

                            <div className="flex items-center gap-1 text-white font-medium group-hover:translate-x-0.5 transition-transform">
                              <span>Gestionar</span>
                              <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 2: EVENT DETAIL VIEW (WHEN AN EVENT IS SELECTED)                     */}
        {/* ========================================================================= */}
        {selectedEvent && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Back Button & Event Summary Header */}
            <div className="flex flex-col gap-4">
              <button
                onClick={() => setSelectedEventId(null)}
                className="self-start inline-flex items-center gap-1.5 text-xs font-mono text-zinc-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Volver al Listado de Eventos</span>
              </button>

              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-white/[0.08] pb-6">
                <div>
                  <div className="flex items-center gap-3 mb-1.5">
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                      {selectedEvent.name}
                    </h1>
                    {selectedEvent.archived_at && (
                      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-mono font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                        <Archive className="h-3 w-3" />
                        ARCHIVADO
                      </span>
                    )}
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-mono font-medium ${
                        selectedEvent.status === "open"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : selectedEvent.status === "draft"
                          ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                      }`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      {selectedEvent.status.toUpperCase()}
                    </span>

                    {/* Role Badge */}
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-mono font-medium ${
                        isOwner
                          ? "bg-indigo-500/10 text-indigo-300 border border-indigo-500/20"
                          : "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                      }`}
                    >
                      <ShieldCheck className="h-3 w-3" />
                      {isOwner ? "Creador del Evento" : "Validador Autorizado"}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-400">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-zinc-500" />
                      {new Date(selectedEvent.starts_at).toLocaleDateString()} —{" "}
                      {new Date(selectedEvent.ends_at).toLocaleDateString()}
                    </span>
                    {selectedEvent.location && (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-zinc-500" />
                        {selectedEvent.location}
                      </span>
                    )}
                  </div>
                </div>

                {/* Quick Action Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  {isOwner && (
                    <button
                      onClick={() => handleOpenEditModal(selectedEvent)}
                      className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs font-medium text-zinc-200 hover:bg-white/[0.08] hover:text-white transition-colors"
                      title="Editar evento"
                    >
                      <Pencil className="h-3.5 w-3.5 text-zinc-400" />
                      <span>Editar Evento</span>
                    </button>
                  )}

                  <button
                    onClick={handleExportAttendance}
                    className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs font-medium text-zinc-200 hover:bg-white/[0.08] hover:text-white transition-colors"
                    title="Exportar archivo Excel verificado en servidor"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Exportar Excel</span>
                  </button>

                  <button
                    onClick={handleDownloadBulkZIP}
                    disabled={isDownloadingZip || registrations.length === 0}
                    className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs font-medium text-zinc-200 hover:bg-white/[0.08] hover:text-white transition-colors disabled:opacity-50"
                  >
                    <Download className="h-3.5 w-3.5 text-white" />
                    <span>{isDownloadingZip ? "Comprimiendo..." : "Descargar QRs (ZIP)"}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Metrics Dashboard */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-xl border border-white/[0.08] bg-zinc-950/60 p-4">
                <span className="text-[11px] font-mono text-zinc-400 uppercase">Inscritos Totales</span>
                <p className="text-2xl font-bold text-white font-mono mt-1">{stats.total}</p>
                <span className="text-[10px] text-zinc-500">100% de la lista</span>
              </div>

              <div className="rounded-xl border border-white/[0.08] bg-zinc-950/60 p-4">
                <span className="text-[11px] font-mono text-emerald-400 uppercase">Asistieron (Check-in)</span>
                <p className="text-2xl font-bold text-emerald-400 font-mono mt-1">{stats.checkedIn}</p>
                <span className="text-[10px] text-zinc-500">Asistencia verificada</span>
              </div>

              <div className="rounded-xl border border-white/[0.08] bg-zinc-950/60 p-4">
                <span className="text-[11px] font-mono text-amber-400 uppercase">Pendientes</span>
                <p className="text-2xl font-bold text-amber-400 font-mono mt-1">{stats.pending}</p>
                <span className="text-[10px] text-zinc-500">Por validar en puerta</span>
              </div>

              <div className="rounded-xl border border-white/[0.08] bg-zinc-950/60 p-4">
                <span className="text-[11px] font-mono text-zinc-400 uppercase">Tasa de Asistencia</span>
                <p className="text-2xl font-bold text-white font-mono mt-1">{stats.attendanceRate}%</p>
                <div className="w-full bg-zinc-800 rounded-full h-1.5 mt-2 overflow-hidden">
                  <div
                    className="bg-emerald-400 h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${stats.attendanceRate}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Detail Tabs Navigation */}
            <div className="flex border-b border-white/[0.08] overflow-x-auto gap-2">
              <button
                onClick={() => setDetailTab("asistentes")}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                  detailTab === "asistentes"
                    ? "border-white text-white"
                    : "border-transparent text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                <span>Lista de Asistentes ({registrations.length})</span>
              </button>

              {isOwner && (
                <>
                  <button
                    onClick={() => setDetailTab("cargar_excel")}
                    className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                      detailTab === "cargar_excel"
                        ? "border-white text-white"
                        : "border-transparent text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <Upload className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Cargar desde Excel</span>
                  </button>

                  <button
                    onClick={() => setDetailTab("registrar_manual")}
                    className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                      detailTab === "registrar_manual"
                        ? "border-white text-white"
                        : "border-transparent text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    <span>Registrar Manualmente</span>
                  </button>

                  <button
                    onClick={() => setDetailTab("validadores")}
                    className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                      detailTab === "validadores"
                        ? "border-white text-white"
                        : "border-transparent text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <ShieldCheck className="h-3.5 w-3.5 text-indigo-400" />
                    <span>Equipo & Validadores</span>
                  </button>
                </>
              )}

              <button
                onClick={() => setDetailTab("escanear")}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                  detailTab === "escanear"
                    ? "border-white text-white"
                    : "border-transparent text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <ScanLine className="h-3.5 w-3.5 text-white" />
                <span>Terminal de Escáner</span>
              </button>
            </div>

            {/* TAB CONTENT 1: LIST OF ATTENDEES */}
            {detailTab === "asistentes" && (
              <div className="space-y-4">
                {/* Search and Filters */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
                    <input
                      type="text"
                      placeholder="Buscar por DNI, nombre o correo..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-black/60 pl-8 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-white/30 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-zinc-400 font-mono">Filtro:</span>
                    <button
                      onClick={() => setStatusFilter("all")}
                      className={`px-2.5 py-1 rounded text-xs transition-colors ${
                        statusFilter === "all"
                          ? "bg-white text-black font-semibold"
                          : "bg-zinc-900 text-zinc-400 hover:text-white"
                      }`}
                    >
                      Todos ({registrations.length})
                    </button>
                    <button
                      onClick={() => setStatusFilter("checked_in")}
                      className={`px-2.5 py-1 rounded text-xs transition-colors ${
                        statusFilter === "checked_in"
                          ? "bg-emerald-500 text-black font-semibold"
                          : "bg-zinc-900 text-zinc-400 hover:text-white"
                      }`}
                    >
                      Asistieron ({stats.checkedIn})
                    </button>
                    <button
                      onClick={() => setStatusFilter("pending")}
                      className={`px-2.5 py-1 rounded text-xs transition-colors ${
                        statusFilter === "pending"
                          ? "bg-amber-500 text-black font-semibold"
                          : "bg-zinc-900 text-zinc-400 hover:text-white"
                      }`}
                    >
                      Pendientes ({stats.pending})
                    </button>
                  </div>
                </div>

                {emailNotification && (
                  <div
                    className={`flex items-center justify-between rounded-lg px-4 py-3 text-xs border ${
                      emailNotification.type === "success"
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                        : "border-red-500/30 bg-red-500/10 text-red-300"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {emailNotification.type === "success" ? (
                        <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                      )}
                      <span>{emailNotification.text}</span>
                    </div>
                    <button
                      onClick={() => setEmailNotification(null)}
                      className="text-zinc-400 hover:text-white text-xs font-mono"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {/* Table */}
                <div className="rounded-xl border border-white/[0.08] bg-zinc-950/60 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-white/[0.08] bg-zinc-900/60 font-mono text-[11px] text-zinc-400">
                        <tr>
                          <th className="py-3 px-4">Documento</th>
                          <th className="py-3 px-4">Nombre Completo</th>
                          <th className="py-3 px-4 hidden md:table-cell">Contacto</th>
                          <th className="py-3 px-4">Estado Asistencia</th>
                          <th className="py-3 px-4 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.06] text-zinc-300">
                        {filteredRegistrations.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-zinc-500">
                              No se encontraron participantes que coincidan con la búsqueda.
                            </td>
                          </tr>
                        ) : (
                          filteredRegistrations.map((reg) => (
                            <tr key={reg.id} className="hover:bg-white/[0.02] transition-colors">
                              <td className="py-3 px-4 font-mono font-medium text-white">
                                {reg.document_number}
                              </td>
                              <td className="py-3 px-4 font-medium text-white">
                                {reg.full_name}
                              </td>
                              <td className="py-3 px-4 hidden md:table-cell text-zinc-400 font-mono text-[11px]">
                                <div>{reg.email || "-"}</div>
                                <div className="text-zinc-500">{reg.phone || ""}</div>
                              </td>
                              <td className="py-3 px-4">
                                {reg.checked_in_at ? (
                                  <span className="inline-flex items-center gap-1.5 rounded bg-emerald-500/10 px-2 py-0.5 text-[11px] font-mono text-emerald-400 border border-emerald-500/20">
                                    <CheckCircle2 className="h-3 w-3" />
                                    <span>
                                      {new Date(reg.checked_in_at).toLocaleTimeString([], {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 rounded bg-zinc-800 px-2 py-0.5 text-[11px] font-mono text-zinc-400">
                                    <Clock className="h-3 w-3 text-zinc-500" />
                                    <span>Pendiente</span>
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="inline-flex items-center gap-2">
                                  {/* View Digital Ticket */}
                                  <Link
                                    href={`/ticket/${reg.qr_token}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="rounded border border-white/10 bg-white/[0.05] p-1.5 text-zinc-300 hover:text-white hover:bg-white/[0.1] transition-colors"
                                    title="Abrir Pase Digital de Invitado"
                                  >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                  </Link>

                                  {/* View QR Modal */}
                                  <button
                                    onClick={() => handleOpenQRModal(reg)}
                                    className="rounded border border-white/10 bg-white/[0.05] p-1.5 text-zinc-300 hover:text-white hover:bg-white/[0.1] transition-colors"
                                    title="Ver Credencial QR"
                                  >
                                    <QrCode className="h-3.5 w-3.5" />
                                  </button>

                                  {/* Send Digital Ticket Email via Gmail SMTP */}
                                  {reg.email && (
                                    <button
                                      onClick={() => handleSendTicketEmail(reg)}
                                      disabled={sendingEmailId === reg.id}
                                      className="rounded border border-white/10 bg-white/[0.05] p-1.5 text-zinc-300 hover:text-white hover:bg-white/[0.1] transition-colors disabled:opacity-40"
                                      title={`Enviar credencial por correo a ${reg.email}`}
                                    >
                                      {sendingEmailId === reg.id ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
                                      ) : (
                                        <Mail className="h-3.5 w-3.5" />
                                      )}
                                    </button>
                                  )}

                                  {/* Toggle Attendance */}
                                  <button
                                    onClick={() => handleToggleCheckin(reg)}
                                    className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${
                                      reg.checked_in_at
                                        ? "bg-zinc-800 text-zinc-400 hover:text-white"
                                        : "bg-emerald-500 text-black font-semibold hover:bg-emerald-400"
                                    }`}
                                    title="Validar asistencia en servidor"
                                  >
                                    {reg.checked_in_at ? "Registrado" : "Check-in"}
                                  </button>

                                  {/* Delete (Only Owner) */}
                                  {isOwner && (
                                    <button
                                      onClick={() => handleDeleteAttendee(reg.id)}
                                      className="rounded p-1.5 text-zinc-500 hover:text-red-400 transition-colors"
                                      title="Eliminar participante"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT 2: UPLOAD EXCEL */}
            {detailTab === "cargar_excel" && isOwner && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-zinc-400">
                    Sube un archivo de Excel (.xlsx, .xls o .csv) para registrar múltiples asistentes de forma instantánea.
                  </p>
                  <button
                    onClick={downloadExcelTemplate}
                    className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:underline font-mono"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Descargar Plantilla de Ejemplo</span>
                  </button>
                </div>

                <ExcelUploader
                  events={[selectedEvent]}
                  currentEventId={selectedEvent.id}
                  onImportCompleted={() => {
                    loadRegistrations(selectedEvent.id);
                    setDetailTab("asistentes");
                  }}
                />
              </div>
            )}

            {/* TAB CONTENT 3: MANUAL REGISTRATION */}
            {detailTab === "registrar_manual" && isOwner && (
              <div className="space-y-4">
                <QRGenerator
                  events={[selectedEvent]}
                  currentEventId={selectedEvent.id}
                  onAttendeeAdded={() => {
                    loadRegistrations(selectedEvent.id);
                  }}
                />
              </div>
            )}

            {/* TAB CONTENT 4: VALIDATORS & TEAM */}
            {detailTab === "validadores" && isOwner && (
              <div className="space-y-4">
                <EventTeamManager
                  eventId={selectedEvent.id}
                  isOwner={isOwner}
                  eventName={selectedEvent.name}
                />
              </div>
            )}

            {/* TAB CONTENT 4: TERMINAL SCANNER */}
            {detailTab === "escanear" && (
              <div className="space-y-4">
                <QRScanner
                  events={[selectedEvent]}
                  currentEventId={selectedEvent.id}
                  onScanCompleted={() => {
                    loadRegistrations(selectedEvent.id);
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL: CREATE NEW EVENT                                                   */}
        {/* ========================================================================= */}
        {isCreatingEvent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-lg rounded-2xl border border-white/15 bg-zinc-950 p-6 sm:p-7 shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-4 mb-5">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white">
                    <Calendar className="h-4 w-4 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-white">Crear Nuevo Evento</h3>
                </div>
                <button
                  onClick={() => setIsCreatingEvent(false)}
                  className="text-zinc-500 hover:text-white text-xs font-mono"
                >
                  ✕ Cerrar
                </button>
              </div>

              {formError && (
                <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-950/30 p-2.5 text-xs text-red-300">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleCreateEvent} className="space-y-4 text-xs">
                <div>
                  <label className="block text-zinc-300 font-medium mb-1">
                    Nombre del Evento *
                  </label>
                  <input
                    type="text"
                    required
                    value={newEventName}
                    onChange={(e) => setNewEventName(e.target.value)}
                    placeholder="Ej. Conferencia Internacional de Inteligencia Artificial"
                    className="w-full rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-white placeholder-zinc-500 focus:border-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-zinc-300 font-medium mb-1">
                    Descripción
                  </label>
                  <textarea
                    rows={2}
                    value={newEventDescription}
                    onChange={(e) => setNewEventDescription(e.target.value)}
                    placeholder="Breve detalle del alcance o agenda del evento..."
                    className="w-full rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-white placeholder-zinc-500 focus:border-white focus:outline-none resize-none"
                  />
                </div>

                <div>
                  <label className="block text-zinc-300 font-medium mb-1">
                    Ubicación o Sala
                  </label>
                  <input
                    type="text"
                    value={newEventLocation}
                    onChange={(e) => setNewEventLocation(e.target.value)}
                    placeholder="Ej. Auditorio Principal, Piso 3"
                    className="w-full rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-white placeholder-zinc-500 focus:border-white focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-zinc-300 font-medium mb-1">
                      Fecha y Hora de Inicio *
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={newEventStartsAt}
                      onChange={(e) => setNewEventStartsAt(e.target.value)}
                      style={{ colorScheme: 'dark' }}
                      className="w-full rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-white focus:border-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-300 font-medium mb-1">
                      Fecha y Hora de Fin *
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={newEventEndsAt}
                      onChange={(e) => setNewEventEndsAt(e.target.value)}
                      style={{ colorScheme: 'dark' }}
                      className="w-full rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-white focus:border-white focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-zinc-300 font-medium mb-1">
                    Estado Inicial
                  </label>
                  <select
                    value={newEventStatus}
                    onChange={(e) => setNewEventStatus(e.target.value as "open" | "draft" | "closed")}
                    className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-white focus:border-white focus:outline-none"
                  >
                    <option value="open">Abierto (Listo para escaneo y registro)</option>
                    <option value="draft">Borrador (Configuración interna)</option>
                    <option value="closed">Cerrado (Solo lectura)</option>
                  </select>
                </div>

                <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-white/[0.08]">
                  <button
                    type="button"
                    onClick={() => setIsCreatingEvent(false)}
                    className="rounded-lg px-4 py-2 text-zinc-400 hover:text-white transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-white px-5 py-2 font-semibold text-black hover:bg-zinc-200 transition-colors"
                  >
                    Crear Evento
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL: EDIT EVENT                                                         */}
        {/* ========================================================================= */}
        {editingEvent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-lg rounded-2xl border border-white/15 bg-zinc-950 p-6 sm:p-7 shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-4 mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white">
                    <Pencil className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Editar Evento</h3>
                    <p className="text-[11px] font-mono text-zinc-400 truncate max-w-[280px]">
                      {editingEvent.name}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingEvent(null)}
                  className="text-zinc-500 hover:text-white text-xs font-mono"
                >
                  ✕ Cerrar
                </button>
              </div>

              {editFormError && (
                <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-950/30 p-2.5 text-xs text-red-300">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                  <span>{editFormError}</span>
                </div>
              )}

              <form onSubmit={handleSaveEditEvent} className="space-y-4 text-xs">
                <div>
                  <label className="block text-zinc-300 font-medium mb-1">
                    Nombre del Evento *
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Ej. Conferencia de Tecnología 2026"
                    className="w-full rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-white placeholder-zinc-500 focus:border-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-zinc-300 font-medium mb-1">
                    Descripción
                  </label>
                  <textarea
                    rows={2}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Breve detalle del alcance o agenda del evento..."
                    className="w-full rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-white placeholder-zinc-500 focus:border-white focus:outline-none resize-none"
                  />
                </div>

                <div>
                  <label className="block text-zinc-300 font-medium mb-1">
                    Ubicación o Sala
                  </label>
                  <input
                    type="text"
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    placeholder="Ej. Auditorio Principal, Piso 3"
                    className="w-full rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-white placeholder-zinc-500 focus:border-white focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-zinc-300 font-medium mb-1">
                      Fecha y Hora de Inicio *
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={editStartsAt}
                      onChange={(e) => setEditStartsAt(e.target.value)}
                      style={{ colorScheme: 'dark' }}
                      className="w-full rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-white focus:border-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-300 font-medium mb-1">
                      Fecha y Hora de Fin *
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={editEndsAt}
                      onChange={(e) => setEditEndsAt(e.target.value)}
                      style={{ colorScheme: 'dark' }}
                      className="w-full rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-white focus:border-white focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-zinc-300 font-medium mb-1">
                    Estado del Evento
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as "open" | "draft" | "closed")}
                    className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-white focus:border-white focus:outline-none"
                  >
                    <option value="open">Abierto (Listo para escaneo y registro)</option>
                    <option value="draft">Borrador (Configuración interna)</option>
                    <option value="closed">Cerrado (Finalizado, solo lectura)</option>
                  </select>
                </div>

                {/* Archivar Evento Toggle */}
                <div className="rounded-xl border border-white/10 bg-zinc-900/60 p-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg border ${
                      editIsArchived
                        ? "bg-purple-500/15 border-purple-500/30 text-purple-400"
                        : "bg-white/5 border-white/10 text-zinc-400"
                    }`}>
                      <Archive className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-semibold text-white">Archivar este evento</p>
                      <p className="text-[11px] text-zinc-400">
                        Mueve el evento a la pestaña de Archivados. Los eventos archivados se conservan como histórico y no aceptan escaneos en puerta.
                      </p>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={editIsArchived}
                      onChange={(e) => setEditIsArchived(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>

                <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-white/[0.08]">
                  <button
                    type="button"
                    onClick={() => setEditingEvent(null)}
                    className="rounded-lg px-4 py-2 text-zinc-400 hover:text-white transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdatingEvent}
                    className="rounded-lg bg-white px-5 py-2 font-semibold text-black hover:bg-zinc-200 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {isUpdatingEvent ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Guardando...</span>
                      </>
                    ) : (
                      <span>Guardar Cambios</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL: SINGLE QR VIEW & DOWNLOAD                                         */}
        {/* ========================================================================= */}
        {activeQRModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="w-full max-w-sm rounded-2xl border border-white/20 bg-zinc-950 p-6 text-center shadow-2xl relative">
              <button
                onClick={() => setActiveQRModal(null)}
                className="absolute right-4 top-4 text-xs font-mono text-zinc-500 hover:text-white"
              >
                ✕
              </button>

              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                Credencial Digital
              </span>
              <h3 className="text-base font-bold text-white mt-1">
                {activeQRModal.full_name}
              </h3>
              <p className="text-xs text-zinc-400 font-mono mt-0.5">
                Doc: {activeQRModal.document_number}
              </p>

              <div className="my-5 mx-auto flex h-48 w-48 items-center justify-center rounded-xl bg-white p-2 shadow-inner">
                {modalQRDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={modalQRDataUrl}
                    alt="Código QR"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <QrCode className="h-10 w-10 text-zinc-400 animate-spin" />
                )}
              </div>

              <div className="flex items-center justify-center gap-2 mb-4">
                <span className="truncate max-w-[200px] text-[10px] font-mono text-zinc-500 bg-zinc-900 px-2 py-1 rounded border border-white/5">
                  {activeQRModal.qr_token}
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(activeQRModal.qr_token);
                    setCopiedToken(true);
                    setTimeout(() => setCopiedToken(false), 2000);
                  }}
                  className="rounded bg-zinc-900 border border-white/10 p-1 text-zinc-400 hover:text-white"
                  title="Copiar UUID"
                >
                  {copiedToken ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (modalQRDataUrl) {
                      downloadDataUrl(
                        modalQRDataUrl,
                        `QR_${activeQRModal.document_number}_${activeQRModal.full_name.replace(/\s+/g, "_")}.png`
                      );
                    }
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-white py-2 text-xs font-semibold text-black hover:bg-zinc-200 transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Descargar PNG</span>
                </button>

                <button
                  onClick={() => setActiveQRModal(null)}
                  className="rounded-lg border border-white/10 px-4 py-2 text-xs text-zinc-400 hover:text-white transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.08] py-4 text-center text-xs text-zinc-600 font-mono">
        GPQR Dashboard
      </footer>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black flex items-center justify-center text-xs font-mono text-zinc-500">
          Cargando Dashboard GPQR...
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}

