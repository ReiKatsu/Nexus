import { redirect } from "next/navigation";

import Navbar from "@/components/layout/Navbar";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: authData, error: authError } =
    await supabase.auth.getUser();

  if (authError || !authData.user) redirect("/login");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("nama_lengkap, primary_class_id, role_app, status_akun")
    .eq("user_id", authData.user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-slate-900">
        <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-200/60">
          <p className="text-sm font-bold tracking-[0.22em] text-indigo-600">
            NEXUS
          </p>
          <h1 className="mt-4 text-2xl font-bold text-slate-950">
            Home belum dapat dimuat
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Data profil sedang tidak tersedia.
          </p>
        </section>
      </main>
    );
  }

  if (profile.role_app === "ADMIN" && profile.status_akun === "ACTIVE") {
    redirect("/admin/results");
  }
  if (profile.primary_class_id === null) redirect("/onboarding");

  const [primaryClassResult, userSkillsResult] = await Promise.all([
    supabase
      .from("primary_classes")
      .select("primary_class_id, nama_class")
      .eq("primary_class_id", profile.primary_class_id)
      .maybeSingle(),
    supabase
      .from("user_skills")
      .select(
        `
          skill_id,
          skills (
            skill_id,
            nama_skill
          )
        `,
      )
      .eq("user_id", authData.user.id),
  ]);

  if (
    primaryClassResult.error ||
    !primaryClassResult.data ||
    userSkillsResult.error
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-slate-900">
        <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-200/60">
          <p className="text-sm font-bold tracking-[0.22em] text-indigo-600">
            NEXUS
          </p>
          <h1 className="mt-4 text-2xl font-bold text-slate-950">
            Home belum dapat dimuat
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Data profil sedang tidak tersedia.
          </p>
        </section>
      </main>
    );
  }

  const userSkills = (userSkillsResult.data ?? [])
    .flatMap((userSkill) => userSkill.skills ?? [])
    .sort((firstSkill, secondSkill) =>
      firstSkill.nama_skill.localeCompare(secondSkill.nama_skill),
    );

  return (
    <div className="flex min-h-screen w-full min-w-0 flex-col overflow-x-clip bg-slate-50">
      <Navbar displayName={profile.nama_lengkap} activeItem="home" />
      <main className="relative flex w-full min-w-0 flex-1 items-center justify-center overflow-hidden px-4 py-6 text-slate-900 sm:px-6 sm:py-10 lg:py-12">
        <div
          aria-hidden="true"
          className="absolute -left-32 -top-32 h-80 w-80 rounded-full bg-indigo-200/50 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-40 -right-32 h-96 w-96 rounded-full bg-violet-200/50 blur-3xl"
        />
        <section className="relative w-full min-w-0 max-w-3xl rounded-2xl border border-white/80 bg-white/90 p-5 text-center shadow-xl shadow-slate-200/60 backdrop-blur sm:rounded-3xl sm:p-8 md:p-10 lg:p-12">
          <div className="mb-5 inline-flex items-center gap-2.5 sm:mb-6 sm:gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-base font-bold text-white shadow-lg shadow-indigo-200 sm:h-11 sm:w-11 sm:rounded-2xl sm:text-lg">
              N
            </span>
            <span className="text-lg font-bold tracking-[0.2em] text-slate-900 sm:text-xl sm:tracking-[0.22em]">
              NEXUS
            </span>
          </div>
          <h1 className="break-words text-2xl font-bold tracking-tight text-slate-950 [overflow-wrap:anywhere] sm:text-3xl md:text-4xl">
            Halo, {profile.nama_lengkap}
          </h1>
          <p className="mt-3 text-sm leading-7 text-slate-500 sm:text-base">
            Selamat datang di NEXUS.
          </p>

          <div className="mt-7 border-t border-slate-100 pt-6 text-left sm:mt-8 sm:pt-7">
            <h2 className="text-lg font-bold text-slate-950 sm:text-xl">Profil Kamu</h2>
            <div className="mt-4 grid min-w-0 gap-4 sm:mt-5 sm:grid-cols-2 sm:gap-5">
              <div className="min-w-0 rounded-2xl bg-slate-50 p-4 sm:p-5">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                  Primary Class
                </p>
                <p className="mt-2 break-words text-lg font-bold text-indigo-700 [overflow-wrap:anywhere] sm:text-xl">
                  {primaryClassResult.data.nama_class}
                </p>
              </div>
              <div className="min-w-0 rounded-2xl bg-slate-50 p-4 sm:p-5">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                  Skills
                </p>
                {userSkills.length > 0 ? (
                  <div className="mt-2 flex min-w-0 flex-wrap gap-2">
                    {userSkills.map((skill) => (
                      <span
                        key={skill.skill_id}
                        className="max-w-full break-words rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-sm font-semibold leading-5 text-indigo-700 [overflow-wrap:anywhere]"
                      >
                        {skill.nama_skill}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">
                    Belum ada skill dipilih
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
