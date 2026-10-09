"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { CATEGORIES, COSTS, MODES, ORGANIZERS, SCOPES,
  type MissionSubmission } from "./options";
import { MAX_DOCUMENT_BYTES } from "./validation";

function localDate(iso: string | undefined) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(new Date(iso)).replace(" ", "T");
}

function Choice({ name, label, options, initial }: {
  name: string; label: string; options: readonly (readonly [string, string])[];
  initial?: string;
}) {
  return <label className="block text-sm font-semibold">{label}
    <select name={name} required defaultValue={initial ?? ""}
      className="mt-1 block w-full rounded-lg border border-slate-300 p-2">
      <option value="" disabled>Pilih {label.toLowerCase()}</option>
      {options.map(([value, display]) => <option key={value} value={value}>{display}</option>)}
    </select>
  </label>;
}

export default function MissionForm({ initial }: { initial: MissionSubmission | null }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState<{
    nama_lomba: string; penyelenggara: string; tahun_lomba: number;
  }[]>([]);

  async function checkSimilar(name: string) {
    if (name.trim().length < 3) { setSuggestions([]); return; }
    try {
      const response = await fetch(`/api/missions/suggestions?name=${encodeURIComponent(name.trim())}`);
      if (!response.ok) return;
      const result: { matches: typeof suggestions } = await response.json();
      setSuggestions(result.matches);
    } catch { /* The database still rejects exact duplicates on submit. */ }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    const registration = String(form.get("deadline_pendaftaran") ?? "");
    const competition = String(form.get("deadline_lomba") ?? "");
    const file = form.get("dokumen");
    const min = Number(form.get("min_anggota_tim"));
    const max = Number(form.get("max_anggota_tim"));
    if (!registration || !competition || !Number.isInteger(min) || min < 2 ||
        !Number.isInteger(max) || max < min || !(file instanceof File) ||
        !file.size || file.size > MAX_DOCUMENT_BYTES) {
      setError("Periksa deadline, peserta tim (minimal 2), dan berkas maksimal 10 MiB.");
      return;
    }
    const registrationDate = new Date(`${registration}:00+07:00`);
    const competitionDate = new Date(`${competition}:00+07:00`);
    if (!Number.isFinite(registrationDate.getTime()) ||
        !Number.isFinite(competitionDate.getTime())) {
      setError("Format deadline tidak valid.");
      return;
    }
    const registrationIso = registrationDate.toISOString();
    const competitionIso = competitionDate.toISOString();
    if (registrationIso <= new Date().toISOString() || competitionIso < registrationIso) {
      setError("Deadline pendaftaran harus mendatang dan deadline lomba tidak boleh lebih awal.");
      return;
    }
    if (!window.confirm("Kirim pengajuan Mission ini untuk diperiksa admin?")) return;
    form.set("deadline_pendaftaran", registrationIso);
    form.set("deadline_lomba", competitionIso);
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/missions/submissions", { method: "POST", body: form });
      const result: { success?: boolean; message?: string } = await response.json();
      if (!response.ok || !result.success) {
        setError(result.message ?? "Pengajuan belum terkirim. Coba lagi.");
        return;
      }
      router.replace("/missions/submissions");
      router.refresh();
    } catch {
      setError("Koneksi bermasalah. Coba lagi setelah memeriksa jaringan.");
    } finally { setPending(false); }
  }

  return <form onSubmit={submit} aria-busy={pending}
    className="mt-6 space-y-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
    {initial && <input type="hidden" name="submission_id"
      value={initial.mission_submission_id} />}
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block text-sm font-semibold">Nama lomba
        <input name="nama_lomba" required maxLength={200} defaultValue={initial?.nama_lomba}
          onBlur={(event) => checkSimilar(event.currentTarget.value)}
          className="mt-1 block w-full rounded-lg border border-slate-300 p-2" />
      </label>
      <label className="block text-sm font-semibold">Penyelenggara
        <input name="penyelenggara" required maxLength={200} defaultValue={initial?.penyelenggara}
          className="mt-1 block w-full rounded-lg border border-slate-300 p-2" />
      </label>
      <Choice name="kategori_penyelenggara" label="Kategori penyelenggara"
        options={ORGANIZERS} initial={initial?.kategori_penyelenggara} />
      <Choice name="kategori_lomba" label="Kategori lomba"
        options={CATEGORIES} initial={initial?.kategori_lomba} />
      <Choice name="cakupan_peserta" label="Cakupan peserta"
        options={SCOPES} initial={initial?.cakupan_peserta} />
      <Choice name="mode_lomba" label="Mode lomba"
        options={MODES} initial={initial?.mode_lomba} />
      <Choice name="biaya_pendaftaran" label="Biaya pendaftaran"
        options={COSTS} initial={initial?.biaya_pendaftaran} />
      <label className="block text-sm font-semibold">Tahun lomba
        <input name="tahun_lomba" type="number" min={1} max={32767} required
          defaultValue={initial?.tahun_lomba}
          className="mt-1 block w-full rounded-lg border border-slate-300 p-2" />
      </label>
      <label className="block text-sm font-semibold">Deadline pendaftaran (WIB)
        <input name="deadline_pendaftaran" type="datetime-local" required
          defaultValue={localDate(initial?.deadline_pendaftaran)}
          className="mt-1 block w-full rounded-lg border border-slate-300 p-2" />
      </label>
      <label className="block text-sm font-semibold">Deadline lomba (WIB)
        <input name="deadline_lomba" type="datetime-local" required
          defaultValue={localDate(initial?.deadline_lomba)}
          className="mt-1 block w-full rounded-lg border border-slate-300 p-2" />
      </label>
      <label className="block text-sm font-semibold">Minimum peserta tim (termasuk Ketua)
        <input name="min_anggota_tim" type="number" min={2} max={32767} required
          defaultValue={initial?.min_anggota_tim}
          className="mt-1 block w-full rounded-lg border border-slate-300 p-2" />
      </label>
      <label className="block text-sm font-semibold">Maksimum peserta tim (termasuk Ketua)
        <input name="max_anggota_tim" type="number" min={2} max={32767} required
          defaultValue={initial?.max_anggota_tim}
          className="mt-1 block w-full rounded-lg border border-slate-300 p-2" />
      </label>
    </div>
    {suggestions.length > 0 && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
      <p className="font-semibold">Periksa kemungkinan pengajuan serupa:</p>
      <ul className="mt-2 list-inside list-disc">
        {suggestions.map((item, index) => <li key={`${item.nama_lomba}:${item.tahun_lomba}:${index}`}>
          {item.nama_lomba} · {item.penyelenggara} ({item.tahun_lomba})
        </li>)}
      </ul>
    </div>}
    <label className="block text-sm font-semibold">Link resmi
      <input name="link_resmi" type="url" required maxLength={2048}
        defaultValue={initial?.link_resmi} placeholder="https://..."
        className="mt-1 block w-full rounded-lg border border-slate-300 p-2" />
    </label>
    <label className="block text-sm font-semibold">Deskripsi singkat
      <textarea name="deskripsi_singkat" required maxLength={3000} rows={4}
        defaultValue={initial?.deskripsi_singkat}
        className="mt-1 block w-full rounded-lg border border-slate-300 p-2" />
    </label>
    <label className="block text-sm font-semibold">Poster atau dokumen lomba baru
      <input name="dokumen" type="file" required
        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
        className="mt-1 block w-full text-sm" />
    </label>
    <p className="text-sm text-slate-600">PDF, JPG, atau PNG maksimal 10 MiB.
      Pengajuan yang menunggu review belum muncul di Discovery. Tier akhir ditetapkan admin.
      Periksa Mission yang sudah tersedia agar tidak mengajukan duplikat.</p>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <div className="flex flex-wrap items-center gap-4">
      <button type="submit" disabled={pending}
        className="rounded-lg bg-indigo-600 px-5 py-2 font-semibold text-white disabled:opacity-50">
        {pending ? "Mengirim..." : initial ? "Kirim ulang" : "Ajukan Mission"}
      </button>
      <Link href="/missions/submissions" className="text-sm font-semibold text-slate-600">Batal</Link>
    </div>
  </form>;
}
