import Link from "next/link";
import { redirect } from "next/navigation";

import Navbar from "@/components/layout/Navbar";
import { createClient } from "@/lib/supabase/server";

const deadlineFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

type MissionTier = {
  kode_tier: string | null;
};

type MissionsPageProps = {
  searchParams: Promise<{
    q?: string | string[];
    category?: string | string[];
    tier?: string | string[];
    mode?: string | string[];
    cost?: string | string[];
  }>;
};

function getRelatedTier(relation: unknown): MissionTier | null {
  if (Array.isArray(relation)) return (relation[0] as MissionTier) ?? null;
  if (relation && typeof relation === "object") return relation as MissionTier;
  return null;
}

function formatEnumLabel(value: string | null): string {
  if (!value) return "-";

  const label = value.trim().toLocaleLowerCase("id-ID").replaceAll("_", " ");
  return label.charAt(0).toLocaleUpperCase("id-ID") + label.slice(1);
}

function getSearchParam(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

function uniqueStrings(values: Array<string | null>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort(
    (firstValue, secondValue) => firstValue.localeCompare(secondValue),
  );
}

export default async function MissionsPage({ searchParams }: MissionsPageProps) {
  const supabase = await createClient();
  const { data: authData, error: authError } =
    await supabase.auth.getUser();

  if (authError || !authData.user) redirect("/login");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("nama_lengkap, primary_class_id, foto_profil_path")
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
            Missions belum dapat dimuat
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Data profil sedang tidak tersedia.
          </p>
        </section>
      </main>
    );
  }

  if (profile.primary_class_id === null) redirect("/onboarding");

  const requestedFilters = await searchParams;
  const now = new Date().toISOString();
  const { data: filterRows, error: filterOptionsError } = await supabase
    .from("missions")
    .select(
      `
        kategori_lomba,
        mode_lomba,
        biaya_pendaftaran,
        tier_id,
        mission_tiers (
          kode_tier
        )
      `,
    )
    .gt("deadline_pendaftaran", now);

  const categoryOptions = uniqueStrings(
    (filterRows ?? []).map((row) => row.kategori_lomba),
  );
  const modeOptions = uniqueStrings(
    (filterRows ?? []).map((row) => row.mode_lomba),
  );
  const costOptions = uniqueStrings(
    (filterRows ?? []).map((row) => row.biaya_pendaftaran),
  );
  const tierOptions = (filterRows ?? [])
    .map((row) => ({
      tierId: row.tier_id,
      code: getRelatedTier(row.mission_tiers)?.kode_tier?.trim() ?? "",
    }))
    .filter(
      (tier, index, tiers) =>
        tier.code && tiers.findIndex((item) => item.code === tier.code) === index,
    )
    .sort((firstTier, secondTier) => firstTier.code.localeCompare(secondTier.code));

  const requestedCategory = getSearchParam(requestedFilters.category);
  const searchQuery = getSearchParam(requestedFilters.q).trim().slice(0, 100);
  const requestedTier = getSearchParam(requestedFilters.tier);
  const requestedMode = getSearchParam(requestedFilters.mode);
  const requestedCost = getSearchParam(requestedFilters.cost);
  const selectedCategory = categoryOptions.includes(requestedCategory)
    ? requestedCategory
    : "";
  const selectedTier = tierOptions.find((tier) => tier.code === requestedTier);
  const selectedMode = modeOptions.includes(requestedMode) ? requestedMode : "";
  const selectedCost = costOptions.includes(requestedCost) ? requestedCost : "";
  const hasActiveFilters = Boolean(
    searchQuery || selectedCategory || selectedTier || selectedMode || selectedCost,
  );

  let missionsQuery = supabase
    .from("missions")
    .select(
      `
        mission_id,
        nama_lomba,
        penyelenggara,
        deadline_pendaftaran,
        kategori_lomba,
        mode_lomba,
        biaya_pendaftaran,
        cakupan_peserta,
        open_squads:squads(count),
        tier_id,
        mission_tiers (
          kode_tier
        )
      `,
    )
    .gt("deadline_pendaftaran", now)
    .eq("open_squads.status_squad", "OPEN_RECRUITMENT");

  if (selectedCategory) {
    missionsQuery = missionsQuery.eq("kategori_lomba", selectedCategory);
  }
  if (selectedTier) {
    missionsQuery = missionsQuery.eq("tier_id", selectedTier.tierId);
  }
  if (selectedMode) {
    missionsQuery = missionsQuery.eq("mode_lomba", selectedMode);
  }
  if (selectedCost) {
    missionsQuery = missionsQuery.eq("biaya_pendaftaran", selectedCost);
  }

  const [missionsResult, xpRulesResult] = await Promise.all([
    missionsQuery.order("deadline_pendaftaran", { ascending: true }),
    supabase.from("xp_rules").select("tier_id, verified_xp")
      .eq("hasil_kompetisi", "PARTICIPANT"),
  ]);
  const { data: availableMissions, error: missionsError } = missionsResult;

  // Discovery already loads the filtered list; use literal text matching so
  // PostgREST wildcard aliases cannot turn a typed name into a pattern.
  const missions = (availableMissions ?? []).filter((mission) =>
    !searchQuery || mission.nama_lomba.toLocaleLowerCase("id-ID")
      .includes(searchQuery.toLocaleLowerCase("id-ID")));
  const participantXp = new Map((xpRulesResult.data ?? [])
    .map((rule) => [rule.tier_id, rule.verified_xp]));

  return (
    <div className="flex min-h-screen w-full min-w-0 flex-col overflow-x-clip bg-slate-50">
      <Navbar displayName={profile.nama_lengkap} avatarPath={profile.foto_profil_path} activeItem="missions" />
      <main className="relative flex w-full min-w-0 flex-1 justify-center overflow-x-clip px-4 py-7 text-slate-900 sm:px-6 sm:py-10 lg:py-14">
        <div
          aria-hidden="true"
          className="absolute -left-32 -top-32 h-80 w-80 rounded-full bg-indigo-200/50 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-40 -right-32 h-96 w-96 rounded-full bg-violet-200/50 blur-3xl"
        />
        <section className="mission-discovery relative w-full min-w-0">
          <div className="mission-page-header">
            <p className="text-sm font-bold tracking-[0.2em] text-indigo-600">
              NEXUS
            </p>
            <h1 className="mt-2 break-words text-3xl font-bold tracking-tight text-slate-950 [overflow-wrap:anywhere] sm:mt-3 sm:text-4xl">
              Missions
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
              Temukan kompetisi yang sesuai dengan skill dan minatmu.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/missions/add"
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white">
                + Tambah Mission
              </Link>
              <Link href="/missions/submissions"
                className="rounded-lg border border-indigo-200 px-4 py-2 text-sm font-bold text-indigo-700">
                Pengajuan saya
              </Link>
            </div>
          </div>

          <div className="mt-7 sm:mt-8">
            <h2 className="sr-only">
              Mission Discovery
            </h2>

            <form
              key={JSON.stringify([searchQuery, selectedCategory, selectedTier?.code, selectedMode, selectedCost])}
              method="GET"
              className="mission-search min-w-0 border bg-white"
            >
              <label className="block text-xs font-bold text-slate-600">
                Cari nama kompetisi
                <input type="search" name="q" defaultValue={searchQuery} maxLength={100}
                  placeholder="Masukkan nama Mission"
                  className="mt-1.5 block h-10 w-full rounded-xl border border-slate-200 px-3 text-sm font-normal text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
              </label>
              <details open={hasActiveFilters}>
                <summary className="inline-flex rounded-full bg-white/20 px-5 py-2 text-sm font-semibold">Filter Mission ▾</summary>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="min-w-0 text-xs font-bold text-slate-600">
                  Kategori
                  <select
                    name="category"
                    defaultValue={selectedCategory}
                    className="mt-1.5 block h-10 w-full min-w-0 max-w-full truncate rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value="">Semua kategori</option>
                    {categoryOptions.map((category) => (
                      <option key={category} value={category}>
                        {formatEnumLabel(category)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="min-w-0 text-xs font-bold text-slate-600">
                  Tier
                  <select
                    name="tier"
                    defaultValue={selectedTier?.code ?? ""}
                    className="mt-1.5 block h-10 w-full min-w-0 max-w-full truncate rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value="">Semua tier</option>
                    {tierOptions.map((tier) => (
                      <option key={tier.code} value={tier.code}>
                        {tier.code.toLocaleUpperCase("id-ID")}-Rank
                      </option>
                    ))}
                  </select>
                </label>

                <label className="min-w-0 text-xs font-bold text-slate-600">
                  Mode
                  <select
                    name="mode"
                    defaultValue={selectedMode}
                    className="mt-1.5 block h-10 w-full min-w-0 max-w-full truncate rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value="">Semua mode</option>
                    {modeOptions.map((mode) => (
                      <option key={mode} value={mode}>
                        {formatEnumLabel(mode)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="min-w-0 text-xs font-bold text-slate-600">
                  Biaya
                  <select
                    name="cost"
                    defaultValue={selectedCost}
                    className="mt-1.5 block h-10 w-full min-w-0 max-w-full truncate rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value="">Semua biaya</option>
                    {costOptions.map((cost) => (
                      <option key={cost} value={cost}>
                        {formatEnumLabel(cost)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              </details>

              <div className="mission-search-actions grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                <button
                  type="submit"
                  className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700 sm:w-auto"
                >
                  Terapkan
                </button>
                <Link
                  href="/missions"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-center text-sm font-bold text-slate-600 transition hover:bg-slate-50 sm:w-auto"
                >
                  Reset
                </Link>
              </div>
            </form>

            {filterOptionsError || missionsError ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm sm:p-8">
                <p className="font-bold text-slate-950">
                  Missions belum dapat dimuat
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Data Mission sedang tidak tersedia.
                </p>
              </div>
            ) : (missions ?? []).length === 0 ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm sm:p-8">
                {hasActiveFilters ? (
                  <>
                    <p className="font-bold text-slate-950">
                      Tidak ada Mission yang cocok
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      Coba ubah kata pencarian atau filter yang digunakan.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-bold text-slate-950">
                      Belum ada Mission aktif
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      Mission baru akan muncul di sini setelah tersedia.
                    </p>
                  </>
                )}
              </div>
            ) : (
              <div className="mission-grid mt-6 grid gap-5">
                {(missions ?? []).map((mission) => {
                  const relatedTier = getRelatedTier(mission.mission_tiers);
                  const tierCode = relatedTier?.kode_tier?.trim();

                  return (
                    <article
                      key={mission.mission_id}
                      className="glass-card mission-tile min-w-0"
                    >
                      <h3 className="break-words text-lg font-bold text-slate-950 [overflow-wrap:anywhere] sm:text-xl">
                        <Link
                          href={`/missions/${mission.mission_id}`}
                          className="rounded transition-colors hover:text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        >
                          {mission.nama_lomba}
                        </Link>
                      </h3>
                      <p className="mt-1 break-words text-sm text-slate-500 [overflow-wrap:anywhere]">
                        {mission.penyelenggara}
                      </p>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <span className="max-w-full break-words rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 [overflow-wrap:anywhere]">
                          {tierCode
                            ? `${tierCode.toLocaleUpperCase("id-ID")}-Rank`
                            : "Tier belum tersedia"}
                        </span>
                        <span className="max-w-full break-words rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 [overflow-wrap:anywhere]">
                          {mission.mode_lomba}
                        </span>
                        <span className="max-w-full break-words rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 [overflow-wrap:anywhere]">
                          {formatEnumLabel(mission.cakupan_peserta)}
                        </span>
                        <span className="max-w-full break-words rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 [overflow-wrap:anywhere]">
                          {formatEnumLabel(mission.biaya_pendaftaran)}
                        </span>
                      </div>

                      <div className="mt-4 grid gap-2 text-xs text-slate-600">
                        <p>{xpRulesResult.error || !participantXp.has(mission.tier_id)
                          ? "XP Participant belum tersedia"
                          : `${participantXp.get(mission.tier_id)} XP dasar Participant`}</p>
                        <p>{mission.open_squads?.[0]?.count === undefined
                          ? "Jumlah Squad belum dapat dimuat"
                          : `${mission.open_squads[0].count} Squad Open Recruitment`}</p>
                      </div>
                      <div className="mt-5 border-t border-slate-100 pt-4">
                        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                          Deadline pendaftaran
                        </p>
                        <time
                          dateTime={mission.deadline_pendaftaran}
                          className="mt-1 block text-sm font-bold text-slate-800"
                        >
                          {deadlineFormatter.format(
                            new Date(mission.deadline_pendaftaran),
                          )}
                        </time>
                      </div>
                      <div className="pt-5">
                        <Link href={`/missions/${mission.mission_id}`}
                          className="inline-block rounded-full border border-white/30 px-4 py-2 text-xs font-semibold hover:bg-white/10">
                          Lihat detail ↗
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

