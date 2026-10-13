import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import Navbar from "@/components/layout/Navbar";
import { createClient } from "@/lib/supabase/server";

import CreateSquadForm from "./CreateSquadForm";
import type { SquadApplicationDecisionItem } from "./SquadApplicationDecisionList";
import { formatApplicationDate, getRelatedTier } from "./mission-detail/formatters";
import MissionOverview from "./mission-detail/MissionOverview";
import SquadList from "./mission-detail/SquadList";
import type {
  LeaderPendingSquadApplication,
  MissionDetail,
  MissionSquad,
  MissionSquadLeader,
} from "./mission-detail/types";

type MissionDetailPageProps = {
  params: Promise<{
    missionId: string;
  }>;
  searchParams: Promise<{ status?: string | string[] }>;
};

function ProfileLoadError() {
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

function MissionLoadError({ displayName }: { displayName: string }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Navbar displayName={displayName} activeItem="missions" />
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

export default async function MissionDetailPage({
  params,
  searchParams,
}: MissionDetailPageProps) {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) redirect("/login");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("nama_lengkap, primary_class_id, status_akun")
    .eq("user_id", authData.user.id)
    .maybeSingle();

  if (profileError || !profile) return <ProfileLoadError />;
  if (profile.primary_class_id === null) redirect("/onboarding");

  const { missionId } = await params;
  const requestedStatus = (await searchParams).status;
  const squadFilter = requestedStatus === "open" || requestedStatus === "locked" ? requestedStatus : "all";
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
    return <MissionLoadError displayName={profile.nama_lengkap} />;
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
  ] = await Promise.all([
    supabase
      .from("squads")
      .select(
        `
          squad_id,
          nama_squad,
          deskripsi_squad,
          kapasitas_anggota,
          status_squad,
          ketua_id,
          active_members:squad_members(count)
        `,
      )
      .eq("mission_id", missionId)
      .eq("active_members.status_member", "ACTIVE")
      .in("status_squad", ["OPEN_RECRUITMENT", "FULL", "FINALIZED"]),
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

  const applicationStatusLoadFailed = Boolean(
    activeMembershipResult.error || pendingApplicationsResult.error,
  );
  const hasActiveMembership = Boolean(activeMembershipResult.data);
  const pendingApplicationIdsBySquad = new Map(
    (pendingApplicationsResult.data ?? []).map((application) => [
      application.squad_id,
      application.application_id,
    ]),
  );
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

        <article className="relative w-full min-w-0 max-w-7xl">
          <Link
            href="/missions"
            className="inline-flex rounded-lg text-sm font-bold text-indigo-600 transition hover:text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          >
            ← Kembali ke Missions
          </Link>

          <MissionOverview
            mission={mission as MissionDetail}
            relatedTier={relatedTier}
            tierLabel={tierLabel}
          />

          <div className="squad-filter">
            <h2 className="text-xl font-semibold">Squad Tersedia <span className="ml-2 rounded-full bg-white/20 px-3 py-1 text-sm">{squadsResult.error ? "—" : squadsResult.data?.length ?? 0}</span></h2>
            <nav aria-label="Filter status squad">
              {[["all", "Semua"], ["open", "Open Recruitment"], ["locked", "Locked"]].map(([key, label]) => (
                <Link key={key} href={key === "all" ? `/missions/${missionId}` : `/missions/${missionId}?status=${key}`}
                  aria-current={squadFilter === key ? "page" : undefined}>{label}</Link>
              ))}
            </nav>
          </div>
          <CreateSquadForm
            missionId={missionId}
            primaryClasses={primaryClassesResult.data ?? []}
            primaryClassesLoadFailed={Boolean(primaryClassesResult.error)}
            registrationOpen={registrationOpen}
            hasActiveMembership={hasActiveMembership}
            membershipLoadFailed={Boolean(activeMembershipResult.error)}
            minimumTeamSize={mission.min_anggota_tim}
            maximumTeamSize={mission.max_anggota_tim}
          />

          <SquadList
            squads={((squadsResult.data as MissionSquad[] | null) ?? []).filter((squad) =>
              squadFilter === "all" || (squadFilter === "open" ? squad.status_squad === "OPEN_RECRUITMENT"
                : squad.status_squad === "FULL" || squad.status_squad === "FINALIZED"))}
            squadsLoadFailed={Boolean(squadsResult.error)}
            squadLeadersLoadFailed={Boolean(squadLeadersResult.error)}
            leaderApplicationsLoadFailed={Boolean(
              leaderApplicationsResult.error,
            )}
            squadLeaderNames={squadLeaderNames}
            leaderApplicationsBySquad={leaderApplicationsBySquad}
            pendingApplicationIdsBySquad={pendingApplicationIdsBySquad}
            pendingApplicationCount={pendingApplicationIdsBySquad.size}
            applicationStatusLoadFailed={applicationStatusLoadFailed}
            hasActiveMembership={hasActiveMembership}
            currentUserId={authData.user.id}
            accountStatus={profile.status_akun}
            registrationOpen={registrationOpen}
          />
        </article>
      </main>
    </div>
  );
}
