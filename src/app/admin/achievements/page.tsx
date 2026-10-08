import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import Navbar from "@/components/layout/Navbar";
import { createClient } from "@/lib/supabase/server";

export default async function AdminAchievementsPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  const { data: admin, error: adminError } = await supabase.from("profiles")
    .select("nama_lengkap, role_app, status_akun")
    .eq("user_id", auth.user.id).maybeSingle();
  if (adminError || admin?.role_app !== "ADMIN" || admin.status_akun !== "ACTIVE") {
    notFound();
  }

  const { data: pending, error } = await supabase.from("achievement_claims")
    .select("achievement_claim_id, nama_kompetisi, user_id, submitted_at")
    .eq("status_validation", "PENDING")
    .order("submitted_at", { ascending: true }).limit(50);
  const ids = [...new Set((pending ?? []).map((claim) => claim.user_id))];
  const profilesQuery = ids.length
    ? await supabase.from("profiles").select("user_id, nama_lengkap").in("user_id", ids)
    : { data: [], error: null };
  const names = new Map((profilesQuery.data ?? [])
    .map((profile) => [profile.user_id, profile.nama_lengkap]));

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar displayName={admin.nama_lengkap} activeItem="admin" isAdmin />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Link href="/admin/results" className="text-sm font-semibold text-indigo-700">
          ← Review hasil Mission
        </Link>
        <h1 className="mt-5 text-2xl font-bold">Review Klaim Prestasi</h1>
        {error || profilesQuery.error ? (
          <p role="alert" className="mt-5 text-red-700">Daftar klaim belum dapat dimuat.</p>
        ) : pending?.length ? (
          <ul className="mt-5 space-y-3">
            {pending.map((claim) => (
              <li key={claim.achievement_claim_id}
                className="rounded-xl border border-slate-200 bg-white p-4">
                <Link href={`/admin/achievements/${claim.achievement_claim_id}`}
                  className="font-semibold text-indigo-700 underline">{claim.nama_kompetisi}</Link>
                <p className="mt-1 text-sm text-slate-600">
                  {names.get(claim.user_id) ?? "Mahasiswa"} · {new Date(claim.submitted_at)
                    .toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB
                </p>
              </li>
            ))}
          </ul>
        ) : <p className="mt-5 text-sm text-slate-600">Belum ada klaim yang menunggu review.</p>}
      </main>
    </div>
  );
}
