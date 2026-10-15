import React from "react";
import { ShieldCheck, Calendar, Users, QrCode } from "lucide-react";

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-black text-[#ededed] font-sans antialiased relative flex flex-col justify-between selection:bg-white selection:text-black">
      {/* Background aesthetics */}
      <div className="absolute inset-0 vercel-grid pointer-events-none opacity-25" />
      <div className="absolute top-0 inset-x-0 h-[480px] vercel-spotlight pointer-events-none" />

      {/* Top Navigation Bar Skeleton */}
      <header className="sticky top-0 z-40 w-full border-b border-white/[0.08] bg-black/75 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.08] border border-white/10">
              <QrCode className="h-4 w-4 text-zinc-400 animate-pulse" />
            </div>
            <div>
              <div className="h-4 w-24 bg-white/15 rounded animate-pulse" />
              <div className="h-3 w-16 bg-white/5 rounded mt-1 animate-pulse" />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-8 w-28 bg-white/5 rounded-lg border border-white/5 animate-pulse hidden sm:block" />
            <div className="h-8 w-24 bg-white/10 rounded-lg animate-pulse" />
          </div>
        </div>
      </header>

      {/* Main Content Area Skeleton */}
      <main className="relative z-10 mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-8">
          {/* Header & New Event button skeleton */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-white/[0.08] pb-6">
            <div>
              <div className="h-8 w-64 bg-white/20 rounded-lg animate-pulse" />
              <div className="h-4 w-96 bg-white/10 rounded mt-2 animate-pulse" />
            </div>
            <div className="h-10 w-36 bg-white/20 rounded-lg animate-pulse" />
          </div>

          {/* Stat Cards Skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="rounded-2xl border border-white/[0.08] bg-zinc-950/60 p-5 backdrop-blur-md space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="h-3 w-20 bg-white/10 rounded animate-pulse" />
                  <div className="h-6 w-6 rounded-lg bg-white/5 animate-pulse" />
                </div>
                <div className="h-7 w-16 bg-white/20 rounded animate-pulse" />
                <div className="h-3 w-28 bg-white/5 rounded animate-pulse" />
              </div>
            ))}
          </div>

          {/* Event Cards Grid Skeleton */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="h-5 w-32 bg-white/15 rounded animate-pulse" />
              <div className="h-4 w-20 bg-white/10 rounded animate-pulse" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3].map((card) => (
                <div
                  key={card}
                  className="rounded-2xl border border-white/[0.08] bg-zinc-950/60 p-6 backdrop-blur-md space-y-4 relative overflow-hidden"
                >
                  <div className="flex items-center justify-between">
                    <div className="h-4 w-20 bg-white/10 rounded-full animate-pulse" />
                    <div className="h-5 w-16 bg-emerald-500/10 rounded-full animate-pulse" />
                  </div>
                  <div className="h-6 w-3/4 bg-white/20 rounded animate-pulse" />
                  <div className="h-3 w-full bg-white/5 rounded animate-pulse" />

                  <div className="pt-4 border-t border-white/[0.06] flex items-center justify-between">
                    <div className="h-4 w-24 bg-white/10 rounded animate-pulse" />
                    <div className="h-4 w-16 bg-white/10 rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Footer Skeleton */}
      <footer className="relative z-10 border-t border-white/[0.08] py-4 text-center text-xs text-zinc-600 font-mono">
        GPQR • Sistema de Gestión de Códigos QR
      </footer>
    </div>
  );
}
