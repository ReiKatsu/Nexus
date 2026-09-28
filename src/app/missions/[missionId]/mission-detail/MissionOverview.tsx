import { formatDate, formatEnumLabel } from "./formatters";
import type { MissionDetail, MissionTier } from "./types";

type MissionOverviewProps = {
  mission: MissionDetail;
  relatedTier: MissionTier | null;
  tierLabel: string;
};

export default function MissionOverview({
  mission,
  relatedTier,
  tierLabel,
}: MissionOverviewProps) {
  const detailItems = [
    ["Kategori", formatEnumLabel(mission.kategori_lomba)],
    ["Mode", formatEnumLabel(mission.mode_lomba)],
    ["Biaya", formatEnumLabel(mission.biaya_pendaftaran)],
    ["Cakupan peserta", formatEnumLabel(mission.cakupan_peserta)],
    ["Tahun lomba", String(mission.tahun_lomba)],
    [
      "Jumlah anggota tim",
      mission.min_anggota_tim === null || mission.max_anggota_tim === null
        ? "Belum tersedia"
        : mission.min_anggota_tim === mission.max_anggota_tim
          ? `${mission.min_anggota_tim} orang`
          : `${mission.min_anggota_tim}–${mission.max_anggota_tim} orang`,
    ],
  ];

  return (
    <section className="mt-5 rounded-2xl border border-white/80 bg-white/90 p-5 shadow-xl shadow-slate-200/60 backdrop-blur sm:rounded-3xl sm:p-8 lg:p-10">
      <div className="border-b border-slate-100 pb-6">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700">
            {tierLabel}
          </span>
          {relatedTier?.nama_tier && (
            <span className="rounded-full border border-violet-100 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700">
              {relatedTier.nama_tier}
            </span>
          )}
        </div>
        <h1 className="mt-4 break-words text-2xl font-bold tracking-tight text-slate-950 [overflow-wrap:anywhere] sm:text-3xl lg:text-4xl">
          {mission.nama_lomba}
        </h1>
        <p className="mt-2 break-words text-sm text-slate-500 [overflow-wrap:anywhere] sm:text-base">
          Diselenggarakan oleh {mission.penyelenggara}
        </p>
      </div>

      <dl className="mt-6 grid gap-4 sm:grid-cols-2">
        {detailItems.map(([label, value]) => (
          <div key={label} className="min-w-0 rounded-2xl bg-slate-50 p-4">
            <dt className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
              {label}
            </dt>
            <dd className="mt-2 break-words text-sm font-bold text-slate-800 [overflow-wrap:anywhere]">
              {value}
            </dd>
          </div>
        ))}
        <div className="min-w-0 rounded-2xl bg-slate-50 p-4">
          <dt className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
            Deadline pendaftaran
          </dt>
          <dd className="mt-2 text-sm font-bold text-slate-800">
            <time dateTime={mission.deadline_pendaftaran}>
              {formatDate(mission.deadline_pendaftaran)}
            </time>
          </dd>
        </div>
        <div className="min-w-0 rounded-2xl bg-slate-50 p-4">
          <dt className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
            Deadline lomba
          </dt>
          <dd className="mt-2 text-sm font-bold text-slate-800">
            <time dateTime={mission.deadline_lomba ?? undefined}>
              {formatDate(mission.deadline_lomba)}
            </time>
          </dd>
        </div>
      </dl>

      <div className="mt-6 border-t border-slate-100 pt-6">
        <h2 className="text-lg font-bold text-slate-950">Tentang Mission</h2>
        <p className="mt-3 whitespace-pre-line break-words text-sm leading-7 text-slate-600 [overflow-wrap:anywhere] sm:text-base">
          {mission.deskripsi_singkat || "Deskripsi Mission belum tersedia."}
        </p>
      </div>

      {mission.link_resmi && (
        <div className="mt-7">
          <a
            href={mission.link_resmi}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-700 sm:w-auto"
          >
            Lihat Halaman Resmi
          </a>
        </div>
      )}
    </section>
  );
}
