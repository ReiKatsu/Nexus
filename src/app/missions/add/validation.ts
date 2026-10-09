import { CATEGORIES, COSTS, MODES, ORGANIZERS, SCOPES } from "./options";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAX_DOCUMENT_BYTES = 10_485_760;

export function validSubmissionId(value: string): boolean { return UUID.test(value); }

export async function validateDocument(file: File) {
  if (!file.size || file.size > MAX_DOCUMENT_BYTES) return null;
  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  if (file.type === "application/pdf" && bytes[0] === 0x25 && bytes[1] === 0x50 &&
      bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d) {
    return { extension: "pdf", contentType: file.type };
  }
  if (file.type === "image/png" &&
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
        .every((byte, index) => bytes[index] === byte)) {
    return { extension: "png", contentType: file.type };
  }
  if (file.type === "image/jpeg" && bytes[0] === 0xff &&
      bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { extension: "jpg", contentType: file.type };
  }
  return null;
}

function choice(value: FormDataEntryValue | null, options: readonly (readonly [string, string])[]) {
  return typeof value === "string" && options.some(([key]) => key === value)
    ? value : null;
}

function text(value: FormDataEntryValue | null, max: number) {
  return typeof value === "string" && value.trim() && value.trim().length <= max
    ? value.trim() : null;
}

function deadline(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value ? value : null;
}

export function validateFields(form: FormData) {
  const names = ["submission_id", "nama_lomba", "penyelenggara", "kategori_penyelenggara",
    "link_resmi", "deadline_pendaftaran", "deadline_lomba", "tahun_lomba",
    "kategori_lomba", "cakupan_peserta", "mode_lomba", "biaya_pendaftaran",
    "min_anggota_tim", "max_anggota_tim", "deskripsi_singkat", "dokumen"];
  if (names.some((name) => form.getAll(name).length > 1)) return null;
  const name = text(form.get("nama_lomba"), 200);
  const organizer = text(form.get("penyelenggara"), 200);
  const link = text(form.get("link_resmi"), 2048);
  const description = text(form.get("deskripsi_singkat"), 3000);
  const registration = deadline(form.get("deadline_pendaftaran"));
  const competition = deadline(form.get("deadline_lomba"));
  const year = Number(form.get("tahun_lomba"));
  const min = Number(form.get("min_anggota_tim"));
  const max = Number(form.get("max_anggota_tim"));
  let url: URL;
  try { url = new URL(link ?? ""); } catch { return null; }
  if (!name || !organizer || !description || !link ||
      !["https:", "http:"].includes(url.protocol) ||
      !registration || !competition || registration <= new Date().toISOString() ||
      competition < registration || !Number.isSafeInteger(year) ||
      year < 1 || year > 32767 ||
      !Number.isInteger(min) || !Number.isInteger(max) || min < 2 ||
      max < min || max > 32767) return null;

  const kategori_penyelenggara = choice(form.get("kategori_penyelenggara"), ORGANIZERS);
  const kategori_lomba = choice(form.get("kategori_lomba"), CATEGORIES);
  const cakupan_peserta = choice(form.get("cakupan_peserta"), SCOPES);
  const mode_lomba = choice(form.get("mode_lomba"), MODES);
  const biaya_pendaftaran = choice(form.get("biaya_pendaftaran"), COSTS);
  if (!kategori_penyelenggara || !kategori_lomba || !cakupan_peserta ||
      !mode_lomba || !biaya_pendaftaran) return null;
  return { nama_lomba: name, penyelenggara: organizer,
    kategori_penyelenggara, link_resmi: link,
    deadline_pendaftaran: registration, deadline_lomba: competition,
    tahun_lomba: year, kategori_lomba, cakupan_peserta, mode_lomba,
    biaya_pendaftaran, min_anggota_tim: min, max_anggota_tim: max,
    deskripsi_singkat: description };
}
