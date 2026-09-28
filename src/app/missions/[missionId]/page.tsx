import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import Navbar from "@/components/layout/Navbar";
import { createClient } from "@/lib/supabase/server";

import CreateSquadForm from "./CreateSquadForm";
import JoinSquadButton from "./JoinSquadButton";
import SquadApplicationDecisionList, {
  type SquadApplicationDecisionItem,
} from "./SquadApplicationDecisionList";

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const applicationDateFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
});

type MissionTier = {
  kode_tier: string | null;
  nama_tier: string | null;
};

type MissionSquadLeader = {
  squad_id: string;
  nama_ketua: string | null;
};

type LeaderPendingSquadApplication = {
  application_id: string;
  squad_id: string;
  applicant_name: string;
  primary_class_name: string | null;
  created_at: string;
};

type MissionDetailPageProps = {
  params: Promise<{
    missionId: string;
  }>;
};

function getRelatedTier(relation: unknown): MissionTier | null {
  if (Array.isArray(relation)) return (relation[0] as MissionTier) ?? null;
  if (relation && typeof relation === "object") return relation as MissionTier;
  return null;
}

function getSquadStatusLabel(status: string | null): "Open" | "Locked" | null {
  if (status === "OPEN_RECRUITMENT") return "Open";
  if (status === "FULL" || status === "FINALIZED") return "Locked";
  return null;
}

function formatEnumLabel(value: string | null): string {
  if (!value) return "-";

  const label = value.trim().toLocaleLowerCase("id-ID").replaceAll("_", " ");
  return label.charAt(0).toLocaleUpperCase("id-ID") + label.slice(1);
}

function formatDate(value: string | null): string {
  return value ? dateFormatter.format(new Date(value)) : "-";
}

function formatApplicationDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Waktu tidak tersedia"
    : applicationDateFormatter.format(date);
}

export default async function MissionDetailPage({
  params,
}: MissionDetailPageProps) {
  const supabase = await createClient();
  const { data: authData, error: authError } =
    await supabase.auth.getUser();

  if (authError || !authData.user) redirect("/login");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("nama_lengkap, primary_class_id, status_akun")
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
            Mission belum dapat dimuat
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Data profil sedang tidak tersedia.
          </p>
        </section>
      </main>
    );
  }

  if (profile.primary_class_id === null) redirect("/onboarding");

  const { missionId } = await params;
  const { data: mission, error: missionError } = await supabase
    .from("missions")
    .select(
      `
        mission_id,
        nama_lomba,
        penyelenggara,
        link_resmi,
        deadline_pendaftaran,
        deadline_lomba,
        tahun_lomba,
        kategori_lomba,
        cakupan_peserta,
        mode_lomba,
        min_anggota_tim,
        max_anggota_tim,
        biaya_pendaftaran,
        deskripsi_singkat,
        tier_id,
        mission_tiers (
          kode_tier,
          nama_tier
        )
      `,
    )
    .eq("mission_id", missionId)
    .maybeSingle();

  if (missionError) {
    return (
      <div className="flex min-h-screen flex-col bg-slate-50">
        <Navbar displayName={profile.nama_lengkap} activeItem="missions" />
        <main className="flex flex-1 items-center justify-center px-4 py-8 text-slate-900">
          <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-200/60">
            <p className="text-sm font-bold tracking-[0.22em] text-indigo-600">
              NEXUS
            </p>
            <h1 className="mt-4 text-2xl font-bold text-slate-950">
              Mission belum dapat dimuat
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Data Mission sedang tidak tersedia.
            </p>
          </section>
        </main>
      </div>
    );
  }

  if (!mission) notFound();

  const relatedTier = getRelatedTier(mission.mission_tiers);
  const tierCode = relatedTier?.kode_tier?.trim();
  const tierLabel = tierCode
    ? `${tierCode.toLocaleUpperCase("id-ID")}-Rank`
    : "Tier belum tersedia";
  const registrationDeadline = Date.parse(mission.deadline_pendaftaran);
  // This authenticated Server Component is request-bound. The RPC remains the
  // authoritative deadline guard if the page stays open past this timestamp.
  // eslint-disable-next-line react-hooks/purity
  const requestTimestamp = Date.now();
  const registrationOpen =
    Number.isFinite(registrationDeadline) &&
    registrationDeadline > requestTimestamp;

  const [
    squadsResult,
    squadLeadersResult,
    primaryClassesResult,
    activeMembershipResult,
    pendingApplicationsResult,
    leaderApplicationsResult,
  ] =
    await Promise.all([
      supabase
        .from("squads")
        .select(
          `
            squad_id,
            nama_squad,
            deskripsi_squad,
            kapasitas_anggota,
            status_squad,
            ketua_id
          `,
        )
        .eq("mission_id", missionId)
        .neq("status_squad", "MISSION_COMPLETED"),
      supabase.rpc("get_mission_squad_leaders", {
        p_mission_id: missionId,
      }),
      supabase
        .from("primary_classes")
        .select("primary_class_id, nama_class")
        .order("nama_class"),
      supabase
        .from("squad_members")
        .select("squad_id")
        .eq("mission_id", missionId)
        .eq("user_id", authData.user.id)
        .eq("status_member", "ACTIVE")
        .limit(1)
        .maybeSingle(),
      supabase
        .from("squad_applications")
        .select("application_id, squad_id")
        .eq("mission_id", missionId)
        .eq("user_id", authData.user.id)
        .eq("status_application", "PENDING"),
      supabase.rpc("get_leader_pending_squad_applications", {
        p_mission_id: missionId,
      }),
    ]);

  const squads = squadsResult.data;
  const squadsError = squadsResult.error;
  const squadLeadersError = squadLeadersResult.error;
  const applicationStatusLoadFailed = Boolean(
    activeMembershipResult.error || pendingApplicationsResult.error,
  );
  const leaderApplicationsLoadFailed = Boolean(
    leaderApplicationsResult.error,
  );
  const hasActiveMembership = Boolean(activeMembershipResult.data);
  const pendingApplicationIdsBySquad = new Map(
    (pendingApplicationsResult.data ?? []).map(
      (application) => [application.squad_id, application.application_id],
    ),
  );
  const pendingApplicationCount = pendingApplicationIdsBySquad.size;
  const leaderApplicationsBySquad = new Map<
    string,
    SquadApplicationDecisionItem[]
  >();

  for (const application of
    (leaderApplicationsResult.data ?? []) as LeaderPendingSquadApplication[]) {
    const applications =
      leaderApplicationsBySquad.get(application.squad_id) ?? [];
    applications.push({
      applicationId: application.application_id,
      applicantName: application.applicant_name,
      primaryClassName: application.primary_class_name,
      submittedAtLabel: formatApplicationDate(application.created_at),
    });
    leaderApplicationsBySquad.set(application.squad_id, applications);
  }
  const squadLeaderNames = new Map<string, string | null>(
    ((squadLeadersResult.data ?? []) as MissionSquadLeader[]).map((leader) => [
      leader.squad_id,
      leader.nama_ketua,
    ]),
  );

  return (
    <div className="flex min-h-screen w-full min-w-0 flex-col overflow-x-clip bg-slate-50">
      <Navbar displayName={profile.nama_lengkap} activeItem="missions" />
      <main className="relative flex w-full min-w-0 flex-1 justify-center overflow-x-clip px-4 py-7 text-slate-900 sm:px-6 sm:py-10 lg:py-14">
        <div
          aria-hidden="true"
          className="absolute -left-32 -top-32 h-80 w-80 rounded-full bg-indigo-200/50 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-40 -right-32 h-96 w-96 rounded-full bg-violet-200/50 blur-3xl"
        />

        <article className="relative w-full min-w-0 max-w-4xl">
          <Link
            href="/missions"
            className="inline-flex rounded-lg text-sm font-bold text-indigo-600 transition hover:text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          >
            ← Kembali ke Missions
          </Link>

          <section className="mt-5 rounded-2xl border border-white/80 bg-white/90 p-5 shadow-xl shadow-slate-200/60 backdrop-blur sm:rounded-3xl sm:p-8 lg:p-10">
            <div className="border-b border-slate-100 pb-6">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700">
                  {tierLabel}
                </span>
                {relatedTier?.nama_tier && (
                  <span className="rounded-full border border-violet-100 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700">
                    {relatedTier.nama_tier}
                  </span>
                )}
              </div>
              <h1 className="mt-4 break-words text-2xl font-bold tracking-tight text-slate-950 [overflow-wrap:anywhere] sm:text-3xl lg:text-4xl">
                {mission.nama_lomba}
              </h1>
              <p className="mt-2 break-words text-sm text-slate-500 [overflow-wrap:anywhere] sm:text-base">
                Diselenggarakan oleh {mission.penyelenggara}
              </p>
            </div>

            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              {[
                ["Kategori", formatEnumLabel(mission.kategori_lomba)],
                ["Mode", formatEnumLabel(mission.mode_lomba)],
                ["Biaya", formatEnumLabel(mission.biaya_pendaftaran)],
                ["Cakupan peserta", formatEnumLabel(mission.cakupan_peserta)],
                ["Tahun lomba", String(mission.tahun_lomba)],
                [
                  "Jumlah anggota tim",
                  mission.min_anggota_tim === null ||
                  mission.max_anggota_tim === null
                    ? "Belum tersedia"
                    : mission.min_anggota_tim === mission.max_anggota_tim
                      ? `${mission.min_anggota_tim} orang`
                      : `${mission.min_anggota_tim}–${mission.max_anggota_tim} orang`,
                ],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0 rounded-2xl bg-slate-50 p-4">
                  <dt className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                    {label}
                  </dt>
                  <dd className="mt-2 break-words text-sm font-bold text-slate-800 [overflow-wrap:anywhere]">
                    {value}
                  </dd>
                </div>
              ))}
              <div className="min-w-0 rounded-2xl bg-slate-50 p-4">
                <dt className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                  Deadline pendaftaran
                </dt>
                <dd className="mt-2 text-sm font-bold text-slate-800">
                  <time dateTime={mission.deadline_pendaftaran}>
                    {formatDate(mission.deadline_pendaftaran)}
                  </time>
                </dd>
              </div>
              <div className="min-w-0 rounded-2xl bg-slate-50 p-4">
                <dt className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                  Deadline lomba
                </dt>
                <dd className="mt-2 text-sm font-bold text-slate-800">
                  <time dateTime={mission.deadline_lomba ?? undefined}>
                    {formatDate(mission.deadline_lomba)}
                  </time>
                </dd>
              </div>
            </dl>

            <div className="mt-6 border-t border-slate-100 pt-6">
              <h2 className="text-lg font-bold text-slate-950">
                Tentang Mission
              </h2>
              <p className="mt-3 whitespace-pre-line break-words text-sm leading-7 text-slate-600 [overflow-wrap:anywhere] sm:text-base">
                {mission.deskripsi_singkat || "Deskripsi Mission belum tersedia."}
              </p>
            </div>

            {mission.link_resmi && (
              <div className="mt-7">
                <a
                  href={mission.link_resmi}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-full items-center justify-center rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-700 sm:w-auto"
                >
                  Lihat Halaman Resmi
                </a>
              </div>
            )}
          </section>

          <CreateSquadForm
            missionId={missionId}
            primaryClasses={primaryClassesResult.data ?? []}
            primaryClassesLoadFailed={Boolean(primaryClassesResult.error)}
            registrationOpen={registrationOpen}
            minimumTeamSize={mission.min_anggota_tim}
            maximumTeamSize={mission.max_anggota_tim}
          />

          <section className="mt-7 sm:mt-8">
            <h2 className="text-xl font-bold text-slate-950 sm:text-2xl">
              Squad Tersedia
            </h2>

            {squadLeadersError && !squadsError && (squads ?? []).length > 0 && (
              <div
                role="alert"
                className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800"
              >
                Nama Ketua belum dapat dimuat. Data Squad lainnya tetap
                ditampilkan.
              </div>
            )}

            {squadsError ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm sm:p-8">
                <p className="font-bold text-slate-950">
                  Squad belum dapat dimuat
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Data Squad sedang tidak tersedia.
                </p>
              </div>
            ) : (squads ?? []).length === 0 ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm sm:p-8">
                <p className="font-bold text-slate-950">
                  Belum ada Squad tersedia
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Squad untuk Mission ini belum tersedia.
                </p>
              </div>
            ) : (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {(squads ?? []).map((squad) => {
                  const leaderName = squadLeaderNames.get(squad.squad_id);
                  const statusLabel = getSquadStatusLabel(squad.status_squad);
                  const isOwnSquad = squad.ketua_id === authData.user.id;
                  const pendingApplicationId =
                    pendingApplicationIdsBySquad.get(squad.squad_id);
                  const hasPendingApplication = Boolean(pendingApplicationId);
                  const leaderApplications =
                    leaderApplicationsBySquad.get(squad.squad_id) ?? [];
                  const acceptDisabledReason =
                    squad.status_squad !== "OPEN_RECRUITMENT"
                      ? "Squad Locked tidak dapat menerima pelamar baru."
                      : !registrationOpen
                        ? "Pendaftaran Mission sudah ditutup."
                        : undefined;
                  let joinState:
                    | "eligible"
                    | "pending"
                    | "member"
                    | "disabled" = "eligible";
                  let disabledReason: string | undefined;

                  if (hasActiveMembership || isOwnSquad) {
                    joinState = "member";
                  } else if (hasPendingApplication) {
                    joinState = "pending";
                  } else if (applicationStatusLoadFailed) {
                    joinState = "disabled";
                    disabledReason =
                      "Status Join belum dapat dimuat. Muat ulang halaman untuk mencoba lagi.";
                  } else if (profile.status_akun !== "ACTIVE") {
                    joinState = "disabled";
                    disabledReason =
                      "Akun ACTIVE diperlukan untuk mengajukan Join Squad.";
                  } else if (!registrationOpen) {
                    joinState = "disabled";
                    disabledReason = "Pendaftaran Mission sudah ditutup.";
                  } else if (pendingApplicationCount >= 3) {
                    joinState = "disabled";
                    disabledReason =
                      "Batas 3 aplikasi Pending pada Mission ini sudah tercapai.";
                  }

                  return (
                    <article
                      key={squad.squad_id}
                      className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/60 sm:p-6"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <h3 className="break-words text-lg font-bold text-slate-950 [overflow-wrap:anywhere]">
                          {squad.nama_squad}
                        </h3>
                        {statusLabel && (
                          <span
                            className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${statusLabel === "Open" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}
                          >
                            {statusLabel}
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-sm font-semibold text-slate-600">
                        Ketua:{" "}
                        {squadLeadersError
                          ? "Nama gagal dimuat"
                          : leaderName ?? "Belum tersedia"}
                      </p>
                      <p className="mt-3 break-words text-sm leading-6 text-slate-500 [overflow-wrap:anywhere]">
                        {squad.deskripsi_squad || "Deskripsi Squad belum tersedia."}
                      </p>
                      <p className="mt-4 border-t border-slate-100 pt-4 text-sm font-bold text-slate-700">
                        Kapasitas: {squad.kapasitas_anggota} anggota
                      </p>
                      {squad.status_squad === "OPEN_RECRUITMENT" ||
                      hasPendingApplication ? (
                        <JoinSquadButton
                          key={`${squad.squad_id}:${joinState}:${pendingApplicationId ?? "none"}`}
                          squadId={squad.squad_id}
                          initialState={joinState}
                          pendingApplicationId={pendingApplicationId}
                          disabledReason={disabledReason}
                        />
                      ) : (
                        <p className="mt-4 border-t border-slate-100 pt-4 text-sm font-semibold text-slate-500">
                          Squad terkunci dan tidak menerima aplikasi.
                        </p>
                      )}
                      {isOwnSquad &&
                        (leaderApplicationsLoadFailed ? (
                          <div
                            role="alert"
                            className="mt-5 border-t border-slate-100 pt-4 text-xs leading-5 text-amber-700"
                          >
                            Daftar pelamar belum dapat dimuat. Muat ulang halaman
                            untuk mencoba lagi.
                          </div>
                        ) : (
                          <SquadApplicationDecisionList
                            key={`${squad.squad_id}:${leaderApplications.map((application) => application.applicationId).join(",")}:${acceptDisabledReason ?? "open"}`}
                            applications={leaderApplications}
                            acceptDisabledReason={acceptDisabledReason}
                          />
                        ))}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </article>
      </main>
    </div>
  );
}
