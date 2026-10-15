"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  ShieldCheck,
  Mail,
  UserPlus,
  Trash2,
  Copy,
  Check,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  ExternalLink,
  Users,
} from "lucide-react";
import {
  fetchEventTeam,
  inviteValidatorToEvent,
  revokeInvitationOrValidator,
  EventMemberItem,
  EventMemberInvitationItem,
} from "@/lib/db";

interface EventTeamManagerProps {
  eventId: string;
  isOwner: boolean;
  eventName: string;
}

export function EventTeamManager({
  eventId,
  isOwner,
  eventName,
}: EventTeamManagerProps) {
  const [invitations, setInvitations] = useState<EventMemberInvitationItem[]>([]);
  const [members, setMembers] = useState<EventMemberItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [emailInput, setEmailInput] = useState("");
  const [isInviting, setIsInviting] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [createdInvitation, setCreatedInvitation] = useState<{
    email: string;
    url: string;
  } | null>(null);
  const [copiedCreated, setCopiedCreated] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setActionError(null);
    const res = await fetchEventTeam(eventId);
    if (res.error) {
      setActionError(res.error);
    } else {
      setInvitations(res.invitations);
      setMembers(res.members);
    }
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = emailInput.trim();
    if (!cleanEmail) return;

    setIsInviting(true);
    setActionMessage(null);
    setActionError(null);
    setCreatedInvitation(null);

    const res = await inviteValidatorToEvent(eventId, cleanEmail);
    setIsInviting(false);

    if (!res.success) {
      setActionError(res.error || "No se pudo enviar la invitación.");
    } else {
      setActionMessage(res.message || "Invitación generada con éxito.");
      if (res.invitation_url) {
        setCreatedInvitation({
          email: cleanEmail,
          url: res.invitation_url,
        });
      }
      setEmailInput("");
      loadData();
    }
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    if (!confirm("¿Deseas revocar esta invitación? El destinatario ya no podrá aceptarla.")) return;
    setActionMessage(null);
    setActionError(null);

    const res = await revokeInvitationOrValidator({
      eventId,
      invitationId,
    });

    if (!res.success) {
      setActionError(res.error || "Error al revocar invitación.");
    } else {
      setActionMessage("Invitación revocada correctamente.");
      loadData();
    }
  };

  const handleRevokeMember = async (memberId: string) => {
    if (!confirm("¿Deseas retirar a este validador? Perderá acceso inmediato al escaneo y a los datos del evento.")) return;
    setActionMessage(null);
    setActionError(null);

    const res = await revokeInvitationOrValidator({
      eventId,
      memberId,
    });

    if (!res.success) {
      setActionError(res.error || "Error al retirar validador.");
    } else {
      setActionMessage("Validador retirado con éxito.");
      loadData();
    }
  };

  const handleCopyLink = (inv: EventMemberInvitationItem) => {
    const token = inv.invitation_token;
    if (!token) {
      setActionError("Esta invitación aún no tiene un token generado. Actualiza la lista.");
      return;
    }
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = inv.invitation_url || `${origin}/invitaciones/${token}`;

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(url);
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
    }

    setCopiedId(inv.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleCopyCreatedUrl = (url: string) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(url);
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
    }
    setCopiedCreated(true);
    setTimeout(() => setCopiedCreated(false), 2500);
  };

  if (!isOwner) {
    return (
      <div className="rounded-xl border border-white/10 bg-zinc-950/60 p-8 text-center text-zinc-400">
        <ShieldCheck className="mx-auto h-8 w-8 text-zinc-600 mb-2" />
        <p className="text-sm text-white font-medium">Acceso Restringido</p>
        <p className="text-xs text-zinc-500 mt-1">
          Solo el creador del evento puede invitar y gestionar al equipo de validadores.
        </p>
      </div>
    );
  }

  const pendingInvitations = invitations.filter((i) => i.status === "pending");
  const pastInvitations = invitations.filter((i) => i.status !== "pending");
  const activeMembers = members.filter((m) => m.active);

  return (
    <div className="space-y-6">
      {/* Top Banner & Invite Form */}
      <div className="rounded-xl border border-white/[0.08] bg-zinc-950/60 p-6 backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              Equipo de Validadores de Puerta
            </h3>
            <p className="mt-1 text-xs text-zinc-400">
              Invita usuarios registrados en GPQR para que validen credenciales en las puertas de{" "}
              <span className="text-white font-medium">{eventName}</span>.
            </p>
          </div>

          <button
            type="button"
            onClick={loadData}
            className="self-start sm:self-auto flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Actualizar</span>
          </button>
        </div>

        {/* Feedback alerts */}
        {actionMessage && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-950/30 p-3 text-xs text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>{actionMessage}</span>
          </div>
        )}

        {/* Tarjeta de enlace directo recién generado */}
        {createdInvitation && (
          <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5">
                <Check className="h-4 w-4 text-emerald-400" />
                Enlace de invitación generado para {createdInvitation.email}
              </span>
              <button
                type="button"
                onClick={() => setCreatedInvitation(null)}
                className="text-[11px] text-zinc-400 hover:text-white"
              >
                Cerrar
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={createdInvitation.url}
                className="flex-1 rounded-lg border border-white/10 bg-black/80 px-3 py-1.5 text-xs font-mono text-zinc-300 select-all focus:outline-none"
              />
              <button
                type="button"
                onClick={() => handleCopyCreatedUrl(createdInvitation.url)}
                className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-black hover:bg-zinc-200 transition-colors"
              >
                {copiedCreated ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Copiado</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copiar</span>
                  </>
                )}
              </button>
              <a
                href={createdInvitation.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.05] p-2 text-zinc-300 hover:text-white hover:bg-white/[0.1] transition-colors"
                title="Abrir enlace"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
            <p className="mt-1.5 text-[10px] text-zinc-400 font-mono">
              Puedes copiar y compartir este enlace por WhatsApp, Slack u otro canal directamente si el destinatario no recibe el correo.
            </p>
          </div>
        )}

        {actionError && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-950/30 p-3 text-xs text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            <span>{actionError}</span>
          </div>
        )}

        {/* Formulario de Invitación */}
        <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Mail className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
            <input
              type="email"
              required
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="correo-del-validador@ejemplo.com"
              className="w-full rounded-lg border border-white/10 bg-black/60 pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:border-white focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={isInviting}
            className="flex items-center justify-center gap-2 rounded-lg bg-white px-5 py-2 text-xs font-semibold text-black hover:bg-zinc-200 transition-colors disabled:opacity-50"
          >
            {isInviting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <UserPlus className="h-3.5 w-3.5" />
                <span>Enviar Invitación</span>
              </>
            )}
          </button>
        </form>

        <p className="mt-2 text-[11px] text-zinc-500 font-mono">
          El invitado recibirá un correo con un enlace seguro y único de 7 días. Debe iniciar sesión con ese mismo correo.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Validadores Activos */}
        <div className="rounded-xl border border-white/[0.08] bg-zinc-950/60 p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-xs font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-zinc-400" />
              Validadores Activos ({activeMembers.length})
            </h4>
            <span className="text-[10px] text-zinc-500 font-mono">Permiso: Escáner</span>
          </div>

          {activeMembers.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/10 p-6 text-center text-xs text-zinc-500">
              No hay validadores activos todavía. Envía invitaciones por correo arriba.
            </div>
          ) : (
            <div className="divide-y divide-white/[0.06]">
              {activeMembers.map((member) => (
                <div
                  key={member.id}
                  className="py-3 flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      <span className="font-mono text-white text-[11px]">
                        ID: {member.user_id.slice(0, 12)}...
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-0.5">
                      Activo desde: {new Date(member.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRevokeMember(member.id)}
                    className="flex items-center gap-1 rounded border border-red-500/20 bg-red-950/20 px-2 py-1 text-[11px] text-red-300 hover:bg-red-950/40 transition-colors"
                    title="Retirar acceso de validador inmediatamente"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>Retirar</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Invitaciones Pendientes */}
        <div className="rounded-xl border border-white/[0.08] bg-zinc-950/60 p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-xs font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-amber-400" />
              Invitaciones Pendientes ({pendingInvitations.length})
            </h4>
            <span className="text-[10px] text-zinc-500 font-mono">Caducidad: 7 días</span>
          </div>

          {pendingInvitations.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/10 p-6 text-center text-xs text-zinc-500">
              No hay invitaciones pendientes.
            </div>
          ) : (
            <div className="divide-y divide-white/[0.06]">
              {pendingInvitations.map((inv) => (
                <div
                  key={inv.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <div className="font-medium text-white font-mono">{inv.invited_email}</div>
                    <div className="text-[10px] text-zinc-500">
                      Expira: {new Date(inv.expires_at).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Copiar enlace */}
                    <button
                      type="button"
                      onClick={() => handleCopyLink(inv)}
                      className="flex items-center gap-1 rounded border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-zinc-300 hover:text-white transition-colors"
                      title="Copiar enlace directo de aceptación"
                    >
                      {copiedId === inv.id ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-400" />
                          <span className="text-emerald-400 font-semibold">Copiado</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3 text-zinc-400" />
                          <span>Copiar Enlace</span>
                        </>
                      )}
                    </button>

                    {/* Abrir enlace directo */}
                    {inv.invitation_token && (
                      <a
                        href={inv.invitation_url || `/invitaciones/${inv.invitation_token}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 rounded border border-white/10 bg-white/[0.04] p-1.5 text-zinc-400 hover:text-white transition-colors"
                        title="Abrir página de aceptación"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}

                    {/* Revocar */}
                    <button
                      type="button"
                      onClick={() => handleRevokeInvitation(inv.id)}
                      className="flex items-center gap-1 rounded border border-red-500/20 bg-red-950/20 px-2 py-1 text-[11px] text-red-300 hover:bg-red-950/40 transition-colors"
                      title="Revocar invitación"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>Revocar</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
