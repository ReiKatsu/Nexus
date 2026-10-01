import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import Navbar from "@/components/layout/Navbar";
import { createClient } from "@/lib/supabase/server";

import RankCard from "./RankCard";

function PageError({ message }: { message: string }) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-bold">Profil belum dapat dimuat</h1>
      <p role="alert" className="mt-4 rounded-xl bg-white p-5 text-red-700">{message}</p>
    </main>
  );
}

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) redirect("/login");

  const { data: profile, error: profileError } = await supabase.from("profiles")
    .select("nama_lengkap, bio, tahun_masuk, foto_profil_path, primary_class_id, program_studi_id, role_app, status_akun")
    .eq("user_id", auth.user.id).maybeSingle();
  if (!profileError && profile?.role_app === "STUDENT" && profile.primary_class_id === null) {
    redirect("/onboarding");
  }

  if (profileError || !profile || profile.status_akun !== "ACTIVE") {
    return <PageError message="Data profil atau akses akun sedang tidak tersedia." />;
  }

  const userId = auth.user.id;
  const [classResult, programResult, skillsResult, careerResult, seasonResult, rulesResult] =
    await Promise.all([
      profile.primary_class_id === null
        ? Promise.resolve({ data: null, error: null })
        : supabase.from("primary_classes").select("nama_class")
            .eq("primary_class_id", profile.primary_class_id).maybeSingle(),
      supabase.from("program_studi").select("nama_program_studi, fakultas_id")
        .eq("program_studi_id", profile.program_studi_id).maybeSingle(),
      supabase.from("user_skills").select("skills(nama_skill)")
        .eq("user_id", userId),
      supabase.from("career_xp_totals").select("career_xp")
        .eq("user_id", userId).maybeSingle(),
      supabase.from("seasons").select("season_id, nama_season")
        .eq("status_season", "ACTIVE").maybeSingle(),
      supabase.from("rank_rules").select("rank_name, min_xp, max_xp")
        .order("min_xp", { ascending: true }),
    ]);

  const [facultyResult, seasonalResult] = await Promise.all([
    programResult.data
      ? supabase.from("fakultas").select("nama_fakultas")
          .eq("fakultas_id", programResult.data.fakultas_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    seasonResult.data
      ? supabase.from("current_seasonal_xp_totals").select("seasonal_xp")
          .eq("user_id", userId).eq("season_id", seasonResult.data.season_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const queryError = classResult.error || programResult.error || skillsResult.error ||
    careerResult.error || seasonResult.error || rulesResult.error || facultyResult.error ||
    seasonalResult.error;
  if (queryError || !programResult.data || !facultyResult.data ||
      !careerResult.data || !rulesResult.data?.length ||
      (seasonResult.data && !seasonalResult.data)) {
    return <PageError message="Data akademik atau XP sedang tidak tersedia. Coba muat ulang." />;
  }

  const skills = (skillsResult.data ?? []).flatMap((row) => row.skills ?? [])
    .map((skill) => skill.nama_skill).sort((a, b) => a.localeCompare(b));
  const avatar = profile.foto_profil_path
    ? supabase.storage.from("avatars").getPublicUrl(profile.foto_profil_path).data.publicUrl
    : null;
  const rules = rulesResult.data;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar displayName={profile.nama_lengkap} activeItem="profile"
        isAdmin={profile.role_app === "ADMIN"} />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Profil Saya</h1>
          <Link href="/profile/edit"
            className="rounded-lg border border-indigo-200 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50">
            Edit profil
          </Link>
        </div>
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center gap-4">
            {avatar ? (
              <Image src={avatar} alt={`Foto ${profile.nama_lengkap}`}
                width={72} height={72} unoptimized
                className="h-18 w-18 rounded-full object-cover" />
            ) : (
              <span aria-label="Foto profil belum tersedia"
                className="flex h-18 w-18 items-center justify-center rounded-full bg-indigo-100 text-2xl font-bold text-indigo-700">
                {profile.nama_lengkap.trim().charAt(0).toUpperCase() || "N"}
              </span>
            )}
            <div>
              <h2 className="text-xl font-bold">{profile.nama_lengkap}</h2>
              <p className="mt-1 text-sm text-slate-600">
                {programResult.data.nama_program_studi} · {facultyResult.data.nama_fakultas}
              </p>
            </div>
          </div>
          <p className="mt-5 whitespace-pre-line text-sm text-slate-700">
            {profile.bio?.trim() || "Belum ada bio."}
          </p>
          <dl className="mt-5 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2">
            <div><dt className="text-xs font-semibold text-slate-500">Primary Class</dt>
              <dd className="mt-1 font-semibold">{classResult.data?.nama_class ?? "Belum dipilih"}</dd></div>
            <div><dt className="text-xs font-semibold text-slate-500">Tahun masuk</dt>
              <dd className="mt-1 font-semibold">{profile.tahun_masuk}</dd></div>
          </dl>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-bold">Skills</h2>
          {skills.length ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {skills.map((skill) => <li key={skill}
                className="rounded-full bg-indigo-50 px-3 py-1 text-sm text-indigo-700">{skill}</li>)}
            </ul>
          ) : <p className="mt-3 text-sm text-slate-600">Belum ada Skill yang dipilih.</p>}
        </section>

        {profile.role_app === "STUDENT" && (
          <section className="mt-8">
            <h2 className="text-lg font-bold">XP dan Rank</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <RankCard label="Career" xp={careerResult.data.career_xp} rules={rules} />
              {seasonResult.data && seasonalResult.data ? (
                <RankCard label={seasonResult.data.nama_season}
                  xp={seasonalResult.data.seasonal_xp} rules={rules} />
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
                  Belum ada Season aktif.
                </div>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
