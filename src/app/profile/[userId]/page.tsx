import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import Navbar from "@/components/layout/Navbar";
import BadgePill from "@/components/profile/BadgePill";
import EndorsementPanel from "@/components/profile/EndorsementPanel";
import ProfileHero from "@/components/profile/ProfileHero";
import RankSwitcherCard from "@/components/profile/RankSwitcherCard";
import XpProgressCard from "@/components/profile/XpProgressCard";
import { badgeTone, describeBadge, facultyAbbreviation } from "@/lib/badges";
import { loadEndorsementSummary, loadSharedCompletedSquads } from "@/lib/endorsements";
import { createClient } from "@/lib/supabase/server";
import EndorsementForm from "./EndorsementForm";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PeerProfilePage({ params, searchParams }: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ squad?: string | string[]; mission?: string | string[] }>;
}) {
  const [{ userId }, query] = await Promise.all([params, searchParams]);
  if (!UUID.test(userId)) notFound();

  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) redirect("/login");
  if (auth.user.id === userId) redirect("/profile");

  const viewerResult = await supabase.from("profiles")
    .select("nama_lengkap, role_app, status_akun, foto_profil_path")
    .eq("user_id", auth.user.id).maybeSingle();
  if (!viewerResult.error && viewerResult.data?.role_app === "ADMIN") redirect("/admin");
  if (viewerResult.error || !viewerResult.data || viewerResult.data.status_akun !== "ACTIVE") {
    notFound();
  }
  const peerResult = await supabase.from("public_profiles")
    .select("nama_lengkap, bio, tahun_masuk, foto_profil_path, primary_class_id, program_studi_id")
    .eq("user_id", userId).maybeSingle();
  if (peerResult.error || !peerResult.data) notFound();

  const peer = peerResult.data;
  const [classResult, programResult, summary, sharedSquads, skillsResult, careerResult,
    rulesResult, equippedResult] = await Promise.all([
    peer.primary_class_id === null
      ? Promise.resolve({ data: null, error: null })
      : supabase.from("primary_classes").select("nama_class")
          .eq("primary_class_id", peer.primary_class_id).maybeSingle(),
    supabase.from("program_studi").select("nama_program_studi, fakultas_id")
      .eq("program_studi_id", peer.program_studi_id).maybeSingle(),
    loadEndorsementSummary(supabase, userId),
    viewerResult.data.role_app === "STUDENT"
      ? loadSharedCompletedSquads(supabase, auth.user.id, userId)
      : Promise.resolve([]),
    supabase.from("user_skills").select("skills(nama_skill)").eq("user_id", userId),
    supabase.from("career_xp_totals").select("career_xp").eq("user_id", userId).maybeSingle(),
    supabase.from("rank_rules").select("rank_name, min_xp, max_xp")
      .order("min_xp", { ascending: true }),
    // Sanitized read contract: only the single badge the student chose to display.
    supabase.from("public_equipped_badges")
      .select("badge_name, scope_type, rank_position, population_total, program_studi_name, fakultas_name")
      .eq("user_id", userId).maybeSingle(),
  ]);
  const facultyResult = programResult.data
    ? await supabase.from("fakultas").select("nama_fakultas")
        .eq("fakultas_id", programResult.data.fakultas_id).maybeSingle()
    : { data: null, error: null };
  const avatar = peer.foto_profil_path
    ? supabase.storage.from("avatars").getPublicUrl(peer.foto_profil_path).data.publicUrl
    : null;
  const context = typeof query.squad === "string" && UUID.test(query.squad)
    ? sharedSquads?.find(squad => squad.squadId === query.squad)
    : undefined;
  // This parameter only selects an internal return link, never access or eligibility.
  const missionId = typeof query.mission === "string" && UUID.test(query.mission)
    ? query.mission : null;
  const skills = (skillsResult.data ?? []).flatMap((row) => row.skills ?? [])
    .map((skill) => skill.nama_skill).sort((a, b) => a.localeCompare(b));

  // A missing view or an unequipped badge simply shows no pill on someone else's profile.
  const equipped = equippedResult.error ? null : equippedResult.data;
  const badge = equipped ? describeBadge({
    badgeName: equipped.badge_name ?? null,
    scopeType: equipped.scope_type ?? null,
    scopeName: equipped.scope_type === "FAKULTAS" ? equipped.fakultas_name ?? null
      : equipped.scope_type === "PROGRAM_STUDI" ? equipped.program_studi_name ?? null : null,
    rankPosition: equipped.rank_position ?? null,
    populationTotal: equipped.population_total ?? null,
  }) : null;
  const badgeNode = badge ? (
    <BadgePill scope={badge.scope} tier={badge.tier} detail={badge.detail}>{badge.label}</BadgePill>
  ) : null;

  const tags = [
    classResult.data?.nama_class,
    facultyResult.data ? facultyAbbreviation(facultyResult.data.nama_fakultas) : null,
    programResult.data?.nama_program_studi,
    `UNESA ${peer.tahun_masuk}`,
  ].filter((tag): tag is string => Boolean(tag));

  const rules = rulesResult.data ?? [];
  const xpReady = !careerResult.error && careerResult.data !== null &&
    !rulesResult.error && rules.length > 0;

  return (
    <div className="nexus-app-page min-h-screen bg-slate-50 text-slate-900">
      <Navbar displayName={viewerResult.data.nama_lengkap} avatarPath={viewerResult.data.foto_profil_path} activeItem={missionId ? "missions" : context ? "my-squad" : "leaderboard"} />
      <main className="nexus-page-shell profile-v2 mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Link href={missionId ? `/missions/${missionId}` : context ? `/squads/${context.squadId}/endorsements` : "/leaderboard"}
          prefetch={false} className="profile-back">
          {missionId ? "← Kembali ke Mission" : context ? `← Detail ${context.name}` : "← Leaderboard"}
        </Link>

        <ProfileHero name={peer.nama_lengkap} avatarUrl={avatar} tone={badgeTone(badge)}
          badge={badgeNode} tags={tags} bio={peer.bio?.trim() || "Belum ada bio."} />

        <div className="profile-grid profile-grid--peer">
          {xpReady && careerResult.data ? (
            <>
              <XpProgressCard area="pc-career" tone="career" title="Career XP"
                subtitle="XP Career Total" xp={careerResult.data.career_xp} rules={rules} />
              <RankSwitcherCard area="pc-rank" rules={rules}
                options={[{ key: "career", label: "Career Rank", xp: careerResult.data.career_xp }]} />
            </>
          ) : (
            <section className="profile-card pc-career" aria-label="Career XP">
              <h2>Career XP</h2>
              <p role="alert" className="history2-note">XP belum dapat dimuat. Coba muat ulang.</p>
            </section>
          )}

          <section className="profile-card pc-skills" aria-label="Skills">
            <h2>Skills</h2>
            {skillsResult.error ? (
              <p role="alert" className="history2-note">Skill belum dapat dimuat. Coba muat ulang halaman.</p>
            ) : skills.length > 0 ? (
              <ul className="skills2-list">
                {skills.map((skill) => <li key={skill}>{skill}</li>)}
              </ul>
            ) : <p className="history2-note">Belum ada Skill yang dipilih.</p>}
          </section>

          <EndorsementPanel area="pc-endorse" summary={summary}>
            {sharedSquads === null ? (
              <p role="alert" className="endorse2-note endorse2-note--error">
                Ketersediaan penilaian belum dapat diperiksa. Coba muat ulang.
              </p>
            ) : sharedSquads.length > 0 ? (
              <EndorsementForm key={context?.squadId ?? "all-squads"} targetUserId={userId}
                squads={context ? [context] : sharedSquads} />
            ) : null}
          </EndorsementPanel>
        </div>
      </main>
    </div>
  );
}
