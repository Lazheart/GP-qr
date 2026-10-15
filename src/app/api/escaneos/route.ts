import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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
        { error: "No autenticado. Se requiere inicio de sesión para escanear." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { event_id, qr_token } = body;

    if (!event_id || !qr_token) {
      return NextResponse.json(
        { error: "event_id y qr_token son requeridos." },
        { status: 400 }
      );
    }

    const trimmedToken = String(qr_token).trim();
    const trimmedEventId = String(event_id).trim();

    if (!isValidUUID(trimmedEventId) || !isValidUUID(trimmedToken)) {
      return NextResponse.json(
        {
          result: "invalid_qr",
          message: "El código QR o el identificador de evento no tiene un formato válido.",
        },
        { status: 422 }
      );
    }

    const { data, error } = await supabase.rpc("scan_event_qr", {
      p_event_id: trimmedEventId,
      p_qr_token: trimmedToken,
    });

    if (error) {
      return NextResponse.json(
        { error: "Error en la validación de asistencia.", details: error.message },
        { status: 400 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { result: "invalid_qr", message: "No se obtuvo respuesta del validador." },
        { status: 422 }
      );
    }

    const row = data[0];
    const resType = row.scan_result;

    let message = "";
    switch (resType) {
      case "accepted":
        message = `¡Asistencia confirmada para ${row.participant_name || "Participante"}!`;
        break;
      case "already_attended":
        message = `¡Atención! Asistencia ya registrada previamente para ${row.participant_name || "Participante"}.`;
        break;
      case "invalid_qr":
        message = "El código QR es inválido o no pertenece a este evento.";
        break;
      case "cancelled_registration":
        message = "La inscripción para este participante está cancelada.";
        break;
      case "event_not_open":
        message = "El evento no se encuentra en estado abierto.";
        break;
      case "not_authorized":
        message = "No tienes autorización para validar en este evento.";
        break;
      default:
        message = `Resultado: ${resType}`;
    }

    return NextResponse.json({
      result: resType,
      message,
      registration_id: row.registration_id,
      participant_name: row.participant_name,
      scanned_at: row.scanned_at || new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Error interno procesando el escaneo." },
      { status: 500 }
    );
  }
}
