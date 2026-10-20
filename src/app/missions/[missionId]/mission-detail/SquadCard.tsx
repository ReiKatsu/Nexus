"use client";

import { useRef, type ReactNode } from "react";
import type { SquadRequirement } from "./types";

type SquadCardProps = {
  name: string;
  description: string;
  statusLabel: "Open" | "Locked" | null;
  countLabel: string;
  avatars: Array<string | null>;
  badge?: string;
  subtitle: string;
  people: Array<{ name: string; role: string }>;
  otherMembers: number;
  requirements: SquadRequirement[];
  footerNote?: string;
  action?: ReactNode;
  extra?: ReactNode;
};

export default function SquadCard({
  name, description, statusLabel, countLabel, avatars, badge, subtitle,
  people, otherMembers, requirements, footerNote, action, extra,
}: SquadCardProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button type="button" className="squad-card" onClick={() => dialogRef.current?.showModal()}
        aria-haspopup="dialog">
        {badge && <span className="squad-card-badge">{badge}</span>}
        <span className="squad-card-head">
          <span className="squad-card-name">{name}</span>
          {statusLabel && (
            <span className={`squad-card-status ${statusLabel === "Open" ? "is-open" : "is-locked"}`}>
              {statusLabel}
            </span>
          )}
        </span>
        <span className="squad-card-desc">{description}</span>
        <span className="squad-card-foot">
          <span className="squad-card-avatars" aria-hidden="true">
            {avatars.slice(0, 4).map((initial, index) => <i key={index}>{initial ?? ""}</i>)}
          </span>
          <span className="squad-card-count">{countLabel}</span>
        </span>
      </button>

      <dialog ref={dialogRef} className="squad-dialog" aria-label={`Detail Squad ${name}`}
        onClick={(event) => { if (event.target === dialogRef.current) dialogRef.current?.close(); }}>
        <div className="squad-dialog-cover" aria-hidden="true" />
        <div className="squad-dialog-body">
          <h3>{name}</h3>
          <p className="squad-dialog-sub">{subtitle}</p>
          <p className="squad-dialog-desc">{description}</p>

          {(people.length > 0 || otherMembers > 0) && (
            <ul className="squad-dialog-people">
              {people.map((person) => (
                <li key={`${person.role}:${person.name}`}>
                  <span className={`squad-dialog-avatar${person.role === "Ketua" ? " is-leader" : ""}`} aria-hidden="true">
                    {person.name.trim().charAt(0).toLocaleUpperCase("id-ID")}
                  </span>
                  <span><strong>{person.name}</strong><small>{person.role}</small></span>
                </li>
              ))}
              {otherMembers > 0 && (
                <li>
                  <span className="squad-dialog-avatar" aria-hidden="true">+{otherMembers}</span>
                  <span><strong>{otherMembers} anggota lain</strong><small>Anggota</small></span>
                </li>
              )}
            </ul>
          )}

          {requirements.length > 0 && (
            <div className="squad-dialog-needs">
              <p>Kemampuan yang dicari</p>
              <ul>
                {requirements.map((item) => <li key={item.className}>{item.className} · {item.slots} slot</li>)}
              </ul>
            </div>
          )}

          {extra}

          <div className="squad-dialog-actions">
            <button type="button" className="squad-dialog-close" onClick={() => dialogRef.current?.close()}>
              Tutup
            </button>
            {action ?? (footerNote ? <p className="squad-dialog-note">{footerNote}</p> : null)}
          </div>
        </div>
      </dialog>
    </>
  );
}
