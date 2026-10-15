import Image from "next/image";
import Link from "next/link";
import LogoutButton from "./LogoutButton";

type NavbarProps = {
  displayName: string;
  avatarPath?: string | null;
  activeItem: "home" | "missions" | "leaderboard" | "my-squad" | "admin" | "notifications" | "profile";
  isAdmin?: boolean;
};

export default function Navbar({ displayName, avatarPath, activeItem, isAdmin = false }: NavbarProps) {
  const avatarUrl = avatarPath
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${avatarPath.split("/").map(encodeURIComponent).join("/")}`
    : null;
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
            aria-current={activeItem === "profile" ? "page" : undefined}>
            {avatarUrl ? <Image src={avatarUrl} alt="" width={44} height={44} unoptimized
              className="h-full w-full rounded-full object-cover" /> : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
              </svg>
            )}
          </Link>
          {isAdmin && <Link href="/admin/missions" className="nexus-admin-shortcut"
            title="Review pengajuan Mission">Mission Review</Link>}
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
