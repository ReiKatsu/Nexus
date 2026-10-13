import Image from "next/image";
import Link from "next/link";

type NavbarProps = {
  displayName: string;
  activeItem: "home" | "missions" | "leaderboard" | "my-squad" | "admin" | "notifications" | "profile";
  isAdmin?: boolean;
};

export default function Navbar({ displayName, activeItem, isAdmin = false }: NavbarProps) {
  const initials = displayName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "N";
  const items = [
    { href: "/", key: "home", label: "Home" },
    { href: "/missions", key: "missions", label: "Missions" },
    { href: "/leaderboard", key: "leaderboard", label: "Leaderboard" },
    { href: "/my-squad", key: "my-squad", label: "My Squad" },
    ...(isAdmin ? [{ href: "/admin/results", key: "admin", label: "Review" }] : []),
  ];
  return (
    <header className="nexus-navbar">
      <div className="nexus-nav-inner">
        <Link href="/" className="nexus-brand" aria-label="NEXUS Home">
          <Image src="/nexus-logo.svg" alt="" width={28} height={28} />
        </Link>
        <nav className="nexus-nav-links" aria-label="Navigasi utama">
          {items.map((item) => <Link key={item.key} href={item.href} className="nexus-nav-link"
            aria-current={activeItem === item.key ? "page" : undefined}>{item.label}</Link>)}
        </nav>
        <div className="nexus-nav-actions">
          <Link href="/notifications" aria-label="Notifikasi" title="Notifikasi"
            aria-current={activeItem === "notifications" ? "page" : undefined} className="rounded-full p-2">
            <svg width="23" height="23" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 3a1 1 0 0 1 1 1v.1a6 6 0 0 1 5 5.9v4l2 3H4l2-3v-4a6 6 0 0 1 5-5.9V4a1 1 0 0 1 1-1Zm-2 16h4a2 2 0 0 1-4 0Z" />
            </svg>
          </Link>
          <Link href="/profile" className="nexus-avatar" title={displayName}
            aria-label={`Buka profil ${displayName || "saya"}`}
            aria-current={activeItem === "profile" ? "page" : undefined}>{initials}</Link>
          {isAdmin && <Link href="/admin/missions" className="nexus-admin-shortcut"
            title="Review pengajuan Mission">Mission Review</Link>}
        </div>
      </div>
    </header>
  );
}
