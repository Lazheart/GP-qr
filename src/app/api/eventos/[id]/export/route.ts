import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import * as XLSX from "xlsx";
import { defangFormula } from "@/lib/excel";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await params;
    if (!eventId) {
      return NextResponse.json({ error: "ID de evento requerido." }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "No autenticado. Inicia sesión para exportar." },
        { status: 401 }
      );
    }

    // Consultar evento (RLS garantiza que solo el creador o validador activo pueda leerlo)
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, name, created_by")
      .eq("id", eventId)
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { error: "Evento no encontrado o no tienes autorización para acceder a él." },
        { status: 403 }
      );
    }

    // Consultar participantes del evento (RLS asegura que solo propietarios y validadores tengan acceso)
    const { data: registrations, error: regError } = await supabase
      .from("event_registrations")
      .select("id, document_number, full_name, email, phone, status, checked_in_at")
      .eq("event_id", eventId)
      .order("full_name", { ascending: true });

    if (regError) {
      return NextResponse.json(
        { error: "Error al consultar asistentes para la exportación." },
        { status: 500 }
      );
    }

    // Sanitizar contra inyección de fórmulas y omitir qr_token
    const exportRows = (registrations || []).map((r, index) => ({
      N: index + 1,
      Documento: defangFormula(r.document_number),
      "Nombre y Apellidos": defangFormula(r.full_name),
      "Correo Electrónico": defangFormula(r.email) || "-",
      Teléfono: defangFormula(r.phone) || "-",
      Estado: r.status === "registered" ? "Inscrito" : "Cancelado",
      "Asistencia Registrada": r.checked_in_at
        ? new Date(r.checked_in_at).toLocaleString()
        : "No asistió",
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Asistencia");

    const excelBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    const cleanName = event.name.replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `Asistencia_${cleanName}_${new Date().toISOString().slice(0, 10)}.xlsx`;

    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Error interno durante la exportación.", details: String(err) },
      { status: 500 }
    );
  }
}
