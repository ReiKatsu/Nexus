import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import Navbar from "@/components/layout/Navbar";
import { endorsementWindow } from "@/lib/endorsement-window";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function LoadError({ displayName }: { displayName: string }) {
  return (
    <div className="nexus-app-page min-h-screen bg-slate-50 text-slate-900">
      <Navbar displayName={displayName} activeItem="my-squad" />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Link href="/my-squad" prefetch={false} className="font-bold text-indigo-700">← My Squad</Link>
        <p role="alert" className="mt-6">Daftar rekan belum dapat dimuat. Muat ulang untuk mencoba lagi.</p>
      </main>
    </div>
  );
}

export default async function SquadEndorsementsPage({ params }: {
  params: Promise<{ squadId: string }>;
}) {
  const { squadId } = await params;
  if (!UUID.test(squadId)) notFound();
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) redirect("/login");

  const [profile, membership, squad] = await Promise.all([
    supabase.from("profiles").select("nama_lengkap,role_app,status_akun,primary_class_id")
      .eq("user_id", auth.user.id).maybeSingle(),
    supabase.from("squad_members").select("squad_id")
      .eq("squad_id", squadId).eq("user_id", auth.user.id).limit(1).maybeSingle(),
    supabase.from("squads").select("nama_squad,status_squad,completed_at")
      .eq("squad_id", squadId).maybeSingle(),
  ]);
  if (profile.error) return <LoadError displayName="NEXUS" />;
  if (!profile.data || profile.data.role_app !== "STUDENT" || profile.data.status_akun !== "ACTIVE") notFound();
  if (profile.data.primary_class_id === null) redirect("/onboarding");
  if (membership.error || squad.error) return <LoadError displayName={profile.data.nama_lengkap} />;
  if (!membership.data || !squad.data || squad.data.status_squad !== "MISSION_COMPLETED") notFound();

  const [members, ratings] = await Promise.all([
    supabase.from("squad_members").select("user_id").eq("squad_id", squadId),
    supabase.from("endorsements").select("to_user_id")
      .eq("squad_id", squadId).eq("from_user_id", auth.user.id),
  ]);
  if (members.error || ratings.error) return <LoadError displayName={profile.data.nama_lengkap} />;
  const peerIds = [...new Set((members.data ?? []).map(member => member.user_id))]
    .filter(id => id !== auth.user.id);
  const peers = peerIds.length > 0
    ? await supabase.from("public_profiles").select("user_id,nama_lengkap").in("user_id", peerIds)
    : { data: [], error: null };
  if (peers.error) return <LoadError displayName={profile.data.nama_lengkap} />;
  const names = new Map((peers.data ?? []).map(peer => [peer.user_id, peer.nama_lengkap]));
  const rated = new Set((ratings.data ?? []).map(rating => rating.to_user_id));
  const window = endorsementWindow(squad.data.completed_at);

  return (
    <div className="nexus-app-page min-h-screen bg-slate-50 text-slate-900">
      <Navbar displayName={profile.data.nama_lengkap} activeItem="my-squad" />
      <main className="nexus-page-shell mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Link href="/my-squad" prefetch={false} className="text-sm font-bold text-indigo-700">← My Squad</Link>
        <section className="glass-card mt-6 rounded-2xl border border-slate-200 bg-white p-6">
          <h1 className="text-2xl font-bold">Nilai rekan Squad</h1>
          <p className="mt-2 break-words font-semibold">{squad.data.nama_squad}</p>
          <p className="mt-2 text-sm text-slate-600">
            Pilih rekan dari riwayat tim ini. Penilaian tidak menambah XP.
          </p>
          <p className="mt-2 text-sm text-slate-600">
            {window.windowOpen && window.closesAt
              ? `Batas penilaian: ${new Intl.DateTimeFormat("id-ID", {
                  dateStyle: "long", timeStyle: "short", timeZone: "Asia/Jakarta",
                }).format(new Date(window.closesAt))} WIB.`
              : "Penilaian sudah ditutup. Profil dan penilaian yang tersimpan tetap dapat dilihat."}
          </p>
          {peerIds.length === 0 ? <p className="mt-6 text-sm">Belum ada rekan pada riwayat Squad ini.</p> : (
            <ul className="mt-6 space-y-3">
              {peerIds.map(id => (
                <li key={id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4">
                  <div className="min-w-0">
                    <p className="break-words font-bold [overflow-wrap:anywhere]">{names.get(id) ?? "Profil rekan belum tersedia"}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {rated.has(id) ? "Sudah dinilai" : window.windowOpen ? "Belum dinilai" : "Penilaian ditutup"}
                    </p>
                  </div>
                  {names.has(id) && (
                    <Link href={`/profile/${id}?squad=${squadId}`} prefetch={false}
                      className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white">
                      {window.windowOpen && !rated.has(id) ? "Nilai rekan" : "Lihat profil"}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
