type RankRule = {
  rank_name: string;
  min_xp: number;
  max_xp: number | null;
};

export default function RankCard({
  label, xp, rules,
}: {
  label: string;
  xp: number;
  rules: RankRule[];
}) {
  const current = [...rules].reverse().find((rule) =>
    xp >= rule.min_xp && (rule.max_xp === null || xp <= rule.max_xp));
  const next = rules.find((rule) => rule.min_xp > xp);
  const progress = current && next
    ? Math.round(100 * (xp - current.min_xp) / (next.min_xp - current.min_xp))
    : 100;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-600">{label}</h2>
      <p className="mt-2 text-3xl font-bold text-indigo-700">
        {new Intl.NumberFormat("id-ID").format(xp)} <span className="text-base">XP</span>
      </p>
      <p className="mt-2 text-sm font-semibold text-slate-900">
        Rank: {current?.rank_name ?? "Belum tersedia"}
      </p>
      {current && (
        <>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"
            role="progressbar" aria-label={`Progres ${label}`}
            aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-indigo-600" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-xs text-slate-600">
            {next
              ? `${new Intl.NumberFormat("id-ID").format(next.min_xp - xp)} XP lagi menuju ${next.rank_name}`
              : "Rank tertinggi tercapai"}
          </p>
        </>
      )}
    </section>
  );
}
