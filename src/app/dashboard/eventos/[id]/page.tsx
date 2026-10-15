import { Suspense } from "react";
import { redirect } from "next/navigation";

async function Redirector({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/dashboard?evento=${id}`);
  return null;
}

export default function EventoRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black flex items-center justify-center text-xs text-zinc-500 font-mono">
          Cargando evento...
        </div>
      }
    >
      <Redirector params={params} />
    </Suspense>
  );
}
