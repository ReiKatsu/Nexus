"use client";

import { useState, useSyncExternalStore } from "react";

const subscribeToOrigin = () => () => {};
const getOrigin = () => window.location.origin;
const getServerOrigin = () => "";

export default function ShareProfile({ userId }: { userId: string }) {
  const origin = useSyncExternalStore(subscribeToOrigin, getOrigin, getServerOrigin);
  const [status, setStatus] = useState<"idle" | "copying" | "copied" | "error">("idle");
  const link = `${origin}/profile/${userId}`;

  async function copyLink() {
    if (!origin || status === "copying") return;
    setStatus("copying");
    try {
      await navigator.clipboard.writeText(link);
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5"
      aria-labelledby="share-profile-heading">
      <h2 id="share-profile-heading" className="text-lg font-bold">Bagikan profil</h2>
      <p id="share-profile-access" className="mt-2 text-sm text-slate-600">
        Penerima perlu login ke akun NEXUS yang aktif untuk melihat profilmu.
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <label className="min-w-0 flex-1 text-xs font-semibold text-slate-600">
          Link profil
          <input type="text" readOnly value={link}
            aria-describedby="share-profile-access share-profile-status"
            onFocus={(event) => event.currentTarget.select()}
            className="mt-1 block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-normal text-slate-700" />
        </label>
        <button type="button" onClick={copyLink}
          disabled={!origin || status === "copying"}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 sm:self-end">
          {status === "copying" ? "Menyalin…" : "Salin link"}
        </button>
      </div>
      <p id="share-profile-status" role="status" aria-live="polite"
        className={`mt-3 text-sm ${status === "error" ? "text-red-700" : "text-slate-600"}`}>
        {status === "copied" ? "Link profil berhasil disalin."
          : status === "error" ? "Link belum berhasil disalin. Pilih link di atas lalu salin secara manual."
          : "Bagikan link ini kepada pengguna NEXUS lainnya."}
      </p>
    </section>
  );
}
