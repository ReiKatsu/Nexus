import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import { validSubmissionId, validateDocument, validateFields } from
  "@/app/missions/add/validation";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const BUCKET = "mission-documents";

function fail(message: string, status = 400) {
  return Response.json({ success: false, message }, { status });
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  try {
    if (origin && (!host || new URL(origin).host !== host)) {
      return fail("Permintaan tidak diizinkan.", 403);
    }
  } catch { return fail("Permintaan tidak diizinkan.", 403); }
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data")) {
    return fail("Format pengiriman tidak valid.");
  }
  const length = Number(request.headers.get("content-length"));
  if (Number.isFinite(length) && length > 11_500_000) {
    return fail("Berkas terlalu besar.", 413);
  }

  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return fail("Silakan login kembali.", 401);
  const userId = auth.user.id;
  const { data: profile, error: profileError } = await supabase.from("profiles")
    .select("role_app,status_akun,primary_class_id")
    .eq("user_id", userId).maybeSingle();
  if (profileError || profile?.role_app !== "STUDENT" ||
      profile.status_akun !== "ACTIVE" || profile.primary_class_id === null) {
    return fail("Akun mahasiswa belum dapat mengajukan Mission.", 403);
  }

  let form: FormData;
  try { form = await request.formData(); } catch { return fail("Isian tidak dapat dibaca."); }
  const fields = validateFields(form);
  const file = form.get("dokumen");
  const oldId = form.get("submission_id");
  if (!fields || !(file instanceof File) ||
      (oldId !== null && (typeof oldId !== "string" || !validSubmissionId(oldId)))) {
    return fail("Periksa kembali isian, deadline, jumlah peserta, dan berkas.");
  }
  const kind = await validateDocument(file);
  if (!kind) return fail("Berkas harus PDF/JPG/PNG asli, maksimal 10 MiB.");

  const oldQuery = oldId
    ? await supabase.from("mission_submissions")
        .select("mission_submission_id,submitted_by,status_review,dokumen_path")
        .eq("mission_submission_id", oldId).maybeSingle()
    : { data: null, error: null };
  if (oldQuery.error) return fail("Pengajuan belum dapat diperiksa.", 503);
  const old = oldQuery.data;
  if (oldId && (!old || old.submitted_by !== userId || old.status_review !== "REJECTED")) {
    return fail("Hanya pengajuan yang ditolak dapat dikirim ulang.", 409);
  }

  const submissionId = old?.mission_submission_id ?? randomUUID();
  const path = `${userId}/${submissionId}/${randomUUID()}.${kind.extension}`;
  const storage = supabase.storage.from(BUCKET);
  const { error: uploadError } = await storage.upload(path, file, {
    contentType: kind.contentType, upsert: false,
  });
  if (uploadError) return fail("Berkas belum berhasil diunggah. Coba lagi.", 503);

  const saved = old
    ? await supabase.from("mission_submissions")
        .update({ ...fields, dokumen_path: path, status_review: "PENDING" })
        .eq("mission_submission_id", submissionId).eq("submitted_by", userId)
        .eq("status_review", "REJECTED")
        .select("mission_submission_id").maybeSingle()
    : await supabase.from("mission_submissions")
        .insert({ ...fields, dokumen_path: path,
          mission_submission_id: submissionId, submitted_by: userId })
        .select("mission_submission_id").maybeSingle();
  if (saved.error || !saved.data) {
    await storage.remove([path]);
    return fail(saved.error?.code === "23505"
      ? "Pengajuan dengan nama, penyelenggara, dan tahun yang sama sudah ada."
      : "Pengajuan belum tersimpan. Muat ulang lalu coba lagi.", 409);
  }

  if (old?.dokumen_path?.startsWith(`${userId}/${submissionId}/`)) {
    await storage.remove([old.dokumen_path]);
  }
  revalidatePath("/missions/submissions");
  revalidatePath("/admin/missions");
  return Response.json({ success: true, submissionId });
}
