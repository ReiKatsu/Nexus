import Link from "next/link";

type NavbarProps = {
  displayName: string;
  activeItem: "home" | "missions";
};

const futureNavigationItems = ["Leaderboard", "My Squad"];

export default function Navbar({ displayName, activeItem }: NavbarProps) {
  const initial = displayName.trim().charAt(0).toUpperCase() || "N";
  const navigationClassName =
    "whitespace-nowrap rounded-lg px-2 py-2 transition-colors sm:px-2.5 md:px-3";
  const activeClassName = "bg-indigo-50 text-indigo-600";
  const inactiveClassName = "text-slate-600 hover:bg-slate-50 hover:text-slate-900";

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-3 gap-y-2.5 px-4 py-3 sm:flex-nowrap sm:gap-6 sm:px-6">
        <div className="flex shrink-0 items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-sm font-bold text-white shadow-sm shadow-indigo-200">
            N
          </span>
          <span className="text-base font-bold tracking-[0.2em] text-slate-900">
            NEXUS
          </span>
        </div>

        <nav
          aria-label="Navigasi utama"
          className="order-3 flex min-w-0 w-full items-center justify-between gap-0 text-[11px] font-semibold min-[400px]:justify-center min-[400px]:gap-1 min-[400px]:text-xs sm:order-none sm:w-auto sm:gap-1 md:gap-2 md:text-sm"
        >
          <Link
            href="/"
            aria-current={activeItem === "home" ? "page" : undefined}
            className={`${navigationClassName} ${activeItem === "home" ? activeClassName : inactiveClassName}`}
          >
            Home
          </Link>
          <Link
            href="/missions"
            aria-current={activeItem === "missions" ? "page" : undefined}
            className={`${navigationClassName} ${activeItem === "missions" ? activeClassName : inactiveClassName}`}
          >
            Missions
          </Link>
          {futureNavigationItems.map((item) => (
            <span
              key={item}
              aria-disabled="true"
              className="cursor-default whitespace-nowrap rounded-lg px-2 py-2 text-slate-400 sm:px-2.5 md:px-3"
            >
              {item}
            </span>
          ))}
        </nav>

        <div
          aria-label="Profile"
          title={displayName || "Profile"}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700 ring-1 ring-inset ring-indigo-200"
        >
          {initial}
        </div>
      </div>
    </header>
  );
}
