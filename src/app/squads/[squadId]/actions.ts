"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

import type { SendMessageResult } from "./types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_MESSAGE_LENGTH = 2000;

export async function sendSquadMessage(
  squadId: string,
  content: string,
): Promise<SendMessageResult> {
  if (typeof squadId !== "string" || !UUID_PATTERN.test(squadId)) {
    return { success: false, message: "Squad tidak valid." };
  }

  const text = typeof content === "string" ? content.trim() : "";
  if (!text || text.length > MAX_MESSAGE_LENGTH) {
    return {
      success: false,
      message: "Pesan wajib diisi dan maksimal 2.000 karakter.",
    };
  }

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return { success: false, message: "Sesi berakhir. Silakan login kembali." };
  }

  const { data: membership, error: membershipError } = await supabase
    .from("squad_members")
    .select("squad_id")
    .eq("squad_id", squadId)
    .eq("user_id", authData.user.id)
    .eq("status_member", "ACTIVE")
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    return { success: false, message: "Status keanggotaan belum dapat diperiksa." };
  }
  if (!membership) {
    return { success: false, message: "Kamu tidak memiliki akses chat Squad ini." };
  }

  // The database RLS policy checks current account status, active membership,
  // sender identity, and Squad completion again at INSERT time.
  const { error: insertError } = await supabase.from("squad_messages").insert({
    squad_id: squadId,
    sender_id: authData.user.id,
    content: text,
  });

  if (insertError) {
    return {
      success: false,
      message:
        insertError.code === "42501"
          ? "Akses chat ditolak. Muat ulang halaman untuk melihat status Squad."
          : "Pesan belum terkirim. Silakan coba lagi.",
    };
  }

  revalidatePath(`/squads/${squadId}`);
  return { success: true };
}
