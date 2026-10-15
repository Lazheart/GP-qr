"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import jsQR from "jsqr";
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
  Loader2,
} from "lucide-react";
import {
  EventItem,
  ScanResultResponse,
  getStoredLogs,
  AttendanceLogItem,
  getStoredRegistrations,
  isValidUUID,
} from "@/lib/db";

interface QRScannerProps {
  events: EventItem[];
  currentEventId: string;
  onScanCompleted?: () => void;
}

/** Minimum milliseconds between two accepted scans (prevents rapid duplicates) */
const SCAN_COOLDOWN_MS = 2_000;
/** How often (ms) we grab a frame from the camera to attempt QR decode */
const SCAN_INTERVAL_MS = 250;

export function QRScanner({
  events,
  currentEventId,
  onScanCompleted,
}: QRScannerProps) {
  const [manualToken, setManualToken] = useState("");
  const [cameraActive, setCameraActive] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [lastScanResult, setLastScanResult] = useState<ScanResultResponse | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [recentLogs, setRecentLogs] = useState<AttendanceLogItem[]>([]);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [processingManual, setProcessingManual] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastScannedTokenRef = useRef<string>("");
  const lastScanTimeRef = useRef<number>(0);

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

  // ─── Audio feedback ───────────────────────────────────────────────
  const playBeep = useCallback(
    (type: "success" | "warning" | "error") => {
      if (!soundEnabled) return;
      try {
        if (!audioCtxRef.current) {
          audioCtxRef.current = new (window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext })
              .webkitAudioContext)();
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
          osc.frequency.setValueAtTime(880, ctx.currentTime);
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
    },
    [soundEnabled]
  );

  // ─── Core scan execution (Supabase + local fallback) ──────────────
  const handleExecuteScan = useCallback(
    async (rawToken: string) => {
      if (!rawToken.trim() || !selectedEvent) return;

      const token = rawToken.trim();

      try {
        // 1️⃣ Try Supabase RPC first (works for UUID qr_tokens)
        if (isValidUUID(token)) {
          const { scanEventQRWithSupabase } = await import("@/lib/db");
          const res = await scanEventQRWithSupabase(selectedEvent.id, token);
          setLastScanResult(res);

          if (res.result === "accepted") playBeep("success");
          else if (res.result === "already_attended") playBeep("warning");
          else playBeep("error");

          refreshLogs();
          if (onScanCompleted) onScanCompleted();
          return;
        }

        // 2️⃣ Not a UUID — try matching by document_number via Supabase
        const { fetchRegistrationsFromSupabase } = await import("@/lib/db");
        const { data: regs } = await fetchRegistrationsFromSupabase(selectedEvent.id);

        if (regs && regs.length > 0) {
          const match = regs.find(
            (r) =>
              r.document_number.toLowerCase() === token.toLowerCase() ||
              r.qr_token.toLowerCase() === token.toLowerCase()
          );

          if (match) {
            // Found by DNI → scan using the UUID token
            const { scanEventQRWithSupabase } = await import("@/lib/db");
            const res = await scanEventQRWithSupabase(selectedEvent.id, match.qr_token);
            setLastScanResult(res);

            if (res.result === "accepted") playBeep("success");
            else if (res.result === "already_attended") playBeep("warning");
            else playBeep("error");

            refreshLogs();
            if (onScanCompleted) onScanCompleted();
            return;
          }
        }

        // 3️⃣ Local fallback — tries local stored registrations
        const { processScanToken } = await import("@/lib/db");
        const localRes = processScanToken(selectedEvent.id, token);
        setLastScanResult(localRes);

        if (localRes.result === "accepted") playBeep("success");
        else if (localRes.result === "already_attended") playBeep("warning");
        else playBeep("error");

        refreshLogs();
        if (onScanCompleted) onScanCompleted();
      } catch (err) {
        console.error("Error executing scan:", err);
        setLastScanResult({
          result: "not_authorized",
          message: "Error de conexión al intentar validar el código.",
          scannedAt: new Date().toISOString(),
        });
        playBeep("error");
      }
    },
    [selectedEvent, playBeep, refreshLogs, onScanCompleted]
  );

  // ─── Camera QR decode loop ────────────────────────────────────────
  const startScanLoop = useCallback(() => {
    if (scanIntervalRef.current) return;

    setScanning(true);

    scanIntervalRef.current = setInterval(() => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < video.HAVE_ENOUGH_DATA) return;

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const qrResult = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });

      if (qrResult && qrResult.data) {
        const now = Date.now();
        const decoded = qrResult.data.trim();

        // Cooldown: don't re-scan the same token within SCAN_COOLDOWN_MS
        if (
          decoded === lastScannedTokenRef.current &&
          now - lastScanTimeRef.current < SCAN_COOLDOWN_MS
        ) {
          return;
        }

        lastScannedTokenRef.current = decoded;
        lastScanTimeRef.current = now;

        // Extract token from URL-style QR codes (e.g. https://…/ticket?token=UUID)
        let tokenToScan = decoded;
        try {
          const url = new URL(decoded);
          const urlToken = url.searchParams.get("token") || url.searchParams.get("t");
          if (urlToken) {
            tokenToScan = urlToken;
          } else {
            // Maybe the last path segment is the token
            const segments = url.pathname.split("/").filter(Boolean);
            if (segments.length > 0) {
              const lastSeg = segments[segments.length - 1];
              if (isValidUUID(lastSeg)) {
                tokenToScan = lastSeg;
              }
            }
          }
        } catch {
          // Not a URL — use the raw decoded value
        }

        handleExecuteScan(tokenToScan);
      }
    }, SCAN_INTERVAL_MS);
  }, [handleExecuteScan]);

  const stopScanLoop = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    setScanning(false);
  }, []);

  // ─── Camera lifecycle ─────────────────────────────────────────────
  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      // Set active first — the video element is always in the DOM,
      // the useEffect below handles binding the stream to it.
      setCameraActive(true);
    } catch (err) {
      console.error("Camera access error:", err);
      setCameraError(
        "No se pudo acceder a la cámara. Comprueba los permisos en tu navegador o usa el ingreso manual de token."
      );
      setCameraActive(false);
    }
  };

  // Bind stream → <video> whenever cameraActive flips to true
  useEffect(() => {
    if (cameraActive && streamRef.current && videoRef.current) {
      const video = videoRef.current;
      video.srcObject = streamRef.current;
      video
        .play()
        .then(() => {
          startScanLoop();
        })
        .catch((err) => {
          console.error("Video play() failed:", err);
          setCameraError("No se pudo reproducir el video de la cámara.");
          setCameraActive(false);
        });
    }
  }, [cameraActive, startScanLoop]);

  const stopCamera = useCallback(() => {
    stopScanLoop();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, [stopScanLoop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  // Available registrations for quick-test buttons
  const currentRegistrations = selectedEvent
    ? getStoredRegistrations(selectedEvent.id)
    : [];

  // Compute result display styling
  const getResultStyle = (result: string) => {
    switch (result) {
      case "accepted":
        return "border-emerald-500/30 bg-emerald-950/20 text-emerald-300";
      case "already_attended":
        return "border-amber-500/30 bg-amber-950/20 text-amber-300";
      default:
        return "border-red-500/30 bg-red-950/20 text-red-300";
    }
  };

  const getResultIcon = (result: string) => {
    switch (result) {
      case "accepted":
        return <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-400" />;
      case "already_attended":
        return <AlertTriangle className="h-6 w-6 shrink-0 text-amber-400" />;
      default:
        return <XCircle className="h-6 w-6 shrink-0 text-red-400" />;
    }
  };

  const getResultLabel = (result: string) => {
    switch (result) {
      case "accepted":
        return "ACCESO PERMITIDO";
      case "already_attended":
        return "YA REGISTRADO";
      case "invalid_qr":
        return "CÓDIGO NO VÁLIDO";
      case "event_not_open":
        return "EVENTO CERRADO";
      case "cancelled_registration":
        return "INSCRIPCIÓN CANCELADA";
      case "not_authorized":
        return "NO AUTORIZADO";
      default:
        return "ERROR";
    }
  };

  return (
    <div className="w-full rounded-xl border border-white/[0.08] bg-zinc-950/60 p-6 backdrop-blur-sm">
      {/* Hidden canvas for QR decoding — never rendered visually */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Header */}
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400" />
            <h3 className="text-base font-medium text-white tracking-tight">
              Terminal de Control de Acceso &amp; Escáner
            </h3>
          </div>
          <p className="mt-1 text-xs text-zinc-400">
            Valida asistencia en tiempo real mediante cámara o código manual para{" "}
            <span className="text-white font-medium">{selectedEvent?.name}</span>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {cameraActive && (
            <div className="flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-950/20 px-2.5 py-1.5 text-[11px] text-emerald-300 font-mono">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              Escaneando
            </div>
          )}
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
        {/* Left Column: Camera Viewer + Manual Input */}
        <div className="space-y-4 lg:col-span-7">
          {/* Camera Container */}
          <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-white/10 bg-black">
            {/* Video element is ALWAYS in the DOM so the ref is never null */}
            <video
              ref={videoRef}
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
                cameraActive ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
              playsInline
              muted
              autoPlay
            />

            {cameraActive && (
              <>
                {/* Focus crosshair overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                  <div className="h-48 w-48 rounded-xl border border-white/30 relative flex items-center justify-center">
                    {/* Corners */}
                    <div className="absolute -top-1 -left-1 h-4 w-4 border-t-2 border-l-2 border-white" />
                    <div className="absolute -top-1 -right-1 h-4 w-4 border-t-2 border-r-2 border-white" />
                    <div className="absolute -bottom-1 -left-1 h-4 w-4 border-b-2 border-l-2 border-white" />
                    <div className="absolute -bottom-1 -right-1 h-4 w-4 border-b-2 border-r-2 border-white" />
                    {/* Animated scan line */}
                    <div className="absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-emerald-400/80 to-transparent animate-scan-line" />
                  </div>
                </div>

                {/* Last scan result flash overlay */}
                {lastScanResult && (
                  <div
                    className={`absolute inset-0 pointer-events-none z-10 transition-opacity duration-500 ${
                      lastScanResult.result === "accepted"
                        ? "bg-emerald-500/10"
                        : lastScanResult.result === "already_attended"
                        ? "bg-amber-500/10"
                        : "bg-red-500/10"
                    }`}
                    style={{ animation: "flash-overlay 1s ease-out forwards" }}
                  />
                )}

                {/* Stop camera button */}
                <div className="absolute bottom-3 right-3 z-20">
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="flex items-center gap-1.5 rounded-md bg-zinc-900/90 border border-white/10 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800 transition-colors"
                  >
                    <CameraOff className="h-3.5 w-3.5" />
                    <span>Apagar</span>
                  </button>
                </div>
              </>
            )}

            {/* Idle state placeholder — shown when camera is off */}
            {!cameraActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.04] border border-white/10 mb-3">
                  <Camera className="h-5 w-5 text-zinc-400" />
                </div>
                <p className="text-xs font-medium text-white">Cámara en espera</p>
                <p className="mt-1 text-[11px] text-zinc-500 max-w-xs">
                  Activa la cámara del dispositivo para escanear boletos impresos o
                  pantallas móviles al instante.
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
          </div>

          {/* Manual Token / DNI Input */}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!manualToken.trim() || processingManual) return;
              setProcessingManual(true);
              await handleExecuteScan(manualToken);
              setManualToken("");
              setProcessingManual(false);
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
              disabled={!manualToken.trim() || processingManual}
              className="flex items-center gap-1.5 rounded-md bg-white px-4 py-2 text-xs font-medium text-black hover:bg-zinc-200 disabled:opacity-40 transition-colors"
            >
              {processingManual ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Search className="h-3.5 w-3.5" />
              )}
              <span>Validar</span>
            </button>
          </form>

      {/* Quick-test shortcuts with registered attendees
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
                <span>  
                  {reg.full_name.split(" ")[0]} ({reg.document_number})
                </span>
              </button>
            ))}
          </div>
        </div>
      )}*/}
        </div>

        {/* Right Column: Result Card + Audit Trail */}
        <div className="space-y-4 lg:col-span-5">
          {/* Result Card */}
          <div className="rounded-lg border border-white/10 bg-black/40 p-4">
            <p className="text-[11px] font-mono uppercase text-zinc-500 mb-3">
              Última Validación
            </p>

            {lastScanResult ? (
              <div
                className={`rounded-lg border p-4 transition-all ${getResultStyle(
                  lastScanResult.result
                )}`}
              >
                <div className="flex items-start gap-3">
                  {getResultIcon(lastScanResult.result)}

                  <div className="space-y-1">
                    <p className="text-xs font-semibold">
                      {getResultLabel(lastScanResult.result)}
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

                    {lastScanResult.participant_name &&
                      !lastScanResult.registration && (
                        <div className="pt-2 mt-2 border-t border-white/10 text-[11px] font-mono">
                          <p>
                            <span className="opacity-60">Participante:</span>{" "}
                            <span className="font-semibold text-white">
                              {lastScanResult.participant_name}
                            </span>
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

          {/* Audit Trail */}
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
                          {log.document_number
                            ? `DNI: ${log.document_number}`
                            : log.result}
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

      {/* Inline styles for the scan line animation and flash overlay */}
      <style jsx>{`
        @keyframes scan-line-move {
          0%,
          100% {
            transform: translateY(-80px);
            opacity: 0.3;
          }
          50% {
            transform: translateY(80px);
            opacity: 1;
          }
        }
        .animate-scan-line {
          animation: scan-line-move 2s ease-in-out infinite;
        }
        @keyframes flash-overlay {
          0% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
