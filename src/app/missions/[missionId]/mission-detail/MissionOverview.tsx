import { formatDate, formatEnumLabel } from "./formatters";
import type { MissionDetail, MissionTier } from "./types";

export default function MissionOverview({ mission, relatedTier, tierLabel }: {
  mission: MissionDetail; relatedTier: MissionTier | null; tierLabel: string;
}) {
  const teamSize = mission.min_anggota_tim === null || mission.max_anggota_tim === null ? "Belum tersedia"
    : mission.min_anggota_tim === mission.max_anggota_tim ? `${mission.min_anggota_tim} anggota`
    : `${mission.min_anggota_tim}–${mission.max_anggota_tim} anggota`;
  return (
    <section className="glass-card mission-hero">
      <span className="nexus-pill">{formatEnumLabel(mission.kategori_lomba)}</span>
      <h1 className="mt-4">{mission.nama_lomba}</h1>
      <p className="mt-2 font-medium">{mission.penyelenggara} · {formatEnumLabel(mission.cakupan_peserta)}</p>
      <dl className="mission-facts">
        <div><dt>Deadline Pendaftaran</dt><dd className="mission-deadline"><time dateTime={mission.deadline_pendaftaran}>{formatDate(mission.deadline_pendaftaran)}</time></dd></div>
        <div><dt>Ukuran Squad</dt><dd>{teamSize}</dd></div>
        <div><dt>Tier Mission</dt><dd>{tierLabel}{relatedTier?.nama_tier ? ` · ${relatedTier.nama_tier}` : ""}</dd></div>
        <div><dt>Mode & Biaya</dt><dd>{formatEnumLabel(mission.mode_lomba)} · {formatEnumLabel(mission.biaya_pendaftaran)}</dd></div>
        <div><dt>Deadline Lomba</dt><dd><time dateTime={mission.deadline_lomba ?? undefined}>{formatDate(mission.deadline_lomba)}</time></dd></div>
        <div><dt>Tahun Lomba</dt><dd>{mission.tahun_lomba}</dd></div>
      </dl>
      <details className="mt-7 border-t border-white/20 pt-5">
        <summary className="text-sm font-medium">Tentang Mission</summary>
        <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-600">{mission.deskripsi_singkat || "Deskripsi Mission belum tersedia."}</p>
      </details>
      {mission.link_resmi && <a href={mission.link_resmi} target="_blank" rel="noopener noreferrer"
        className="mt-6 inline-flex rounded-full border border-white/40 px-5 py-2 text-sm font-medium hover:bg-white/10">Lihat Halaman Resmi ↗</a>}
    </section>
  );
}
