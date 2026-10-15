import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isValidUUID } from "@/lib/db";

// GET: Consultar información segura y pública de la invitación
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token || !isValidUUID(token)) {
      return NextResponse.json(
        { error: "Token de invitación no válido." },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Invocar la función RPC get_invitation_details
    const { data, error } = await supabase.rpc("get_invitation_details", {
      p_invitation_token: token,
    });

    if (error || !data || data.length === 0) {
      return NextResponse.json(
        { error: "La invitación no existe o no se encuentra disponible." },
        { status: 404 }
      );
    }

    const inv = data[0];
    return NextResponse.json({
      success: true,
      invitation: {
        event_id: inv.event_id,
        event_name: inv.event_name,
        event_location: inv.event_location,
        starts_at: inv.starts_at,
        ends_at: inv.ends_at,
        invited_email: inv.invited_email,
        status: inv.status,
        expires_at: inv.expires_at,
        is_valid: inv.is_valid,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Error al consultar la invitación." },
      { status: 500 }
    );
  }
}

// POST: Aceptar la invitación con la cuenta autenticada
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    if (!token || !isValidUUID(token)) {
      return NextResponse.json(
        { error: "Token de invitación no válido." },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          error: "Debes iniciar sesión o registrarte para aceptar esta invitación.",
          needsAuth: true,
        },
        { status: 401 }
      );
    }

    // Aceptar invitación a través de la función de base de datos
    const { data: memberId, error: acceptError } = await supabase.rpc(
      "accept_event_member_invitation",
      {
        p_invitation_token: token,
      }
    );

    if (acceptError) {
      return NextResponse.json(
        {
          error: acceptError.message || "No se pudo aceptar la invitación.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "¡Invitación aceptada con éxito! Ya tienes acceso de validador a este evento.",
      member_id: memberId,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Error interno al procesar la aceptación." },
      { status: 500 }
    );
  }
}
