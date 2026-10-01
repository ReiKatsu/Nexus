import { redirect } from "next/navigation";

import Navbar from "@/components/layout/Navbar";
import { createClient } from "@/lib/supabase/server";

import MarkReadButton from "./MarkReadButton";

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) redirect("/login");

  const { data: profile, error: profileError } = await supabase.from("profiles")
    .select("nama_lengkap, status_akun, role_app, primary_class_id")
    .eq("user_id", auth.user.id).maybeSingle();
  if (!profileError && profile?.role_app === "STUDENT" && profile.primary_class_id === null) {
    redirect("/onboarding");
  }

  const eligible = !profileError && profile?.status_akun === "ACTIVE";
  const { data: notifications, error } = eligible
    ? await supabase.from("notifications")
        .select("notification_id, title, body, is_read, created_at")
        .eq("user_id", auth.user.id)
        .order("created_at", { ascending: false })
        .limit(50)
    : { data: null, error: null };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar displayName={profile?.nama_lengkap ?? "NEXUS"}
        activeItem="notifications" isAdmin={profile?.role_app === "ADMIN"} />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold">Notifikasi</h1>
        <p className="mt-2 text-sm text-slate-600">50 notifikasi terbaru untuk akunmu.</p>
        {!eligible ? (
          <p role="alert" className="mt-6 rounded-xl bg-white p-5 text-red-700">
            Notifikasi belum dapat dibuka. Periksa status akun atau coba lagi.
          </p>
        ) : error ? (
          <p role="alert" className="mt-6 rounded-xl bg-white p-5 text-red-700">
            Notifikasi belum dapat dimuat. Muat ulang lalu coba lagi.
          </p>
        ) : notifications?.length ? (
          <ul className="mt-6 space-y-3">
            {notifications.map((item) => (
              <li key={item.notification_id}
                className={`rounded-2xl border bg-white p-5 ${item.is_read ? "border-slate-200" : "border-indigo-200"}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-bold">{item.title}</h2>
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${item.is_read ? "bg-slate-100 text-slate-600" : "bg-indigo-50 text-indigo-700"}`}>
                    {item.is_read ? "Dibaca" : "Belum dibaca"}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{item.body}</p>
                <time dateTime={item.created_at} className="mt-3 block text-xs text-slate-500">
                  {new Date(item.created_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB
                </time>
                {!item.is_read && <MarkReadButton notificationId={item.notification_id} />}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-6 rounded-xl bg-white p-5 text-sm text-slate-600">
            Belum ada notifikasi untuk akunmu.
          </p>
        )}
      </main>
    </div>
  );
}
