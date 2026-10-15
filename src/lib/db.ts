export interface EventItem {
  id: string;
  name: string;
  description?: string;
  location?: string;
  starts_at: string;
  ends_at: string;
  status: "draft" | "open" | "closed" | "cancelled";
  created_at: string;
}

export interface RegistrationItem {
  id: string;
  event_id: string;
  document_number: string;
  full_name: string;
  email?: string;
  phone?: string;
  qr_token: string;
  status: "registered" | "cancelled";
  checked_in_at: string | null;
  created_at: string;
}

export interface AttendanceLogItem {
  id: string;
  event_id: string;
  registration_id?: string;
  scanner_name?: string;
  scanned_at: string;
  result: "accepted" | "already_attended" | "invalid_qr" | "cancelled_registration" | "event_not_open";
  participant_name?: string;
  document_number?: string;
}

export interface EventStats {
  total: number;
  checkedIn: number;
  pending: number;
  attendanceRate: number;
}

const STORAGE_KEY_EVENTS = "gpqr_events_data_v1";
const STORAGE_KEY_REGISTRATIONS = "gpqr_registrations_data_v1";
const STORAGE_KEY_LOGS = "gpqr_logs_data_v1";

const DEFAULT_EVENTS: EventItem[] = [
  {
    id: "evt-tech-summit-2026",
    name: "Tech Summit GPQR 2026",
    description: "Conferencia Magistral de Innovación, Software y Transformación Digital.",
    location: "Centro de Convenciones & Streaming Global",
    starts_at: new Date(Date.now() - 3600000).toISOString(),
    ends_at: new Date(Date.now() + 86400000 * 2).toISOString(),
    status: "open",
    created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
  {
    id: "evt-hackathon-ia",
    name: "Hackathon Nacional de IA & Cloud",
    description: "Competencia de desarrollo ágil con modelos de lenguaje y automatización.",
    location: "Campus Tecnológico Central",
    starts_at: new Date(Date.now() + 86400000 * 7).toISOString(),
    ends_at: new Date(Date.now() + 86400000 * 8).toISOString(),
    status: "draft",
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
];

const DEFAULT_REGISTRATIONS: RegistrationItem[] = [
  {
    id: "reg-001",
    event_id: "evt-tech-summit-2026",
    document_number: "72938401",
    full_name: "Gabriel Pino",
    email: "gabriel.pino@example.com",
    phone: "+51 987 654 321",
    qr_token: "gpqr-token-gabriel-pino-72938401",
    status: "registered",
    checked_in_at: new Date(Date.now() - 1800000).toISOString(),
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: "reg-002",
    event_id: "evt-tech-summit-2026",
    document_number: "44892019",
    full_name: "Valeria Mendoza Cruz",
    email: "valeria.mendoza@example.com",
    phone: "+51 991 234 567",
    qr_token: "gpqr-token-valeria-mendoza-44892019",
    status: "registered",
    checked_in_at: null,
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: "reg-003",
    event_id: "evt-tech-summit-2026",
    document_number: "10982344",
    full_name: "Carlos Eduardo Silva",
    email: "carlos.silva@example.com",
    phone: "+51 912 345 678",
    qr_token: "gpqr-token-carlos-silva-10982344",
    status: "registered",
    checked_in_at: null,
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: "reg-004",
    event_id: "evt-tech-summit-2026",
    document_number: "88231902",
    full_name: "Elena Lucía Morales",
    email: "elena.morales@example.com",
    phone: "+51 934 567 890",
    qr_token: "gpqr-token-elena-morales-88231902",
    status: "registered",
    checked_in_at: new Date(Date.now() - 900000).toISOString(),
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
];

const DEFAULT_LOGS: AttendanceLogItem[] = [
  {
    id: "log-001",
    event_id: "evt-tech-summit-2026",
    registration_id: "reg-001",
    scanner_name: "Terminal Acceso Principal",
    scanned_at: new Date(Date.now() - 1800000).toISOString(),
    result: "accepted",
    participant_name: "Gabriel Pino",
    document_number: "72938401",
  },
  {
    id: "log-002",
    event_id: "evt-tech-summit-2026",
    registration_id: "reg-004",
    scanner_name: "Terminal Acceso Principal",
    scanned_at: new Date(Date.now() - 900000).toISOString(),
    result: "accepted",
    participant_name: "Elena Lucía Morales",
    document_number: "88231902",
  },
];

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function getStoredEvents(): EventItem[] {
  if (!isBrowser()) return DEFAULT_EVENTS;
  const stored = localStorage.getItem(STORAGE_KEY_EVENTS);
  if (!stored) {
    localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(DEFAULT_EVENTS));
    return DEFAULT_EVENTS;
  }
  try {
    return JSON.parse(stored);
  } catch {
    return DEFAULT_EVENTS;
  }
}

export function saveEvents(events: EventItem[]) {
  if (isBrowser()) {
    localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(events));
  }
}

export function getStoredRegistrations(eventId?: string): RegistrationItem[] {
  if (!isBrowser()) {
    return eventId
      ? DEFAULT_REGISTRATIONS.filter((r) => r.event_id === eventId)
      : DEFAULT_REGISTRATIONS;
  }
  const stored = localStorage.getItem(STORAGE_KEY_REGISTRATIONS);
  let list: RegistrationItem[] = DEFAULT_REGISTRATIONS;
  if (!stored) {
    localStorage.setItem(STORAGE_KEY_REGISTRATIONS, JSON.stringify(DEFAULT_REGISTRATIONS));
  } else {
    try {
      list = JSON.parse(stored);
    } catch {
      list = DEFAULT_REGISTRATIONS;
    }
  }
  return eventId ? list.filter((r) => r.event_id === eventId) : list;
}

export function saveRegistrations(registrations: RegistrationItem[]) {
  if (isBrowser()) {
    localStorage.setItem(STORAGE_KEY_REGISTRATIONS, JSON.stringify(registrations));
  }
}

export function getStoredLogs(eventId?: string): AttendanceLogItem[] {
  if (!isBrowser()) {
    return eventId ? DEFAULT_LOGS.filter((l) => l.event_id === eventId) : DEFAULT_LOGS;
  }
  const stored = localStorage.getItem(STORAGE_KEY_LOGS);
  let list: AttendanceLogItem[] = DEFAULT_LOGS;
  if (!stored) {
    localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(DEFAULT_LOGS));
  } else {
    try {
      list = JSON.parse(stored);
    } catch {
      list = DEFAULT_LOGS;
    }
  }
  return eventId ? list.filter((l) => l.event_id === eventId) : list;
}

export function saveLogs(logs: AttendanceLogItem[]) {
  if (isBrowser()) {
    localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(logs));
  }
}

export function calculateEventStats(eventId: string): EventStats {
  const registrations = getStoredRegistrations(eventId);
  const total = registrations.length;
  const checkedIn = registrations.filter((r) => r.checked_in_at !== null).length;
  const pending = total - checkedIn;
  const attendanceRate = total > 0 ? Math.round((checkedIn / total) * 100) : 0;
  return { total, checkedIn, pending, attendanceRate };
}

export interface ScanResultResponse {
  result: "accepted" | "already_attended" | "invalid_qr" | "cancelled_registration" | "event_not_open";
  message: string;
  registration?: RegistrationItem;
  scannedAt: string;
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
      (r.qr_token === token ||
        r.document_number === token ||
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
      scannedAt: now,
    };
  }

  // Marcar asistencia como aceptada
  const updatedReg: RegistrationItem = {
    ...targetReg,
    checked_in_at: now,
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
    scannedAt: now,
  };
}
