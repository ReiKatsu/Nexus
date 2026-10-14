"use client";

import { useRef, useState, useTransition } from "react";
import { markNotificationRead } from "./actions";

export type Notification = {
  notification_id: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
};

export default function NotificationItem({ item }: { item: Notification }) {
  const [read, setRead] = useState(item.is_read);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const busy = useRef(false);

  async function readOnOpen(open: boolean) {
    if (!open || read || busy.current) return;
    busy.current = true;
    setError("");
    try {
      const result = await markNotificationRead(item.notification_id);
      if (result.success) setRead(true);
      else setError(result.message);
    } catch {
      setError("Status baca belum tersimpan. Tutup dan buka notifikasi untuk mencoba lagi.");
    } finally {
      busy.current = false;
    }
  }

  return (
    <li>
      <details aria-busy={pending} onToggle={(event) => {
        const open = event.currentTarget.open;
        startTransition(() => readOnOpen(open));
      }}
        className={`rounded-2xl border bg-white p-5 ${read ? "border-slate-200" : "border-indigo-500"}`}>
        <summary className="cursor-pointer rounded-lg focus-visible:outline-2 focus-visible:outline-indigo-500">
          <span className="inline-flex items-center gap-3 font-bold">
            {item.title}
            {!read && <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-sky-400">
              <span className="sr-only">Belum dibaca</span>
            </span>}
          </span>
          <time dateTime={item.created_at} className="mt-2 block text-xs font-normal text-slate-500">
            {new Date(item.created_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB
          </time>
        </summary>
        <p className="mt-3 whitespace-pre-line text-sm text-slate-700">{item.body}</p>
        {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
      </details>
    </li>
  );
}
