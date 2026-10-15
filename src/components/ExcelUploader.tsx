"use client";

import React, { useState, useRef } from "react";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  FileArchive,
  Download,
  Trash2,
  Loader2,
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  parseExcelOrCsvFile,
  ParsedAttendeeRow,
  ParseExcelResult,
} from "@/lib/excel";
import { generateQRCodesZip } from "@/lib/qr";
import {
  EventItem,
  RegistrationItem,
  getStoredRegistrations,
  saveRegistrations,
} from "@/lib/db";

interface ExcelUploaderProps {
  events: EventItem[];
  currentEventId: string;
  onImportCompleted?: () => void;
}

export function ExcelUploader({
  events,
  currentEventId,
  onImportCompleted,
}: ExcelUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParseExcelResult | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isGeneratingZip, setIsGeneratingZip] = useState(false);
  const [importSuccessMessage, setImportSuccessMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedEvent = events.find((e) => e.id === currentEventId) || events[0];

  const handleFileChange = async (selectedFile: File) => {
    if (!selectedFile) return;
    setFile(selectedFile);
    setIsParsing(true);
    setImportSuccessMessage(null);

    try {
      const result = await parseExcelOrCsvFile(selectedFile);
      setParsedData(result);
    } catch (err) {
      console.error("Error al leer archivo:", err);
      alert("Hubo un error al procesar el archivo. Asegúrate de que sea un archivo válido (.xlsx, .xls o .csv).");
    } finally {
      setIsParsing(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleImportAttendees = async () => {
    if (!parsedData || !selectedEvent) return;
    setIsImporting(true);

    try {
      const validRows = parsedData.rows.filter((r) => r.isValid);
      const existing = getStoredRegistrations();

      // Filtrar los que no existan ya con ese documento en este evento
      const newRegistrations: RegistrationItem[] = [];
      let skippedCount = 0;

      for (const row of validRows) {
        const alreadyExists = existing.some(
          (r) =>
            r.event_id === selectedEvent.id &&
            r.document_number.trim() === row.document_number.trim()
        );

        if (alreadyExists) {
          skippedCount++;
          continue;
        }

        const token = `GPQR-${selectedEvent.id.slice(0, 8)}-${row.document_number.trim()}`;
        newRegistrations.push({
          id: "reg-" + Math.random().toString(36).substring(2, 9),
          event_id: selectedEvent.id,
          document_number: row.document_number.trim(),
          full_name: row.full_name.trim(),
          email: row.email,
          phone: row.phone,
          qr_token: token,
          status: "registered",
          checked_in_at: null,
          created_at: new Date().toISOString(),
        });
      }

      saveRegistrations([...newRegistrations, ...existing]);

      setImportSuccessMessage(
        `Se importaron con éxito ${newRegistrations.length} asistentes.` +
          (skippedCount > 0 ? ` (${skippedCount} ya estaban registrados).` : "")
      );

      if (onImportCompleted) {
        onImportCompleted();
      }
    } catch (err) {
      console.error("Error al importar:", err);
      alert("Error al guardar asistentes.");
    } finally {
      setIsImporting(false);
    }
  };

  const handleDownloadZip = async () => {
    if (!parsedData || !selectedEvent) return;
    setIsGeneratingZip(true);

    try {
      const validRows = parsedData.rows.filter((r) => r.isValid);
      const tempRegistrations: RegistrationItem[] = validRows.map((row) => ({
        id: "temp-" + row.document_number,
        event_id: selectedEvent.id,
        document_number: row.document_number,
        full_name: row.full_name,
        email: row.email,
        phone: row.phone,
        qr_token: `GPQR-${selectedEvent.id.slice(0, 8)}-${row.document_number.trim()}`,
        status: "registered",
        checked_in_at: null,
        created_at: new Date().toISOString(),
      }));

      const zipBlob = await generateQRCodesZip(tempRegistrations, selectedEvent.name);
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Pack_QRs_${selectedEvent.name.replace(/\s+/g, "_")}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error creando ZIP:", err);
      alert("No se pudo generar el archivo ZIP.");
    } finally {
      setIsGeneratingZip(false);
    }
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        DNI: "72938401",
        Nombre: "Gabriel Pino",
        Correo: "gabriel.pino@ejemplo.com",
        Telefono: "+51 987 654 321",
      },
      {
        DNI: "44892019",
        Nombre: "Valeria Mendoza",
        Correo: "valeria.mendoza@ejemplo.com",
        Telefono: "+51 991 234 567",
      },
      {
        DNI: "10982344",
        Nombre: "Carlos Silva",
        Correo: "carlos.silva@ejemplo.com",
        Telefono: "+51 912 345 678",
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Plantilla_Participantes");
    XLSX.writeFile(workbook, "Plantilla_Asistentes_GPQR.xlsx");
  };

  const handleClear = () => {
    setFile(null);
    setParsedData(null);
    setImportSuccessMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="w-full rounded-xl border border-white/[0.08] bg-zinc-950/60 p-6 backdrop-blur-sm">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-white" />
            <h3 className="text-base font-medium text-white tracking-tight">
              Carga Masiva de Participantes (Excel / CSV)
            </h3>
          </div>
          <p className="mt-1 text-xs text-zinc-400">
            Sube listas masivas de invitados y genera automáticamente sus códigos QR y tokens.
          </p>
        </div>

        <button
          type="button"
          onClick={handleDownloadTemplate}
          className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/[0.08] hover:text-white transition-colors"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Descargar Plantilla Excel</span>
        </button>
      </div>

      {/* Zona de Drop */}
      {!parsedData && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => fileInputRef.current?.click()}
          className="group relative flex flex-col items-center justify-center rounded-lg border border-dashed border-white/15 bg-black/40 p-10 text-center transition-colors hover:border-white/30 hover:bg-black/60 cursor-pointer"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx, .xls, .csv"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileChange(e.target.files[0]);
              }
            }}
          />

          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.05] border border-white/10 mb-3 group-hover:scale-105 transition-transform">
            <Upload className="h-5 w-5 text-zinc-300" />
          </div>

          <p className="text-xs font-medium text-white">
            Arrastra tu archivo Excel (.xlsx, .xls) o CSV aquí
          </p>
          <p className="mt-1 text-[11px] text-zinc-500">
            o haz clic para explorar en tu computadora
          </p>

          <div className="mt-4 flex items-center gap-2 text-[10px] font-mono text-zinc-400">
            <span className="rounded bg-white/5 px-2 py-0.5 border border-white/5">
              Columnas requeridas: DNI/Documento y Nombre
            </span>
          </div>

          {isParsing && (
            <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/80 backdrop-blur-xs">
              <div className="flex items-center gap-2 text-xs text-zinc-300">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Analizando archivo...</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Vista previa y acciones tras subir */}
      {parsedData && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/[0.08] bg-black/40 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-white/10">
                <FileSpreadsheet className="h-5 w-5 text-zinc-200" />
              </div>
              <div>
                <p className="text-xs font-medium text-white">{file?.name}</p>
                <div className="flex items-center gap-3 text-[11px] text-zinc-400 font-mono mt-0.5">
                  <span>{parsedData.totalRows} filas detectadas</span>
                  <span className="text-emerald-400">
                    {parsedData.validRows} válidas
                  </span>
                  {parsedData.invalidRows > 0 && (
                    <span className="text-red-400">
                      {parsedData.invalidRows} con errores
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClear}
                className="flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs text-zinc-400 hover:text-red-400 hover:border-red-500/20 transition-colors"
                title="Quitar archivo"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Quitar</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadZip}
                disabled={isGeneratingZip || parsedData.validRows === 0}
                className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-white/[0.1] hover:text-white transition-colors disabled:opacity-40"
              >
                {isGeneratingZip ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FileArchive className="h-3.5 w-3.5" />
                )}
                <span>Descargar Pack ZIP QRs</span>
              </button>

              <button
                type="button"
                onClick={handleImportAttendees}
                disabled={isImporting || parsedData.validRows === 0}
                className="flex items-center gap-1.5 rounded-md bg-white px-3.5 py-1.5 text-xs font-medium text-black hover:bg-zinc-200 transition-colors disabled:opacity-40"
              >
                {isImporting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                <span>Importar {parsedData.validRows} al Evento</span>
              </button>
            </div>
          </div>

          {importSuccessMessage && (
            <div className="flex items-center gap-2 rounded-md border border-emerald-500/20 bg-emerald-950/20 px-3.5 py-2 text-xs text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              <span>{importSuccessMessage}</span>
            </div>
          )}

          {/* Tabla de previsualización */}
          <div className="overflow-hidden rounded-lg border border-white/[0.08] bg-black/60">
            <div className="max-h-60 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-zinc-950/90 backdrop-blur-xs text-[11px] font-mono text-zinc-400 border-b border-white/[0.08]">
                  <tr>
                    <th className="py-2 px-3">Estado</th>
                    <th className="py-2 px-3">Documento</th>
                    <th className="py-2 px-3">Nombre Completo</th>
                    <th className="py-2 px-3">Correo</th>
                    <th className="py-2 px-3">Teléfono</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04] text-zinc-300 font-mono">
                  {parsedData.rows.slice(0, 50).map((row, idx) => (
                    <tr
                      key={idx}
                      className={row.isValid ? "hover:bg-white/[0.02]" : "bg-red-950/10"}
                    >
                      <td className="py-2 px-3">
                        {row.isValid ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" /> Válido
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] text-red-400"
                            title={row.error}
                          >
                            <AlertCircle className="h-3 w-3" /> {row.error}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-white">{row.document_number || "-"}</td>
                      <td className="py-2 px-3 text-zinc-200">{row.full_name || "-"}</td>
                      <td className="py-2 px-3 text-zinc-400">{row.email || "-"}</td>
                      <td className="py-2 px-3 text-zinc-400">{row.phone || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {parsedData.rows.length > 50 && (
              <div className="border-t border-white/[0.06] p-2 text-center text-[10px] text-zinc-500 font-mono">
                Mostrando las primeras 50 filas de {parsedData.rows.length} en total.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
