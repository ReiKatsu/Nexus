"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";

import { ENDORSEMENT_FIELDS, type EndorsementField, type EndorsementScores,
  type SharedSquad } from "@/lib/endorsements";
import { submitEndorsement } from "./actions";

export default function EndorsementForm({ targetUserId, squads }: {
  targetUserId: string;
  squads: SharedSquad[];
}) {
  const available = squads.filter((squad) => !squad.alreadyRated && squad.windowOpen);
  const closed = squads.filter((squad) => !squad.alreadyRated && !squad.windowOpen);
  const [squadId, setSquadId] = useState(available.length === 1 ? available[0].squadId : "");
  const selectedSquad = available.find((squad) => squad.squadId === squadId);
  const [values, setValues] = useState<Record<EndorsementField, string>>({
    communication: "", contribution: "", teamwork: "", responsibility: "",
  });
  const [pending, setPending] = useState(false);
  const [submittedSquadId, setSubmittedSquadId] = useState("");
  const [message, setMessage] = useState("");
  const submitting = useRef(false);
  const router = useRouter();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || !selectedSquad || squadId === submittedSquadId) return;
    submitting.current = true;
    setPending(true);
    setMessage("");
    try {
      const scores = Object.fromEntries(ENDORSEMENT_FIELDS.map(([field]) => [
        field, Number(values[field]),
      ])) as EndorsementScores;
      const result = await submitEndorsement(targetUserId, squadId, scores);
      if (!result.success) {
        setMessage(result.message);
        if (result.windowClosed) router.refresh();
        return;
      }
      setSubmittedSquadId(squadId);
      setMessage("Penilaian berhasil dikirim.");
      router.refresh();
    } catch {
      setMessage("Penilaian belum tersimpan. Coba lagi.");
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-bold">Nilai rekan Squad</h2>
      <p className="mt-1 text-sm text-slate-600">
        Penilaian tersedia selama 14 hari sejak hasil Mission disetujui admin.
      </p>
      {squads.some((squad) => squad.alreadyRated) && (
        <p className="mt-2 text-sm text-slate-600">
          Sudah dinilai: {squads.filter((squad) => squad.alreadyRated)
            .map((squad) => squad.name).join(", ")}.
        </p>
      )}
      {closed.length > 0 && (
        <p className="mt-2 text-sm text-slate-600">
          Penilaian ditutup: {closed.map((squad) => squad.name).join(", ")}.
        </p>
      )}
      {available.length > 0 && (
        <form onSubmit={submit} className="mt-4 space-y-4" aria-busy={pending}>
          <label className="block text-sm font-semibold">Squad yang dinilai
            <select required value={squadId} disabled={pending}
              onChange={(event) => setSquadId(event.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 p-2">
              <option value="">Pilih Squad</option>
              {available.map((squad) => <option key={squad.squadId} value={squad.squadId}>
                {squad.name}</option>)}
            </select>
          </label>
          {selectedSquad?.closesAt && (
            <p className="text-sm text-slate-600">
              Batas penilaian: {new Intl.DateTimeFormat("id-ID", {
                dateStyle: "long", timeStyle: "short", timeZone: "Asia/Jakarta",
              }).format(new Date(selectedSquad.closesAt))} WIB.
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {ENDORSEMENT_FIELDS.map(([field, label]) => (
              <label key={field} className="block text-sm font-semibold">{label}
                <select required value={values[field]} disabled={pending}
                  onChange={(event) => setValues((current) => ({
                    ...current, [field]: event.target.value,
                  }))}
                  className="mt-1 block w-full rounded-lg border border-slate-300 p-2">
                  <option value="">Pilih nilai</option>
                  {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>
                    {value}</option>)}
                </select>
              </label>
            ))}
          </div>
          <button type="submit" disabled={pending || !selectedSquad || squadId === submittedSquadId}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {pending ? "Mengirim…" : "Kirim penilaian"}
          </button>
        </form>
      )}
      {message && <p role="status" className="mt-3 text-sm text-slate-700">{message}</p>}
    </section>
  );
}
