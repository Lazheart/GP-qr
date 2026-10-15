import { createClient } from "./supabase/client";

/**
 * Types aligned directly with supabase/creacion.sql
 */

export type EventStatus = "draft" | "open" | "closed" | "cancelled";
export type RegistrationStatus = "registered" | "cancelled";
export type ScanResult =
  | "accepted"
  | "already_attended"
  | "invalid_qr"
  | "cancelled_registration"
  | "event_not_open"
  | "not_authorized";

export interface EventItem {
  id: string; // uuid
  created_by?: string; // uuid references auth.users(id)
  name: string;
  description?: string | null;
  location?: string | null;
  starts_at: string; // timestamptz
  ends_at: string; // timestamptz
  status: EventStatus;
  archived_at?: string | null;
  created_at: string; // timestamptz
  updated_at?: string; // timestamptz
}

export interface RegistrationItem {
  id: string; // uuid
  event_id: string; // uuid references events(id)
  document_number: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  qr_token: string; // uuid not null unique default gen_random_uuid()
  status: RegistrationStatus;
  registered_by?: string; // uuid references auth.users(id)
  registered_at?: string; // timestamptz
  checked_in_at: string | null; // timestamptz
  checked_in_by?: string | null; // uuid references auth.users(id)
  created_at: string;
  updated_at?: string;
}

export interface AttendanceLogItem {
  id: number | string;
  event_id: string | null;
  registration_id?: string | null;
  scanner_id?: string | null;
  scanner_name?: string;
  scanned_at: string;
  result: ScanResult;
  participant_name?: string;
  document_number?: string;
}

export interface EventStats {
  total: number;
  checkedIn: number;
  pending: number;
  attendanceRate: number;
}

export interface ScanResultResponse {
  result: ScanResult;
  message: string;
  registration?: RegistrationItem;
  scannedAt: string;
  participant_name?: string;
}

// No demo/seed data — only real Supabase data is displayed
const DEFAULT_EVENTS: EventItem[] = [];
const DEFAULT_REGISTRATIONS: RegistrationItem[] = [];

const STORAGE_KEY_EVENTS = "gpqr_events_data_v3";
const STORAGE_KEY_REGISTRATIONS = "gpqr_registrations_data_v3";
const STORAGE_KEY_LOGS = "gpqr_logs_data_v3";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

// Helper to check if a string is a valid UUID
export function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str.trim());
}

/**
 * Direct Supabase Async Operations
 */

export async function fetchEventsFromSupabase(): Promise<{ data: EventItem[] | null; error: Error | null }> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("Supabase fetchEvents error:", error.message);
      return { data: null, error: new Error(error.message) };
    }
    return { data: (data as EventItem[]) || [], error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

export async function createEventInSupabase(
  event: Omit<EventItem, "id" | "created_at" | "updated_at">
): Promise<{ data: EventItem | null; error: Error | null }> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("events")
      .insert({
        name: event.name.trim(),
        description: event.description?.trim() || null,
        location: event.location?.trim() || null,
        starts_at: event.starts_at,
        ends_at: event.ends_at,
        status: event.status || "draft",
      })
      .select()
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }
    return { data: data as EventItem, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

export async function fetchRegistrationsFromSupabase(
  eventId: string
): Promise<{ data: RegistrationItem[] | null; error: Error | null }> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("event_registrations")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });

    if (error) {
      return { data: null, error: new Error(error.message) };
    }
    return { data: (data as RegistrationItem[]) || [], error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

export async function createRegistrationInSupabase(
  eventId: string,
  reg: { document_number: string; full_name: string; email?: string; phone?: string; qr_token?: string }
): Promise<{ data: RegistrationItem | null; error: Error | null }> {
  try {
    const supabase = createClient();
    const qrToken = reg.qr_token && isValidUUID(reg.qr_token) ? reg.qr_token : crypto.randomUUID();

    const { data, error } = await supabase
      .from("event_registrations")
      .insert({
        event_id: eventId,
        document_number: reg.document_number.trim(),
        full_name: reg.full_name.trim(),
        email: reg.email?.trim() || null,
        phone: reg.phone?.trim() || null,
        qr_token: qrToken,
        status: "registered",
      })
      .select()
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }
    return { data: data as RegistrationItem, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

export async function createBulkRegistrationsInSupabase(
  eventId: string,
  rows: Array<{ document_number: string; full_name: string; email?: string; phone?: string }>
): Promise<{ inserted: number; errors: string[] }> {
  try {
    const supabase = createClient();
    const payload = rows.map((r) => ({
      event_id: eventId,
      document_number: r.document_number.trim(),
      full_name: r.full_name.trim(),
      email: r.email?.trim() || null,
      phone: r.phone?.trim() || null,
      qr_token: crypto.randomUUID(),
      status: "registered",
    }));

    const { data, error } = await supabase
      .from("event_registrations")
      .insert(payload)
      .select();

    if (error) {
      return { inserted: 0, errors: [error.message] };
    }
    return { inserted: data ? data.length : payload.length, errors: [] };
  } catch (err) {
    return { inserted: 0, errors: [String(err)] };
  }
}

export async function scanEventQRWithSupabase(
  eventId: string,
  qrToken: string
): Promise<ScanResultResponse> {
  const token = qrToken.trim();

  try {
    const supabase = createClient();

    // Call Supabase RPC scan_event_qr(p_event_id uuid, p_qr_token uuid)
    if (isValidUUID(token) && isValidUUID(eventId)) {
      const { data, error } = await supabase.rpc("scan_event_qr", {
        p_event_id: eventId,
        p_qr_token: token,
      });

      if (!error && data && data.length > 0) {
        const row = data[0];
        const resType = row.scan_result as ScanResult;
        let msg = "";
        switch (resType) {
          case "accepted":
            msg = `¡Asistencia confirmada para ${row.participant_name || "Participante"}!`;
            break;
          case "already_attended":
            msg = `¡Atención! Asistencia ya registrada previamente para ${row.participant_name || "Participante"}.`;
            break;
          case "invalid_qr":
            msg = "El código QR es inválido o no pertenece a este evento.";
            break;
          case "cancelled_registration":
            msg = "La inscripción para este participante está cancelada.";
            break;
          case "event_not_open":
            msg = "El evento no se encuentra en estado abierto.";
            break;
          case "not_authorized":
            msg = "No tienes permisos de escáner para este evento.";
            break;
          default:
            msg = `Resultado: ${resType}`;
        }
        return {
          result: resType,
          message: msg,
          scannedAt: row.scanned_at || new Date().toISOString(),
          participant_name: row.participant_name,
        };
      }
    }
  } catch (err) {
    console.warn("RPC scan_event_qr failed, using local verification fallback:", err);
  }

  // Graceful fallback to client verification logic
  return processScanToken(eventId, token);
}

/**
 * Local Fallback & State Persistence (Guarantees zero-downtime offline testing)
 */

export function getStoredEvents(): EventItem[] {
  if (!isBrowser()) return [];
  const stored = localStorage.getItem(STORAGE_KEY_EVENTS);
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveEvents(events: EventItem[]) {
  if (isBrowser()) {
    localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(events));
  }
}

export function getStoredRegistrations(eventId?: string): RegistrationItem[] {
  if (!isBrowser()) return [];
  const stored = localStorage.getItem(STORAGE_KEY_REGISTRATIONS);
  if (!stored) return eventId ? [] : [];
  let list: RegistrationItem[] = [];
  try {
    const parsed = JSON.parse(stored);
    list = Array.isArray(parsed) ? parsed : [];
  } catch {
    list = [];
  }
  return eventId ? list.filter((r) => r.event_id === eventId) : list;
}

export function saveRegistrations(registrations: RegistrationItem[]) {
  if (isBrowser()) {
    localStorage.setItem(STORAGE_KEY_REGISTRATIONS, JSON.stringify(registrations));
  }
}

export function getStoredLogs(eventId?: string): AttendanceLogItem[] {
  if (!isBrowser()) return [];
  const stored = localStorage.getItem(STORAGE_KEY_LOGS);
  let list: AttendanceLogItem[] = [];
  if (stored) {
    try {
      list = JSON.parse(stored);
    } catch {
      list = [];
    }
  }
  return eventId ? list.filter((l) => l.event_id === eventId) : list;
}

export function saveLogs(logs: AttendanceLogItem[]) {
  if (isBrowser()) {
    localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(logs));
  }
}

export function calculateEventStats(
  eventId: string,
  registrationsList?: RegistrationItem[]
): EventStats {
  const registrations = registrationsList ?? getStoredRegistrations(eventId);
  const total = registrations.length;
  const checkedIn = registrations.filter((r) => r.checked_in_at !== null).length;
  const pending = total - checkedIn;
  const attendanceRate = total > 0 ? Math.round((checkedIn / total) * 100) : 0;
  return { total, checkedIn, pending, attendanceRate };
}

export function processScanToken(
  eventId: string,
  rawToken: string,
  scannerName: string = "Terminal Web"
): ScanResultResponse {
  const token = rawToken.trim();
  const events = getStoredEvents();
  const event = events.find((e) => e.id === eventId);
  const now = new Date().toISOString();

  if (!event || event.status !== "open") {
    const logItem: AttendanceLogItem = {
      id: "log-" + Math.random().toString(36).substring(2, 9),
      event_id: eventId,
      scanner_name: scannerName,
      scanned_at: now,
      result: "event_not_open",
    };
    saveLogs([logItem, ...getStoredLogs()]);
    return {
      result: "event_not_open",
      message: "El evento seleccionado no se encuentra en estado abierto.",
      scannedAt: now,
    };
  }

  const allRegistrations = getStoredRegistrations();
  const regIndex = allRegistrations.findIndex(
    (r) =>
      r.event_id === eventId &&
      (r.qr_token.toLowerCase() === token.toLowerCase() ||
        r.document_number.toLowerCase() === token.toLowerCase() ||
        (token.includes(r.qr_token) && r.qr_token.length > 5))
  );

  if (regIndex === -1) {
    const logItem: AttendanceLogItem = {
      id: "log-" + Math.random().toString(36).substring(2, 9),
      event_id: eventId,
      scanner_name: scannerName,
      scanned_at: now,
      result: "invalid_qr",
    };
    saveLogs([logItem, ...getStoredLogs()]);
    return {
      result: "invalid_qr",
      message: "Código QR no reconocido o no pertenece a este evento.",
      scannedAt: now,
    };
  }

  const targetReg = allRegistrations[regIndex];

  if (targetReg.status === "cancelled") {
    const logItem: AttendanceLogItem = {
      id: "log-" + Math.random().toString(36).substring(2, 9),
      event_id: eventId,
      registration_id: targetReg.id,
      scanner_name: scannerName,
      scanned_at: now,
      result: "cancelled_registration",
      participant_name: targetReg.full_name,
      document_number: targetReg.document_number,
    };
    saveLogs([logItem, ...getStoredLogs()]);
    return {
      result: "cancelled_registration",
      message: `La inscripción de ${targetReg.full_name} fue cancelada.`,
      registration: targetReg,
      participant_name: targetReg.full_name,
      scannedAt: now,
    };
  }

  if (targetReg.checked_in_at !== null) {
    const formattedCheckin = new Date(targetReg.checked_in_at).toLocaleTimeString();
    const logItem: AttendanceLogItem = {
      id: "log-" + Math.random().toString(36).substring(2, 9),
      event_id: eventId,
      registration_id: targetReg.id,
      scanner_name: scannerName,
      scanned_at: now,
      result: "already_attended",
      participant_name: targetReg.full_name,
      document_number: targetReg.document_number,
    };
    saveLogs([logItem, ...getStoredLogs()]);
    return {
      result: "already_attended",
      message: `¡Atención! Asistencia ya registrada previamente a las ${formattedCheckin}.`,
      registration: targetReg,
      participant_name: targetReg.full_name,
      scannedAt: now,
    };
  }

  // Mark attendance
  const updatedReg: RegistrationItem = {
    ...targetReg,
    checked_in_at: now,
    updated_at: now,
  };
  allRegistrations[regIndex] = updatedReg;
  saveRegistrations(allRegistrations);

  const logItem: AttendanceLogItem = {
    id: "log-" + Math.random().toString(36).substring(2, 9),
    event_id: eventId,
    registration_id: updatedReg.id,
    scanner_name: scannerName,
    scanned_at: now,
    result: "accepted",
    participant_name: updatedReg.full_name,
    document_number: updatedReg.document_number,
  };
  saveLogs([logItem, ...getStoredLogs()]);

  return {
    result: "accepted",
    message: `¡Asistencia confirmada exitosamente para ${updatedReg.full_name}!`,
    registration: updatedReg,
    participant_name: updatedReg.full_name,
    scannedAt: now,
  };
}
