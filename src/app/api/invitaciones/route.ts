import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendValidatorInvitationEmail } from "@/lib/email";
import { isValidUUID } from "@/lib/db";

// GET: Listar validadores e invitaciones del evento (Solo creador)
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get("event_id");

    if (!eventId || !isValidUUID(eventId)) {
      return NextResponse.json({ error: "ID de evento inválido." }, { status: 400 });
    }

    // Comprobar que el usuario es propietario
    const { data: event, error: eventErr } = await supabase
      .from("events")
      .select("id, name, created_by")
      .eq("id", eventId)
      .eq("created_by", user.id)
      .single();

    if (eventErr || !event) {
      return NextResponse.json(
        { error: "No tienes permisos de administración en este evento." },
        { status: 403 }
      );
    }

    // Consultar invitaciones
    const { data: invitations, error: invErr } = await supabase
      .from("event_member_invitations")
      .select("id, invited_email, status, expires_at, created_at, accepted_at")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });

    // Consultar miembros activos
    const { data: members, error: memErr } = await supabase
      .from("event_members")
      .select("id, user_id, role, active, created_at")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });

    if (invErr || memErr) {
      return NextResponse.json(
        { error: "Error al consultar el equipo del evento." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      invitations: invitations || [],
      members: members || [],
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Error interno al obtener datos del equipo.", details: String(err) },
      { status: 500 }
    );
  }
}

// POST: Crear y enviar invitación a un validador (Solo creador)
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    const body = await req.json();
    const { event_id, email } = body;

    if (!event_id || !isValidUUID(event_id) || !email) {
      return NextResponse.json(
        { error: "event_id y correo son obligatorios." },
        { status: 400 }
      );
    }

    const cleanEmail = String(email).toLowerCase().trim();
    if (!cleanEmail.includes("@") || cleanEmail.length < 5) {
      return NextResponse.json(
        { error: "Ingresa un correo electrónico válido." },
        { status: 400 }
      );
    }

    // Verificar que el usuario autenticado es creador del evento
    const { data: event, error: eventErr } = await supabase
      .from("events")
      .select("id, name, created_by")
      .eq("id", event_id)
      .eq("created_by", user.id)
      .single();

    if (eventErr || !event) {
      return NextResponse.json(
        { error: "No tienes permisos para invitar validadores a este evento." },
        { status: 403 }
      );
    }

    // Evitar que el creador se invite a sí mismo
    if (user.email && user.email.toLowerCase() === cleanEmail) {
      return NextResponse.json(
        { error: "Ya eres el propietario de este evento; cuentas con todos los permisos." },
        { status: 400 }
      );
    }

    // Comprobar si ya existe una invitación pendiente para este correo en este evento
    const { data: existingPending } = await supabase
      .from("event_member_invitations")
      .select("id, invitation_token, status, expires_at")
      .eq("event_id", event_id)
      .eq("invited_email", cleanEmail)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    let invitationToken = existingPending?.invitation_token;
    let expiresAt = existingPending?.expires_at;

    if (!existingPending) {
      // Crear nueva invitación
      const newToken = crypto.randomUUID();
      const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data: inserted, error: insertErr } = await supabase
        .from("event_member_invitations")
        .insert({
          event_id,
          invited_email: cleanEmail,
          invitation_token: newToken,
          status: "pending",
          invited_by: user.id,
          expires_at: newExpiry,
        })
        .select()
        .single();

      if (insertErr || !inserted) {
        return NextResponse.json(
          { error: "No se pudo registrar la invitación: " + (insertErr?.message || "") },
          { status: 500 }
        );
      }

      invitationToken = inserted.invitation_token;
      expiresAt = inserted.expires_at;
    }

    // Construir URL pública HTTPS para aceptar
    const origin = req.nextUrl.origin;
    const acceptUrl = `${origin}/invitaciones/${invitationToken}`;

    // Enviar correo electrónico
    const emailResult = await sendValidatorInvitationEmail({
      toEmail: cleanEmail,
      eventName: event.name,
      creatorEmail: user.email || "El organizador",
      invitationUrl: acceptUrl,
      expiresAt: expiresAt || new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: `Invitación enviada a ${cleanEmail}.`,
      invitation_url: acceptUrl,
      email_sent: emailResult.success,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Error interno al procesar la invitación.", details: String(err) },
      { status: 500 }
    );
  }
}
