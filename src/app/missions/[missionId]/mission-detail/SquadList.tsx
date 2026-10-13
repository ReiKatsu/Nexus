import JoinSquadButton from "../JoinSquadButton";
import SquadApplicationDecisionList from "../SquadApplicationDecisionList";
import type {
  LeaderApplicationsBySquad,
  MissionSquad,
} from "./types";

type SquadListProps = {
  squads: MissionSquad[] | null;
  squadsLoadFailed: boolean;
  squadLeadersLoadFailed: boolean;
  leaderApplicationsLoadFailed: boolean;
  squadLeaderNames: Map<string, string | null>;
  leaderApplicationsBySquad: LeaderApplicationsBySquad;
  pendingApplicationIdsBySquad: Map<string, string>;
  pendingApplicationCount: number;
  applicationStatusLoadFailed: boolean;
  hasActiveMembership: boolean;
  currentUserId: string;
  accountStatus: string | null;
  registrationOpen: boolean;
};

function getSquadStatusLabel(status: string | null): "Open" | "Locked" | null {
  if (status === "OPEN_RECRUITMENT") return "Open";
  if (status === "FULL" || status === "FINALIZED") return "Locked";
  return null;
}

export default function SquadList({
  squads,
  squadsLoadFailed,
  squadLeadersLoadFailed,
  leaderApplicationsLoadFailed,
  squadLeaderNames,
  leaderApplicationsBySquad,
  pendingApplicationIdsBySquad,
  pendingApplicationCount,
  applicationStatusLoadFailed,
  hasActiveMembership,
  currentUserId,
  accountStatus,
  registrationOpen,
}: SquadListProps) {
  return (
    <section className="mt-7 sm:mt-8">
      <h2 className="sr-only">Daftar squad sesuai filter</h2>

      {squadLeadersLoadFailed && !squadsLoadFailed && (squads ?? []).length > 0 && (
        <div
          role="alert"
          className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800"
        >
          Nama Ketua belum dapat dimuat. Data Squad lainnya tetap ditampilkan.
        </div>
      )}

      {squadsLoadFailed ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm sm:p-8">
          <p className="font-bold text-slate-950">Squad belum dapat dimuat</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Data Squad sedang tidak tersedia.
          </p>
        </div>
      ) : (squads ?? []).length === 0 ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm sm:p-8">
          <p className="font-bold text-slate-950">Belum ada Squad tersedia</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Belum ada Squad yang sesuai dengan filter ini.
          </p>
        </div>
      ) : (
        <div className="mission-grid mt-4 grid gap-5">
          {(squads ?? []).map((squad) => {
            const leaderName = squadLeaderNames.get(squad.squad_id);
            const statusLabel = getSquadStatusLabel(squad.status_squad);
            const isOwnSquad = squad.ketua_id === currentUserId;
            const pendingApplicationId = pendingApplicationIdsBySquad.get(
              squad.squad_id,
            );
            const hasPendingApplication = Boolean(pendingApplicationId);
            const leaderApplications =
              leaderApplicationsBySquad.get(squad.squad_id) ?? [];
            const acceptDisabledReason =
              squad.status_squad !== "OPEN_RECRUITMENT"
                ? "Squad Locked tidak dapat menerima pelamar baru."
                : !registrationOpen
                  ? "Pendaftaran Mission sudah ditutup."
                  : undefined;
            let joinState:
              | "eligible"
              | "pending"
              | "member"
              | "disabled" = "eligible";
            let disabledReason: string | undefined;

            if (hasActiveMembership || isOwnSquad) {
              joinState = "member";
            } else if (hasPendingApplication) {
              joinState = "pending";
            } else if (applicationStatusLoadFailed) {
              joinState = "disabled";
              disabledReason =
                "Status Join belum dapat dimuat. Muat ulang halaman untuk mencoba lagi.";
            } else if (accountStatus !== "ACTIVE") {
              joinState = "disabled";
              disabledReason =
                "Akun ACTIVE diperlukan untuk mengajukan Join Squad.";
            } else if (!registrationOpen) {
              joinState = "disabled";
              disabledReason = "Pendaftaran Mission sudah ditutup.";
            } else if (pendingApplicationCount >= 3) {
              joinState = "disabled";
              disabledReason =
                "Batas 3 aplikasi Pending pada Mission ini sudah tercapai.";
            }

            return (
              <article
                key={squad.squad_id}
                className="glass-card min-w-0 p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h3 className="break-words text-lg font-bold text-slate-950 [overflow-wrap:anywhere]">
                    {squad.nama_squad}
                  </h3>
                  {statusLabel && (
                    <span
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${statusLabel === "Open" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}
                    >
                      {statusLabel}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm font-semibold text-slate-600">
                  Ketua:{" "}
                  {squadLeadersLoadFailed
                    ? "Nama gagal dimuat"
                    : leaderName ?? "Belum tersedia"}
                </p>
                <p className="mt-3 break-words text-sm leading-6 text-slate-500 [overflow-wrap:anywhere]">
                  {squad.deskripsi_squad || "Deskripsi Squad belum tersedia."}
                </p>
                <p className="mt-4 border-t border-slate-100 pt-4 text-sm font-bold text-slate-700">
                  {squad.active_members?.[0]?.count === undefined ? "Jumlah anggota belum tersedia"
                    : `${squad.active_members[0].count}/${squad.kapasitas_anggota} anggota`}
                </p>
                {squad.status_squad === "OPEN_RECRUITMENT" ||
                hasPendingApplication ? (
                  <JoinSquadButton
                    key={`${squad.squad_id}:${joinState}:${pendingApplicationId ?? "none"}`}
                    squadId={squad.squad_id}
                    initialState={joinState}
                    pendingApplicationId={pendingApplicationId}
                    disabledReason={disabledReason}
                  />
                ) : (
                  <p className="mt-4 border-t border-slate-100 pt-4 text-sm font-semibold text-slate-500">
                    Squad terkunci dan tidak menerima aplikasi.
                  </p>
                )}
                {isOwnSquad &&
                  (leaderApplicationsLoadFailed ? (
                    <div
                      role="alert"
                      className="mt-5 border-t border-slate-100 pt-4 text-xs leading-5 text-amber-700"
                    >
                      Daftar pelamar belum dapat dimuat. Muat ulang halaman
                      untuk mencoba lagi.
                    </div>
                  ) : (
                    <SquadApplicationDecisionList
                      key={`${squad.squad_id}:${leaderApplications.map((application) => application.applicationId).join(",")}:${acceptDisabledReason ?? "open"}`}
                      applications={leaderApplications}
                      acceptDisabledReason={acceptDisabledReason}
                    />
                  ))}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
