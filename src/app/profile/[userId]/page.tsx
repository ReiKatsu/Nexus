import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import Navbar from "@/components/layout/Navbar";
import EndorsementSummary from "@/components/profile/EndorsementSummary";
import { loadEndorsementSummary, loadSharedCompletedSquads } from "@/lib/endorsements";
import { createClient } from "@/lib/supabase/server";
import EndorsementForm from "./EndorsementForm";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PeerProfilePage({ params, searchParams }: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ squad?: string | string[] }>;
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
  const [classResult, programResult, summary, sharedSquads] = await Promise.all([
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar displayName={viewerResult.data.nama_lengkap} avatarPath={viewerResult.data.foto_profil_path} activeItem={context ? "my-squad" : "leaderboard"} />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Link href={context ? `/squads/${context.squadId}/endorsements` : "/leaderboard"}
          prefetch={false} className="text-sm font-semibold text-indigo-700 hover:underline">
          {context ? `← Detail ${context.name}` : "← Leaderboard"}
        </Link>
        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center gap-4">
            {avatar ? <Image src={avatar} alt={`Foto ${peer.nama_lengkap}`}
              width={72} height={72} unoptimized className="h-18 w-18 rounded-full object-cover" />
              : <span aria-hidden="true" className="flex h-18 w-18 items-center justify-center rounded-full bg-indigo-100 text-2xl font-bold text-indigo-700">
                  {peer.nama_lengkap.trim().charAt(0).toUpperCase() || "N"}
                </span>}
            <div>
              <h1 className="text-2xl font-bold">{peer.nama_lengkap}</h1>
              <p className="mt-1 text-sm text-slate-600">
                {programResult.data?.nama_program_studi ?? "Program Studi belum tersedia"} · {facultyResult.data?.nama_fakultas ?? "Fakultas belum tersedia"}
              </p>
            </div>
          </div>
          <p className="mt-6 whitespace-pre-line text-sm text-slate-700">{peer.bio?.trim() || "Belum ada bio."}</p>
          <dl className="mt-6 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2">
            <div><dt className="text-xs font-semibold text-slate-500">Primary Class</dt>
              <dd className="mt-1 font-semibold">{classResult.data?.nama_class ?? "Belum dipilih"}</dd></div>
            <div><dt className="text-xs font-semibold text-slate-500">Tahun masuk</dt>
              <dd className="mt-1 font-semibold">{peer.tahun_masuk}</dd></div>
          </dl>
        </section>
        <EndorsementSummary summary={summary} />
        {sharedSquads === null ? (
          <p role="alert" className="mt-6 text-sm text-red-700">
            Ketersediaan penilaian belum dapat diperiksa. Coba muat ulang.
          </p>
        ) : sharedSquads.length > 0 ? (
          <EndorsementForm key={context?.squadId ?? "all-squads"} targetUserId={userId}
            squads={context ? [context] : sharedSquads} />
        ) : null}
      </main>
    </div>
  );
}
