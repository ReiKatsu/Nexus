

Backlink · TSX
import Link from "next/link";
import type { ReactNode } from "react";
 
type BackLinkProps = {
  href: string;
  children: ReactNode;
  prefetch?: boolean;
  className?: string;
};
 
export default function BackLink({ href, children, prefetch, className = "" }: BackLinkProps) {
  return (
    <Link href={href} prefetch={prefetch} className={`nexus-back ${className}`.trim()}>
      <span className="nexus-back-icon" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M11 5l-7 7 7 7" />
        </svg>
      </span>
      <span className="nexus-back-label">{children}</span>
    </Link>
  );
}
 
