import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isValidUUID } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "No autenticado. Inicia sesión para consultar asistentes." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get("event_id");

    if (!eventId || !isValidUUID(eventId)) {
      return NextResponse.json(
        { error: "Se requiere un event_id válido." },
        { status: 400 }
      );
    }

    // Supabase RLS garantiza que solo el creador o validador activo pueda consultar
    const { data, error } = await supabase
      .from("event_registrations")
      .select("id, event_id, document_number, full_name, email, phone, status, checked_in_at, registered_at")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: "No tienes permiso para consultar los asistentes de este evento.", details: error.message },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      total: (data || []).length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Error consultando asistentes." },
      { status: 500 }
    );
  }
}
