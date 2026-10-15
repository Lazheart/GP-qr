import { NextRequest, NextResponse } from "next/server";
import { processScanToken } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { event_id, qr_token, scanner_name } = body;

    if (!event_id || !qr_token) {
      return NextResponse.json(
        { error: "event_id y qr_token son requeridos." },
        { status: 400 }
      );
    }

    const result = processScanToken(event_id, qr_token, scanner_name || "API");

    return NextResponse.json(result, {
      status: result.result === "accepted" ? 200 : 422,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Error procesando el escaneo.", details: String(error) },
      { status: 500 }
    );
  }
}
