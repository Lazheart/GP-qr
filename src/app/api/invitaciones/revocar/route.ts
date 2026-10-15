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
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }

    const body = await req.json();
    const { invitation_id, member_id, event_id } = body;

    if (!event_id || !isValidUUID(event_id)) {
      return NextResponse.json({ error: "event_id requerido y válido." }, { status: 400 });
    }

    // Comprobar que el usuario autenticado es creador del evento
    const { data: event, error: eventErr } = await supabase
      .from("events")
      .select("id, created_by")
      .eq("id", event_id)
      .eq("created_by", user.id)
      .single();

    if (eventErr || !event) {
      return NextResponse.json(
        { error: "No tienes autorización para revocar accesos en este evento." },
        { status: 403 }
      );
    }

    // 1. Revocar invitación pendiente si se envió invitation_id
    if (invitation_id && isValidUUID(invitation_id)) {
      const { data, error } = await supabase.rpc("revoke_validator_invitation", {
        p_invitation_id: invitation_id,
      });

      if (error) {
        return NextResponse.json(
          { error: "No se pudo revocar la invitación: " + error.message },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Invitación revocada correctamente.",
      });
    }

    // 2. Retirar validador activo si se envió member_id
    if (member_id && isValidUUID(member_id)) {
      const { data, error } = await supabase.rpc("revoke_event_validator", {
        p_event_id: event_id,
        p_member_id: member_id,
      });

      if (error) {
        return NextResponse.json(
          { error: "No se pudo retirar al validador: " + error.message },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Acceso de validador retirado inmediatamente.",
      });
    }

    return NextResponse.json(
      { error: "Se requiere invitation_id o member_id para realizar la acción." },
      { status: 400 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: "Error interno al revocar autorización.", details: String(err) },
      { status: 500 }
    );
  }
}
