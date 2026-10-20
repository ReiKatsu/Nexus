"use client";

import { type ReactNode, useId, useRef } from "react";

import type { SquadRequirement } from "./types";

export type SquadCardPerson = { name: string; role: string };

type SquadCardProps = {
  name: string;
  description: string;
  statusLabel: "Open" | "Locked" | null;
  countLabel: string;
  /** Satu entri per anggota ACTIVE; string = inisial yang boleh ditampilkan, null = anonim. */
  avatars: Array<string | null>;
  badge?: string;
  subtitle: string;
  people: SquadCardPerson[];
  otherMembers: number;
  requirements: SquadRequirement[];
  /** Kontrol Minta Gabung / Batalkan; dirender di kolom kanan footer modal. */
  action?: ReactNode;
  /** Catatan di footer bila Squad tidak menerima aplikasi. */
  footerNote?: string;
  /** Daftar pelamar untuk Ketua. */
  extra?: ReactNode;
};

const MAX_AVATARS = 5;

function initialOf(name: string) {
  return name.trim().charAt(0).toLocaleUpperCase("id-ID") || "?";
}

export default function SquadCard({
  name, description, statusLabel, countLabel, avatars, badge, subtitle,
  people, otherMembers, requirements, action, footerNote, extra,
}: SquadCardProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const shown = avatars.slice(0, MAX_AVATARS);
  const hidden = avatars.length - shown.length;
  const dialogTitleId = useId();

  return (
    <>
      <button type="button" className="squad-card" onClick={() => dialogRef.current?.showModal()}
        aria-haspopup="dialog" aria-label={`Lihat detail Squad ${name}`}>
        <span className="squad-card-head">
          <span className="squad-card-name">{name}</span>
          {statusLabel && (
            <span className={`squad-card-status ${statusLabel === "Open" ? "is-open" : "is-locked"}`}>{statusLabel}</span>
          )}
        </span>
        <span className="squad-card-desc">{description}</span>
        <span className="squad-card-foot">
          <span className="squad-card-avatars" aria-hidden="true">
            {shown.map((initial, index) => <i key={index}>{initial}</i>)}
            {hidden > 0 && <i>+{hidden}</i>}
          </span>
          <span className="squad-card-count">{countLabel}</span>
        </span>
        {badge && <span className="squad-card-badge">{badge}</span>}
      </button>

      <dialog ref={dialogRef} className="squad-dialog" aria-labelledby={dialogTitleId}
        onClick={(event) => { if (event.target === dialogRef.current) dialogRef.current?.close(); }}>
        <div className="squad-dialog-cover" aria-hidden="true" />
        <div className="squad-dialog-body">
          <h3 id={dialogTitleId}>{name}</h3>
          <p className="squad-dialog-sub">{subtitle}</p>
          <p className="squad-dialog-desc">{description}</p>

          <ul className="squad-dialog-people">
            {people.map((person) => (
              <li key={`${person.role}:${person.name}`}>
                <span className={`squad-dialog-avatar${person.role === "Ketua" ? " is-leader" : ""}`}>{initialOf(person.name)}</span>
                <span><strong>{person.name}</strong><small>{person.role}</small></span>
              </li>
            ))}
            {otherMembers > 0 && (
              <li>
                <span className="squad-dialog-avatar">+{otherMembers}</span>
                <span><strong>{otherMembers} anggota lain</strong><small>Anggota</small></span>
              </li>
            )}
          </ul>

          {requirements.length > 0 && (
            <div className="squad-dialog-needs">
              <p>Kebutuhan anggota</p>
              <ul>
                {requirements.map((item) => <li key={item.className}>{item.className} × {item.slots}</li>)}
              </ul>
            </div>
          )}

          {extra}

          <div className="squad-dialog-actions">
            <button type="button" className="squad-dialog-close" onClick={() => dialogRef.current?.close()}>Tutup</button>
            {action ?? (footerNote && <p className="squad-dialog-note">{footerNote}</p>)}
          </div>
        </div>
      </dialog>
    </>
  );
}
