"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Camera,
  CameraOff,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Volume2,
  VolumeX,
  History,
  QrCode,
} from "lucide-react";
import {
  EventItem,
  processScanToken,
  ScanResultResponse,
  getStoredLogs,
  AttendanceLogItem,
  getStoredRegistrations,
} from "@/lib/db";

interface QRScannerProps {
  events: EventItem[];
  currentEventId: string;
  onScanCompleted?: () => void;
}

export function QRScanner({
  events,
  currentEventId,
  onScanCompleted,
}: QRScannerProps) {
  const [manualToken, setManualToken] = useState("");
  const [cameraActive, setCameraActive] = useState(false);
  const [lastScanResult, setLastScanResult] = useState<ScanResultResponse | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [recentLogs, setRecentLogs] = useState<AttendanceLogItem[]>([]);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const selectedEvent = events.find((e) => e.id === currentEventId) || events[0];

  const refreshLogs = useCallback(() => {
    if (selectedEvent) {
      const logs = getStoredLogs(selectedEvent.id).slice(0, 8);
      setRecentLogs(logs);
    }
  }, [selectedEvent]);

  useEffect(() => {
    refreshLogs();
  }, [refreshLogs]);

  // Reproducir sonido sutil de feedback
  const playBeep = (type: "success" | "warning" | "error") => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === "success") {
        osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
        osc.start();
        osc.stop(ctx.currentTime + 0.18);
      } else if (type === "warning") {
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      } else {
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      }
    } catch (e) {
      console.warn("Audio Context error:", e);
    }
  };

  // Manejar el resultado de un escaneo
  const handleExecuteScan = async (rawToken: string) => {
    if (!rawToken.trim() || !selectedEvent) return;

    try {
      const { scanEventQRWithSupabase } = await import("@/lib/db");
      const res = await scanEventQRWithSupabase(selectedEvent.id, rawToken);
      setLastScanResult(res);

      if (res.result === "accepted") {
        playBeep("success");
      } else if (res.result === "already_attended") {
        playBeep("warning");
      } else {
        playBeep("error");
      }

      refreshLogs();
      if (onScanCompleted) onScanCompleted();
    } catch (err) {
      console.error("Error executing scan:", err);
    }
  };

  // Iniciar cámara web
  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err) {
      console.error("Camera access error:", err);
      setCameraError(
        "No se pudo acceder a la cámara. Comprueba los permisos en tu navegador o usa el ingreso manual de token."
      );
      setCameraActive(false);
    }
  };

  // Detener cámara
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  // Simulación de escaneo rápido con asistentes disponibles
  const currentRegistrations = selectedEvent
    ? getStoredRegistrations(selectedEvent.id)
    : [];

  return (
    <div className="w-full rounded-xl border border-white/[0.08] bg-zinc-950/60 p-6 backdrop-blur-sm">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400" />
            <h3 className="text-base font-medium text-white tracking-tight">
              Terminal de Control de Acceso & Escáner
            </h3>
          </div>
          <p className="mt-1 text-xs text-zinc-400">
            Valida asistencia en tiempo real mediante cámara o código manual para{" "}
            <span className="text-white font-medium">{selectedEvent?.name}</span>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs text-zinc-300 hover:text-white transition-colors"
            title="Activar/Desactivar sonido de confirmación"
          >
            {soundEnabled ? (
              <>
                <Volume2 className="h-3.5 w-3.5 text-zinc-300" />
                <span className="text-[11px]">Sonido ON</span>
              </>
            ) : (
              <>
                <VolumeX className="h-3.5 w-3.5 text-zinc-500" />
                <span className="text-[11px] text-zinc-500">Silencio</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Columna Izquierda: Visor de Cámara y Entrada Manual */}
        <div className="space-y-4 lg:col-span-7">
          {/* Contenedor de Cámara */}
          <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-white/10 bg-black flex flex-col items-center justify-center">
            {cameraActive ? (
              <div className="relative h-full w-full">
                <video
                  ref={videoRef}
                  className="h-full w-full object-cover"
                  playsInline
                  muted
                />
                {/* Cuadrante de enfoque minimalista */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="h-48 w-48 rounded-xl border border-white/30 relative flex items-center justify-center">
                    {/* Corners */}
                    <div className="absolute -top-1 -left-1 h-4 w-4 border-t-2 border-l-2 border-white" />
                    <div className="absolute -top-1 -right-1 h-4 w-4 border-t-2 border-r-2 border-white" />
                    <div className="absolute -bottom-1 -left-1 h-4 w-4 border-b-2 border-l-2 border-white" />
                    <div className="absolute -bottom-1 -right-1 h-4 w-4 border-b-2 border-r-2 border-white" />
                    {/* Subtle scanline animation */}
                    <div className="absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-white/70 to-transparent animate-pulse" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.04] border border-white/10 mb-3">
                  <Camera className="h-5 w-5 text-zinc-400" />
                </div>
                <p className="text-xs font-medium text-white">Cámara en espera</p>
                <p className="mt-1 text-[11px] text-zinc-500 max-w-xs">
                  Activa la cámara del dispositivo para escanear boletos impresos o pantallas móviles al instante.
                </p>

                {cameraError && (
                  <p className="mt-2 text-[11px] text-red-400 max-w-xs">{cameraError}</p>
                )}

                <button
                  type="button"
                  onClick={startCamera}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-white px-4 py-2 text-xs font-medium text-black hover:bg-zinc-200 transition-colors"
                >
                  <Camera className="h-3.5 w-3.5" />
                  <span>Encender Cámara</span>
                </button>
              </div>
            )}

            {cameraActive && (
              <div className="absolute bottom-3 right-3">
                <button
                  type="button"
                  onClick={stopCamera}
                  className="flex items-center gap-1.5 rounded-md bg-zinc-900/90 border border-white/10 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800 transition-colors"
                >
                  <CameraOff className="h-3.5 w-3.5" />
                  <span>Apagar</span>
                </button>
              </div>
            )}
          </div>

          {/* Entrada Manual de Token / DNI */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleExecuteScan(manualToken);
              setManualToken("");
            }}
            className="flex gap-2"
          >
            <div className="relative flex-1">
              <input
                type="text"
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                placeholder="Ingresar DNI o Token QR manual (Ej: 72938401)..."
                className="w-full rounded-md border border-white/10 bg-black/60 px-3 py-2 text-xs text-white placeholder-zinc-600 focus:border-white/30 focus:outline-none focus:ring-1 focus:ring-white/20 font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={!manualToken.trim()}
              className="flex items-center gap-1.5 rounded-md bg-white px-4 py-2 text-xs font-medium text-black hover:bg-zinc-200 disabled:opacity-40 transition-colors"
            >
              <Search className="h-3.5 w-3.5" />
              <span>Validar</span>
            </button>
          </form>

          {/* Atajos rápidos de prueba con asistentes registrados */}
          {currentRegistrations.length > 0 && (
            <div className="pt-1">
              <p className="text-[10px] font-mono uppercase text-zinc-500 mb-1.5">
                Prueba rápida con participantes de este evento:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {currentRegistrations.slice(0, 4).map((reg) => (
                  <button
                    key={reg.id}
                    type="button"
                    onClick={() => handleExecuteScan(reg.qr_token)}
                    className="flex items-center gap-1 rounded border border-white/10 bg-white/[0.03] px-2 py-1 text-[11px] font-mono text-zinc-300 hover:bg-white/[0.08] hover:text-white transition-colors"
                  >
                    <QrCode className="h-3 w-3 text-zinc-400" />
                    <span>{reg.full_name.split(" ")[0]} ({reg.document_number})</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Columna Derecha: Tarjeta de Resultado y Auditoría */}
        <div className="space-y-4 lg:col-span-5">
          {/* Tarjeta de Resultado */}
          <div className="rounded-lg border border-white/10 bg-black/40 p-4">
            <p className="text-[11px] font-mono uppercase text-zinc-500 mb-3">
              Última Validación
            </p>

            {lastScanResult ? (
              <div
                className={`rounded-lg border p-4 transition-all ${
                  lastScanResult.result === "accepted"
                    ? "border-emerald-500/30 bg-emerald-950/20 text-emerald-300"
                    : lastScanResult.result === "already_attended"
                    ? "border-amber-500/30 bg-amber-950/20 text-amber-300"
                    : "border-red-500/30 bg-red-950/20 text-red-300"
                }`}
              >
                <div className="flex items-start gap-3">
                  {lastScanResult.result === "accepted" && (
                    <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-400" />
                  )}
                  {lastScanResult.result === "already_attended" && (
                    <AlertTriangle className="h-6 w-6 shrink-0 text-amber-400" />
                  )}
                  {lastScanResult.result !== "accepted" &&
                    lastScanResult.result !== "already_attended" && (
                      <XCircle className="h-6 w-6 shrink-0 text-red-400" />
                    )}

                  <div className="space-y-1">
                    <p className="text-xs font-semibold">
                      {lastScanResult.result === "accepted" && "ACCESO PERMITIDO"}
                      {lastScanResult.result === "already_attended" && "YA REGISTRADO"}
                      {lastScanResult.result === "invalid_qr" && "CÓDIGO NO VÁLIDO"}
                      {lastScanResult.result === "event_not_open" && "EVENTO CERRADO"}
                      {lastScanResult.result === "cancelled_registration" &&
                        "INSCRIPCIÓN CANCELADA"}
                    </p>
                    <p className="text-xs opacity-90">{lastScanResult.message}</p>

                    {lastScanResult.registration && (
                      <div className="pt-2 mt-2 border-t border-white/10 text-[11px] font-mono space-y-0.5">
                        <p>
                          <span className="opacity-60">Participante:</span>{" "}
                          <span className="font-semibold text-white">
                            {lastScanResult.registration.full_name}
                          </span>
                        </p>
                        <p>
                          <span className="opacity-60">DNI:</span>{" "}
                          {lastScanResult.registration.document_number}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center text-zinc-500">
                <Clock className="h-6 w-6 mb-2 opacity-50" />
                <p className="text-xs">Esperando escaneo...</p>
                <p className="text-[11px] text-zinc-600">
                  Apunta un código a la cámara o ingresa el token.
                </p>
              </div>
            )}
          </div>

          {/* Historial de Auditoría */}
          <div className="rounded-lg border border-white/[0.08] bg-black/40 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-300">
                <History className="h-3.5 w-3.5 text-zinc-400" />
                <span>Auditoría de Escaneos Recientes</span>
              </div>
              <span className="text-[10px] font-mono text-zinc-500">
                {recentLogs.length} registros
              </span>
            </div>

            {recentLogs.length === 0 ? (
              <p className="py-3 text-center text-[11px] text-zinc-600">
                No hay escaneos recientes en esta sesión.
              </p>
            ) : (
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {recentLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between rounded border border-white/[0.04] bg-white/[0.02] p-2 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                          log.result === "accepted"
                            ? "bg-emerald-400"
                            : log.result === "already_attended"
                            ? "bg-amber-400"
                            : "bg-red-400"
                        }`}
                      />
                      <div>
                        <p className="text-[11px] font-medium text-zinc-200">
                          {log.participant_name || "Desconocido"}
                        </p>
                        <p className="text-[10px] font-mono text-zinc-500">
                          {log.document_number ? `DNI: ${log.document_number}` : log.result}
                        </p>
                      </div>
                    </div>

                    <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                      {new Date(log.scanned_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
