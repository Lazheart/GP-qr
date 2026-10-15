import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendGuestTicketEmail } from "@/lib/email";
import { isValidUUID } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "No autenticado. Inicia sesión para realizar esta acción." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { registration_id, event_id } = body;

    if (!registration_id || !isValidUUID(registration_id)) {
      return NextResponse.json(
        { error: "Identificador de participante (registration_id) inválido." },
        { status: 400 }
      );
    }

    // Consultar el registro del participante junto a los datos del evento
    const { data: reg, error: regError } = await supabase
      .from("event_registrations")
      .select(`
        id,
        event_id,
        document_number,
        full_name,
        email,
        qr_token,
        status,
        events!inner (
          id,
          name,
          location,
          starts_at,
          ends_at,
          created_by,
          status
        )
      `)
      .eq("id", registration_id)
      .single();

    if (regError || !reg) {
      return NextResponse.json(
        { error: "No se encontró el registro del participante." },
        { status: 404 }
      );
    }

    // Verificar permisos: el usuario autenticado debe ser creador del evento
    // (Opcionalmente también se puede verificar si es validador autorizado)
    const event = Array.isArray(reg.events) ? reg.events[0] : reg.events;
    if (!event || event.created_by !== user.id) {
      return NextResponse.json(
        { error: "No tienes autorización para enviar pases de este evento." },
        { status: 403 }
      );
    }

    // Validar que el participante tenga correo
    const targetEmail = reg.email?.trim().toLowerCase();
    if (!targetEmail || !targetEmail.includes("@") || targetEmail.length < 5) {
      return NextResponse.json(
        { error: "El participante no cuenta con un correo electrónico válido." },
        { status: 400 }
      );
    }

    if (reg.status === "cancelled") {
      return NextResponse.json(
        { error: "La inscripción de este participante está cancelada." },
        { status: 400 }
      );
    }

    // Construir enlace público al Pase Digital
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
    const proto = req.headers.get("x-forwarded-proto") || (host?.includes("localhost") ? "http" : "https");
    const origin = host ? `${proto}://${host}` : req.nextUrl.origin;
    const ticketUrl = `${origin}/ticket/${reg.qr_token}`;

    // Enviar correo con Gmail SMTP
    const emailResult = await sendGuestTicketEmail({
      toEmail: targetEmail,
      participantName: reg.full_name,
      documentNumber: reg.document_number,
      eventName: event.name,
      eventLocation: event.location,
      startsAt: event.starts_at,
      endsAt: event.ends_at,
      qrToken: reg.qr_token,
      ticketUrl,
    });

    if (!emailResult.success) {
      return NextResponse.json(
        {
          error: `Error al enviar el correo con Gmail SMTP: ${emailResult.error || "Fallo desconocido."}`,
          details: emailResult.error,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Pase digital enviado exitosamente a ${targetEmail}.`,
      ticket_url: ticketUrl,
      message_id: emailResult.messageId,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Error interno al enviar la credencial por correo.", details: String(err) },
      { status: 500 }
    );
  }
}
