"use client";

import { useState, useTransition } from "react";

import { markNotificationRead } from "./actions";

export default function MarkReadButton({ notificationId }: { notificationId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function handleClick() {
    setError("");
    startTransition(async () => {
      try {
        const result = await markNotificationRead(notificationId);
        if (!result.success) setError(result.message);
      } catch {
        setError("Notifikasi belum dapat ditandai. Muat ulang lalu coba lagi.");
      }
    });
  }

  return (
    <div className="mt-4">
      <button type="button" onClick={handleClick} disabled={pending}
        className="rounded-lg border border-indigo-200 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Menyimpan…" : "Tandai dibaca"}
      </button>
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
