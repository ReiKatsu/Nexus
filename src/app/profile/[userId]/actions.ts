"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { ENDORSEMENT_FIELDS, type EndorsementScores } from "@/lib/endorsements";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Result = { success: true } | { success: false; message: string };

export async function submitEndorsement(
  targetUserId: string,
  squadId: string,
  scores: EndorsementScores,
): Promise<Result> {
  if (!UUID.test(targetUserId) || !UUID.test(squadId) || !scores ||
      ENDORSEMENT_FIELDS.some(([field]) => !Number.isInteger(scores[field]) ||
        scores[field] < 1 || scores[field] > 5)) {
    return { success: false, message: "Pilih Squad dan isi empat nilai dari 1 sampai 5." };
  }

  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) {
    return { success: false, message: "Sesi berakhir. Silakan login kembali." };
  }
  if (auth.user.id === targetUserId) {
    return { success: false, message: "Kamu tidak dapat menilai diri sendiri." };
  }

  const { data: profile, error: profileError } = await supabase.from("profiles")
    .select("role_app,status_akun,primary_class_id")
    .eq("user_id", auth.user.id).maybeSingle();
  if (profileError || profile?.role_app !== "STUDENT" || profile.status_akun !== "ACTIVE" ||
      profile.primary_class_id === null) {
    return { success: false, message: "Akun ini belum dapat memberi penilaian." };
  }

  const [squadResult, membersResult] = await Promise.all([
    supabase.from("squads").select("squad_id,status_squad")
      .eq("squad_id", squadId).maybeSingle(),
    supabase.from("squad_members").select("user_id")
      .eq("squad_id", squadId).in("user_id", [auth.user.id, targetUserId]),
  ]);
  if (squadResult.error || membersResult.error ||
      squadResult.data?.status_squad !== "MISSION_COMPLETED" ||
      new Set((membersResult.data ?? []).map((row) => row.user_id)).size !== 2) {
    return { success: false, message: "Penilaian hanya tersedia untuk rekan dari Mission yang selesai." };
  }

  const { error } = await supabase.from("endorsements").insert({
    squad_id: squadId,
    from_user_id: auth.user.id,
    to_user_id: targetUserId,
    communication: scores.communication,
    contribution: scores.contribution,
    teamwork: scores.teamwork,
    responsibility: scores.responsibility,
  });
  if (error) {
    return { success: false, message: error.code === "23505"
      ? "Kamu sudah menilai rekan ini untuk Squad tersebut. Muat ulang halaman."
      : "Penilaian belum tersimpan. Muat ulang lalu coba lagi." };
  }

  revalidatePath(`/profile/${targetUserId}`);
  revalidatePath("/profile");
  return { success: true };
}
