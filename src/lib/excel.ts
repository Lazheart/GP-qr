import * as XLSX from "xlsx";
import { RegistrationItem } from "./db";

export interface ParsedAttendeeRow {
  document_number: string;
  full_name: string;
  email?: string;
  phone?: string;
  isValid: boolean;
  error?: string;
}

export interface ParseExcelResult {
  rows: ParsedAttendeeRow[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
}

/**
 * Normaliza nombres de encabezados para mapeo flexible
 */
function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Lee un archivo File (.xlsx, .xls o .csv) y extrae los participantes
 */
export async function parseExcelOrCsvFile(file: File): Promise<ParseExcelResult> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // Convert to JSON array of objects
  const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(worksheet, {
    defval: "",
  });

  const parsedRows: ParsedAttendeeRow[] = [];
  const seenDocuments = new Set<string>();

  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i];
    let docNumber = "";
    let fullName = "";
    let email = "";
    let phone = "";

    for (const [key, val] of Object.entries(raw)) {
      const normKey = normalizeHeader(key);
      const strVal = String(val).trim();

      if (
        normKey.includes("dni") ||
        normKey.includes("cedula") ||
        normKey.includes("documento") ||
        normKey.includes("identificacion") ||
        normKey.includes("rut") ||
        normKey.includes("doc")
      ) {
        if (!docNumber) docNumber = strVal;
      } else if (
        normKey.includes("nombre") ||
        normKey.includes("fullname") ||
        normKey.includes("asistente") ||
        normKey.includes("participante") ||
        normKey.includes("name")
      ) {
        if (!fullName) fullName = strVal;
      } else if (normKey.includes("email") || normKey.includes("correo")) {
        if (!email) email = strVal;
      } else if (
        normKey.includes("telefono") ||
        normKey.includes("celular") ||
        normKey.includes("phone") ||
        normKey.includes("movil")
      ) {
        if (!phone) phone = strVal;
      }
    }

    // Si no encontró por coincidencia semántica, intenta por posición
    const values = Object.values(raw).map((v) => String(v).trim());
    if (!docNumber && values[0]) docNumber = values[0];
    if (!fullName && values[1]) fullName = values[1];
    if (!email && values[2] && values[2].includes("@")) email = values[2];
    if (!phone && values[3]) phone = values[3];

    let isValid = true;
    let error = "";

    if (!docNumber) {
      isValid = false;
      error = "Falta número de documento / DNI";
    } else if (!fullName) {
      isValid = false;
      error = "Falta nombre del asistente";
    } else if (seenDocuments.has(docNumber)) {
      isValid = false;
      error = "Documento duplicado en este archivo";
    }

    if (docNumber) {
      seenDocuments.add(docNumber);
    }

    parsedRows.push({
      document_number: docNumber,
      full_name: fullName,
      email: email || undefined,
      phone: phone || undefined,
      isValid,
      error: error || undefined,
    });
  }

  const validRows = parsedRows.filter((r) => r.isValid).length;

  return {
    rows: parsedRows,
    totalRows: parsedRows.length,
    validRows,
    invalidRows: parsedRows.length - validRows,
  };
}

/**
 * Neutraliza fórmulas maliciosas en celdas de usuario (CSV/Excel Formula Injection).
 * Valores que inician con '=', '+', '-', '@', tabulaciones o retornos de carro se prefijan con apóstrofe.
 */
export function defangFormula(value: string | null | undefined): string {
  if (!value) return "";
  const str = String(value).trim();
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

/**
 * Exporta la lista de participantes y estados de asistencia a Excel (.xlsx)
 * Garantiza que NO se expongan tokens QR ni secretos, y sanitiza fórmulas.
 */
export function exportAttendanceToExcel(
  registrations: RegistrationItem[],
  eventName: string = "Evento"
) {
  const exportData = registrations.map((r, index) => ({
    N: index + 1,
    Documento: defangFormula(r.document_number),
    "Nombre y Apellidos": defangFormula(r.full_name),
    "Correo Electrónico": defangFormula(r.email) || "-",
    Teléfono: defangFormula(r.phone) || "-",
    Estado: r.status === "registered" ? "Inscrito" : "Cancelado",
    "Asistencia Registrada": r.checked_in_at
      ? new Date(r.checked_in_at).toLocaleString()
      : "No asistió",
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Asistencia");

  const cleanEventName = eventName.replace(/[^a-zA-Z0-9_-]/g, "_");
  const fileName = `Asistencia_${cleanEventName}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}

/**
 * Genera y descarga una plantilla modelo de Excel para importación de asistentes
 */
export function downloadExcelTemplate() {
  const sampleData = [
    {
      "DNI / Documento": "71829304",
      "Nombre Completo": "Alejandro Morales Vera",
      "Correo Electrónico": "alejandro.morales@example.com",
      "Teléfono": "+51 981 234 567",
    },
    {
      "DNI / Documento": "44918203",
      "Nombre Completo": "Camila Fernanda Silva",
      "Correo Electrónico": "camila.silva@example.com",
      "Teléfono": "+51 992 345 678",
    },
    {
      "DNI / Documento": "10293847",
      "Nombre Completo": "Rodrigo Andrés Cárdenas",
      "Correo Electrónico": "rodrigo.cardenas@example.com",
      "Teléfono": "+51 913 456 789",
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Asistentes");
  XLSX.writeFile(workbook, "Plantilla_Importar_Asistentes_GPQR.xlsx");
}

