import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  try {
    // 1. Verificación de autorización de Vercel Cron
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    // 2. Comprobar clave de servicio
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        {
          error:
            "Se requiere SUPABASE_SERVICE_ROLE_KEY para ejecutar la tarea de archivado con permisos administrativos.",
        },
        { status: 500 }
      );
    }

    // 3. Crear cliente con privilegios service_role (solo en servidor)
    const adminSupabase = createSupabaseClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // 4. Invocar la función de archivo histórico idempotente
    const { data: archivedCount, error } = await adminSupabase.rpc(
      "archive_finished_events"
    );

    if (error) {
      return NextResponse.json(
        { error: "Error ejecutando el archivado de eventos.", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Archivado completado con éxito. Eventos procesados: ${archivedCount ?? 0}.`,
      archived_events_count: archivedCount ?? 0,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Error inesperado en la tarea cron.", details: String(err) },
      { status: 500 }
    );
  }
}
