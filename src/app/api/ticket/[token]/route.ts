import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isValidUUID } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!token || !isValidUUID(token)) {
      return NextResponse.json(
        { error: "Token de credencial inválido." },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Invocar la función RPC mínima get_ticket_info
    const { data, error } = await supabase.rpc("get_ticket_info", {
      p_qr_token: token,
    });

    if (error || !data || data.length === 0) {
      return NextResponse.json(
        { error: "Boleto o credencial no encontrada." },
        { status: 404 }
      );
    }

    const ticket = data[0];
    return NextResponse.json({
      success: true,
      ticket: {
        event_name: ticket.event_name,
        event_location: ticket.event_location,
        starts_at: ticket.starts_at,
        ends_at: ticket.ends_at,
        participant_name: ticket.participant_name,
        status: ticket.status,
        is_checked_in: ticket.is_checked_in,
        checked_in_at: ticket.checked_in_at,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Error interno al consultar el boleto." },
      { status: 500 }
    );
  }
}
