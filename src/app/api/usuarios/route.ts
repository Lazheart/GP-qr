import { NextRequest, NextResponse } from "next/server";
import { getStoredRegistrations, RegistrationItem } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get("event_id") || undefined;
    const registrations = getStoredRegistrations(eventId);

    return NextResponse.json({
      success: true,
      data: registrations,
      total: registrations.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Error consultando asistentes.", details: String(error) },
      { status: 500 }
    );
  }
}
