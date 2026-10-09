import Link from "next/link";
import { redirect } from "next/navigation";

import Navbar from "@/components/layout/Navbar";
import { createClient } from "@/lib/supabase/server";

import EquipBadgeButton from "./EquipBadgeButton";

function BadgeError({ message }: { message: string }) {
  return <p role="alert" className="mt-6 rounded-xl bg-white p-5 text-red-700">{message}</p>;
}

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export default async function BadgeChestPage() {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) redirect("/login");

  const { data: profile, error: profileError } = await supabase.from("profiles")
    .select("nama_lengkap, role_app, status_akun, primary_class_id")
    .eq("user_id", auth.user.id).maybeSingle();
  if (!profileError && profile?.role_app === "STUDENT" && profile.primary_class_id === null) {
    redirect("/onboarding");
  }

  const canView = !profileError && profile?.role_app === "STUDENT" &&
    profile.status_akun === "ACTIVE";
  const badges = canView
    ? await supabase.from("user_badges")
        .select(`user_badge_id, reward_context, scope_type, rank_position, population_total,
          is_equipped, awarded_at,
          badge_definitions(badge_name, badge_type, description),
          seasons(nama_season), program_studi(nama_program_studi), fakultas(nama_fakultas)`)
        .eq("user_id", auth.user.id)
        .order("awarded_at", { ascending: false })
    : { data: null, error: null };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {profile && <Navbar displayName={profile.nama_lengkap} activeItem="profile" />}
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <Link href="/profile" className="text-sm font-semibold text-indigo-700 hover:underline">
          ← Profil Saya
        </Link>
        <h1 className="mt-5 text-2xl font-bold">Badge Chest</h1>
        <p className="mt-2 text-sm text-slate-600">
          Koleksi Badge yang telah kamu peroleh. Satu Badge dapat dipasang di profil.
        </p>

        {!canView ? (
          <BadgeError message="Koleksi Badge belum dapat dibuka dari akun ini." />
        ) : badges.error ? (
          <BadgeError message="Koleksi Badge belum dapat dimuat. Coba muat ulang." />
        ) : !badges.data?.length ? (
          <p className="mt-6 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
            Belum ada Badge. Badge yang diberikan dari Rank-Up atau Leaderboard akan muncul di sini.
          </p>
        ) : (
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {badges.data.map((row) => {
              const definition = one(row.badge_definitions);
              const season = one(row.seasons);
              const program = one(row.program_studi);
              const faculty = one(row.fakultas);
              const context = row.reward_context === "CAREER"
                ? "Career Rank-Up"
                : row.reward_context === "SEASONAL"
                  ? "Seasonal Rank-Up"
                  : "Leaderboard";
              const scope = row.scope_type === "PROGRAM_STUDI"
                ? `Program Studi · ${program?.nama_program_studi ?? "Tidak tersedia"}`
                : row.scope_type === "FAKULTAS"
                  ? `Fakultas · ${faculty?.nama_fakultas ?? "Tidak tersedia"}`
                  : row.scope_type === "UNIVERSITAS"
                    ? "Universitas"
                    : null;

              return (
                <li key={row.user_badge_id}
                  className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
                        {definition?.badge_type === "RANK_UP" ? "Rank-Up" : "Posisi Leaderboard"}
                      </p>
                      <h2 className="mt-1 text-lg font-bold">
                        {definition?.badge_name ?? "Badge"}
                      </h2>
                    </div>
                    {row.is_equipped && (
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                        Terpasang
                      </span>
                    )}
                  </div>
                  {definition?.description && (
                    <p className="mt-2 text-sm text-slate-600">{definition.description}</p>
                  )}
                  <dl className="mt-4 space-y-1 text-sm text-slate-700">
                    <div><dt className="inline font-semibold">Konteks: </dt>
                      <dd className="inline">{context}</dd></div>
                    {season && <div><dt className="inline font-semibold">Season: </dt>
                      <dd className="inline">{season.nama_season}</dd></div>}
                    {scope && <div><dt className="inline font-semibold">Lingkup: </dt>
                      <dd className="inline">{scope}</dd></div>}
                    {row.rank_position !== null && row.population_total !== null && (
                      <div><dt className="inline font-semibold">Posisi: </dt>
                        <dd className="inline">
                          #{row.rank_position} dari {row.population_total}
                        </dd></div>
                    )}
                    <div><dt className="inline font-semibold">Diperoleh: </dt>
                      <dd className="inline">{new Intl.DateTimeFormat("id-ID", {
                        dateStyle: "medium", timeZone: "Asia/Jakarta",
                      }).format(new Date(row.awarded_at))}</dd></div>
                  </dl>
                  {!row.is_equipped && <EquipBadgeButton userBadgeId={row.user_badge_id} />}
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
