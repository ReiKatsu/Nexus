"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useMemo, useRef, useState } from "react";

import {
  createSquad,
  type CreateSquadInput,
} from "@/app/missions/[missionId]/actions";

const SMALLINT_MAX = 32767;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type CreateSquadPrimaryClass = {
  primary_class_id: number;
  nama_class: string;
};

type CreateSquadFormProps = {
  missionId: string;
  primaryClasses: CreateSquadPrimaryClass[];
  primaryClassesLoadFailed: boolean;
  registrationOpen: boolean;
  minimumTeamSize: number | null;
  maximumTeamSize: number | null;
};

type RequirementRow = {
  id: number;
  primaryClassId: string;
  slots: string;
};

type RequirementErrors = Record<
  number,
  {
    primaryClassId?: string;
    slots?: string;
  }
>;

type FormErrors = {
  form?: string;
  namaSquad?: string;
  deskripsiSquad?: string;
  kapasitasAnggota?: string;
  requirements?: string;
  requirementRows?: RequirementErrors;
};

type SubmitFeedback =
  | { type: "success"; message: string }
  | { type: "error"; message: string }
  | null;

function parseInteger(value: string): number | null {
  const normalizedValue = value.trim();

  if (!/^-?\d+$/.test(normalizedValue)) return null;

  const parsedValue = Number(normalizedValue);
  return Number.isSafeInteger(parsedValue) ? parsedValue : null;
}

export default function CreateSquadForm({
  missionId,
  primaryClasses,
  primaryClassesLoadFailed,
  registrationOpen,
  minimumTeamSize,
  maximumTeamSize,
}: CreateSquadFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [namaSquad, setNamaSquad] = useState("");
  const [deskripsiSquad, setDeskripsiSquad] = useState("");
  const initialCapacity =
    minimumTeamSize !== null && minimumTeamSize >= 2
      ? String(minimumTeamSize)
      : "";
  const [kapasitasAnggota, setKapasitasAnggota] = useState(initialCapacity);
  const [requirements, setRequirements] = useState<RequirementRow[]>([
    { id: 1, primaryClassId: "", slots: "1" },
  ]);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [submitFeedback, setSubmitFeedback] =
    useState<SubmitFeedback>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitInProgressRef = useRef(false);
  const nextRequirementIdRef = useRef(2);
  const router = useRouter();

  const selectedPrimaryClassIds = useMemo(
    () =>
      new Set(
        requirements
          .map((requirement) => requirement.primaryClassId)
          .filter(Boolean),
      ),
    [requirements],
  );

  const allocatedSlots = useMemo(
    () =>
      requirements.reduce((total, requirement) => {
        const slots = parseInteger(requirement.slots);
        return slots !== null && slots > 0 ? total + slots : total;
      }, 0),
    [requirements],
  );

  const parsedCapacity = parseInteger(kapasitasAnggota);
  const requiredSlots =
    parsedCapacity !== null && parsedCapacity >= 2
      ? parsedCapacity - 1
      : null;
  const remainingSlots =
    requiredSlots === null ? null : requiredSlots - allocatedSlots;

  const availabilityMessage = !registrationOpen
    ? "Pendaftaran Mission telah ditutup. Squad baru tidak dapat dibuat."
    : minimumTeamSize === null || maximumTeamSize === null
      ? "Batas anggota Mission belum tersedia. Squad belum dapat dibuat."
      : maximumTeamSize === 1
        ? "Mission ini merupakan lomba individu dan tidak menggunakan Squad."
    : primaryClassesLoadFailed
      ? "Pilihan Primary Class belum dapat dimuat. Coba muat ulang halaman."
      : primaryClasses.length === 0
        ? "Belum ada Primary Class yang tersedia untuk requirements."
        : null;

  function clearMessages() {
    setFormErrors({});
    setSubmitFeedback((current) =>
      current?.type === "error" ? null : current,
    );
  }

  function updateRequirement(
    id: number,
    field: "primaryClassId" | "slots",
    value: string,
  ) {
    if (isSubmitting) return;

    clearMessages();
    setRequirements((current) =>
      current.map((requirement) =>
        requirement.id === id
          ? { ...requirement, [field]: value }
          : requirement,
      ),
    );
  }

  function addRequirement() {
    if (isSubmitting || requirements.length >= primaryClasses.length) return;

    clearMessages();
    const id = nextRequirementIdRef.current;
    nextRequirementIdRef.current += 1;
    setRequirements((current) => [
      ...current,
      { id, primaryClassId: "", slots: "1" },
    ]);
  }

  function removeRequirement(id: number) {
    if (isSubmitting) return;

    clearMessages();
    setRequirements((current) =>
      current.filter((requirement) => requirement.id !== id),
    );
  }

  function resetForm() {
    setNamaSquad("");
    setDeskripsiSquad("");
    setKapasitasAnggota(initialCapacity);
    setRequirements([{ id: 1, primaryClassId: "", slots: "1" }]);
    nextRequirementIdRef.current = 2;
    setFormErrors({});
  }

  function validateForm(): CreateSquadInput | null {
    const errors: FormErrors = {};
    const requirementErrors: RequirementErrors = {};
    const normalizedMissionId = missionId.trim().toLocaleLowerCase("en-US");
    const normalizedName = namaSquad.trim();
    const normalizedDescription = deskripsiSquad.trim();
    const capacity = parseInteger(kapasitasAnggota);
    const validPrimaryClassIds = new Set(
      primaryClasses.map((primaryClass) => primaryClass.primary_class_id),
    );
    const usedPrimaryClassIds = new Set<number>();
    const normalizedRequirements: CreateSquadInput["requirements"] = [];

    if (!UUID_PATTERN.test(normalizedMissionId)) {
      errors.form = "Mission tidak valid. Muat ulang halaman lalu coba lagi.";
    }

    if (!normalizedName) {
      errors.namaSquad = "Nama Squad wajib diisi.";
    }

    if (!normalizedDescription) {
      errors.deskripsiSquad = "Deskripsi Squad wajib diisi.";
    }

    if (capacity === null || capacity < 2 || capacity > SMALLINT_MAX) {
      errors.kapasitasAnggota =
        "Kapasitas harus berupa bilangan bulat antara 2 dan 32767.";
    } else if (
      minimumTeamSize === null ||
      maximumTeamSize === null
    ) {
      errors.kapasitasAnggota = "Batas anggota Mission belum tersedia.";
    } else if (maximumTeamSize === 1) {
      errors.kapasitasAnggota =
        "Mission individu tidak menggunakan alur Create Squad.";
    } else if (capacity < minimumTeamSize) {
      errors.kapasitasAnggota = `Kapasitas minimal untuk Mission ini adalah ${minimumTeamSize}.`;
    } else if (capacity > maximumTeamSize) {
      errors.kapasitasAnggota = `Kapasitas maksimal untuk Mission ini adalah ${maximumTeamSize}.`;
    }

    if (requirements.length === 0) {
      errors.requirements = "Tambahkan minimal satu requirement.";
    }

    let totalSlots = 0;

    for (const requirement of requirements) {
      const primaryClassId = parseInteger(requirement.primaryClassId);
      const slots = parseInteger(requirement.slots);
      const rowErrors: RequirementErrors[number] = {};

      if (
        primaryClassId === null ||
        !validPrimaryClassIds.has(primaryClassId)
      ) {
        rowErrors.primaryClassId = "Pilih Primary Class.";
      } else if (usedPrimaryClassIds.has(primaryClassId)) {
        rowErrors.primaryClassId =
          "Primary Class yang sama tidak boleh dipilih dua kali.";
      } else {
        usedPrimaryClassIds.add(primaryClassId);
      }

      if (slots === null || slots <= 0 || slots > SMALLINT_MAX) {
        rowErrors.slots =
          "Slot harus berupa bilangan bulat antara 1 dan 32767.";
      }

      if (Object.keys(rowErrors).length > 0) {
        requirementErrors[requirement.id] = rowErrors;
        continue;
      }

      totalSlots += slots as number;
      normalizedRequirements.push({
        primaryClassId: primaryClassId as number,
        slots: slots as number,
      });
    }

    if (
      capacity !== null &&
      capacity >= 2 &&
      capacity <= SMALLINT_MAX &&
      requirements.length > 0 &&
      Object.keys(requirementErrors).length === 0 &&
      totalSlots !== capacity - 1
    ) {
      errors.requirements = `Total slot harus ${capacity - 1}, sesuai kapasitas di luar Ketua.`;
    }

    if (Object.keys(requirementErrors).length > 0) {
      errors.requirementRows = requirementErrors;
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return null;
    }

    return {
      missionId: normalizedMissionId,
      namaSquad: normalizedName,
      deskripsiSquad: normalizedDescription,
      kapasitasAnggota: capacity as number,
      requirements: normalizedRequirements,
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      isSubmitting ||
      submitInProgressRef.current ||
      availabilityMessage
    ) {
      return;
    }

    setSubmitFeedback(null);
    const input = validateForm();
    if (!input) return;

    submitInProgressRef.current = true;
    setIsSubmitting(true);

    try {
      const result = await createSquad(input);

      if (!result.success) {
        setSubmitFeedback({ type: "error", message: result.message });
        return;
      }

      resetForm();
      setIsOpen(false);
      setSubmitFeedback({
        type: "success",
        message: "Squad berhasil dibuat dan sudah tampil pada Mission ini.",
      });
      router.refresh();
    } catch {
      setSubmitFeedback({
        type: "error",
        message: "Squad belum dapat dibuat. Silakan coba lagi.",
      });
    } finally {
      submitInProgressRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <section
      aria-labelledby="create-squad-title"
      className="mt-7 rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm shadow-slate-200/60 sm:mt-8 sm:rounded-3xl sm:p-7"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">
            Kolaborasi
          </p>
          <h2
            id="create-squad-title"
            className="mt-2 text-xl font-bold text-slate-950 sm:text-2xl"
          >
            Buat Squad
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Susun kebutuhan anggota berdasarkan Primary Class untuk mengikuti
            Mission ini.
          </p>
        </div>

        {!isOpen && (
          <button
            type="button"
            disabled={Boolean(availabilityMessage)}
            onClick={() => {
              setSubmitFeedback(null);
              setIsOpen(true);
            }}
            aria-describedby={
              availabilityMessage ? "create-squad-availability" : undefined
            }
            className="inline-flex h-11 w-full shrink-0 items-center justify-center rounded-xl bg-indigo-600 px-5 text-sm font-bold text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 disabled:opacity-80 sm:w-auto"
          >
            Buat Squad
          </button>
        )}
      </div>

      {availabilityMessage && (
        <p
          id="create-squad-availability"
          className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800"
        >
          {availabilityMessage}
        </p>
      )}

      <div aria-live="polite" className="mt-4 min-h-6">
        {submitFeedback && (
          <p
            role={submitFeedback.type === "error" ? "alert" : "status"}
            className={`rounded-xl border px-4 py-3 text-sm leading-6 ${submitFeedback.type === "error" ? "border-red-100 bg-red-50 text-red-700" : "border-emerald-100 bg-emerald-50 text-emerald-700"}`}
          >
            {submitFeedback.message}
          </p>
        )}
      </div>

      {isOpen && !availabilityMessage && (
        <form
          onSubmit={handleSubmit}
          aria-busy={isSubmitting}
          className="mt-5 border-t border-slate-100 pt-6"
        >
          <fieldset disabled={isSubmitting} className="min-w-0">
            <legend className="sr-only">Informasi Create Squad</legend>

            {formErrors.form && (
              <p
                role="alert"
                className="mb-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {formErrors.form}
              </p>
            )}

            <div className="grid min-w-0 gap-5 sm:grid-cols-2">
              <div className="min-w-0">
                <label
                  htmlFor="create-squad-name"
                  className="text-sm font-bold text-slate-700"
                >
                  Nama Squad
                </label>
                <input
                  id="create-squad-name"
                  type="text"
                  value={namaSquad}
                  onChange={(event) => {
                    setNamaSquad(event.target.value);
                    clearMessages();
                  }}
                  aria-invalid={Boolean(formErrors.namaSquad)}
                  aria-describedby={
                    formErrors.namaSquad ? "create-squad-name-error" : undefined
                  }
                  required
                  className="mt-2 h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                  placeholder="Contoh: Squad Garuda"
                />
                {formErrors.namaSquad && (
                  <p
                    id="create-squad-name-error"
                    className="mt-2 text-sm text-red-600"
                  >
                    {formErrors.namaSquad}
                  </p>
                )}
              </div>

              <div className="min-w-0">
                <label
                  htmlFor="create-squad-capacity"
                  className="text-sm font-bold text-slate-700"
                >
                  Kapasitas anggota
                </label>
                <input
                  id="create-squad-capacity"
                  type="number"
                  min={minimumTeamSize ?? undefined}
                  max={maximumTeamSize ?? undefined}
                  step={1}
                  value={kapasitasAnggota}
                  onChange={(event) => {
                    setKapasitasAnggota(event.target.value);
                    clearMessages();
                  }}
                  aria-invalid={Boolean(formErrors.kapasitasAnggota)}
                  aria-describedby={`create-squad-capacity-help${formErrors.kapasitasAnggota ? " create-squad-capacity-error" : ""}`}
                  required
                  className="mt-2 h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                />
                <p
                  id="create-squad-capacity-help"
                  className="mt-2 text-xs leading-5 text-slate-500"
                >
                  {minimumTeamSize !== null && maximumTeamSize !== null
                    ? `Jumlah anggota termasuk Ketua: minimum ${minimumTeamSize}, maksimum ${maximumTeamSize}.`
                    : "Batas anggota Mission belum tersedia."}
                </p>
                {formErrors.kapasitasAnggota && (
                  <p
                    id="create-squad-capacity-error"
                    className="mt-1 text-sm text-red-600"
                  >
                    {formErrors.kapasitasAnggota}
                  </p>
                )}
              </div>

              <div className="min-w-0 sm:col-span-2">
                <label
                  htmlFor="create-squad-description"
                  className="text-sm font-bold text-slate-700"
                >
                  Deskripsi Squad
                </label>
                <textarea
                  id="create-squad-description"
                  rows={4}
                  value={deskripsiSquad}
                  onChange={(event) => {
                    setDeskripsiSquad(event.target.value);
                    clearMessages();
                  }}
                  aria-invalid={Boolean(formErrors.deskripsiSquad)}
                  aria-describedby={
                    formErrors.deskripsiSquad
                      ? "create-squad-description-error"
                      : undefined
                  }
                  required
                  className="mt-2 block w-full min-w-0 resize-y rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                  placeholder="Jelaskan fokus dan tujuan Squad ini."
                />
                {formErrors.deskripsiSquad && (
                  <p
                    id="create-squad-description-error"
                    className="mt-2 text-sm text-red-600"
                  >
                    {formErrors.deskripsiSquad}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-7 border-t border-slate-100 pt-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Requirements anggota
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Alokasikan slot anggota di luar Ketua. Primary Class Ketua
                    tidak mengurangi requirements.
                  </p>
                </div>
                <div className="grid shrink-0 grid-cols-2 gap-2 text-center text-xs sm:w-64">
                  <div className="rounded-xl bg-indigo-50 px-3 py-2 text-indigo-700">
                    <span className="block font-semibold">Dialokasikan</span>
                    <span className="mt-0.5 block text-base font-bold">
                      {allocatedSlots}
                    </span>
                  </div>
                  <div
                    className={`rounded-xl px-3 py-2 ${remainingSlots !== null && remainingSlots < 0 ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-700"}`}
                  >
                    <span className="block font-semibold">
                      {remainingSlots !== null && remainingSlots < 0
                        ? "Kelebihan"
                        : "Sisa"}
                    </span>
                    <span className="mt-0.5 block text-base font-bold">
                      {remainingSlots === null
                        ? "-"
                        : Math.abs(remainingSlots)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {requirements.map((requirement, index) => {
                  const rowErrors =
                    formErrors.requirementRows?.[requirement.id];

                  return (
                    <div
                      key={requirement.id}
                      className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <p className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                        Requirement {index + 1}
                      </p>
                      <div className="grid min-w-0 gap-4 sm:grid-cols-[minmax(0,1fr)_9rem_auto] sm:items-start">
                        <div className="min-w-0">
                          <label
                            htmlFor={`requirement-class-${requirement.id}`}
                            className="text-sm font-bold text-slate-700"
                          >
                            Primary Class
                          </label>
                          <select
                            id={`requirement-class-${requirement.id}`}
                            value={requirement.primaryClassId}
                            onChange={(event) =>
                              updateRequirement(
                                requirement.id,
                                "primaryClassId",
                                event.target.value,
                              )
                            }
                            aria-invalid={Boolean(rowErrors?.primaryClassId)}
                            aria-describedby={
                              rowErrors?.primaryClassId
                                ? `requirement-class-error-${requirement.id}`
                                : undefined
                            }
                            required
                            className="mt-2 h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                          >
                            <option value="">Pilih Primary Class</option>
                            {primaryClasses.map((primaryClass) => {
                              const optionValue = String(
                                primaryClass.primary_class_id,
                              );
                              const selectedElsewhere =
                                optionValue !== requirement.primaryClassId &&
                                selectedPrimaryClassIds.has(optionValue);

                              return (
                                <option
                                  key={primaryClass.primary_class_id}
                                  value={optionValue}
                                  disabled={selectedElsewhere}
                                >
                                  {primaryClass.nama_class}
                                </option>
                              );
                            })}
                          </select>
                          {rowErrors?.primaryClassId && (
                            <p
                              id={`requirement-class-error-${requirement.id}`}
                              className="mt-2 text-sm text-red-600"
                            >
                              {rowErrors.primaryClassId}
                            </p>
                          )}
                        </div>

                        <div className="min-w-0">
                          <label
                            htmlFor={`requirement-slots-${requirement.id}`}
                            className="text-sm font-bold text-slate-700"
                          >
                            Jumlah slot
                          </label>
                          <input
                            id={`requirement-slots-${requirement.id}`}
                            type="number"
                            min={1}
                            max={SMALLINT_MAX}
                            step={1}
                            value={requirement.slots}
                            onChange={(event) =>
                              updateRequirement(
                                requirement.id,
                                "slots",
                                event.target.value,
                              )
                            }
                            aria-invalid={Boolean(rowErrors?.slots)}
                            aria-describedby={
                              rowErrors?.slots
                                ? `requirement-slots-error-${requirement.id}`
                                : undefined
                            }
                            required
                            className="mt-2 h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                          />
                          {rowErrors?.slots && (
                            <p
                              id={`requirement-slots-error-${requirement.id}`}
                              className="mt-2 text-sm text-red-600"
                            >
                              {rowErrors.slots}
                            </p>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => removeRequirement(requirement.id)}
                          className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-red-100 bg-white px-4 text-sm font-bold text-red-600 transition hover:border-red-200 hover:bg-red-50 focus:outline-none focus:ring-4 focus:ring-red-100 sm:mt-7 sm:w-auto"
                          aria-label={`Hapus requirement ${index + 1}`}
                        >
                          Hapus
                        </button>
                      </div>
                    </div>
                  );
                })}

                {requirements.length === 0 && (
                  <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">
                    Belum ada requirement. Tambahkan minimal satu Primary
                    Class.
                  </p>
                )}
              </div>

              {formErrors.requirements && (
                <p
                  id="create-squad-requirements-error"
                  role="alert"
                  className="mt-3 text-sm text-red-600"
                >
                  {formErrors.requirements}
                </p>
              )}

              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={addRequirement}
                  disabled={requirements.length >= primaryClasses.length}
                  className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 px-4 text-sm font-bold text-indigo-700 transition hover:border-indigo-300 hover:bg-indigo-100 focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 sm:w-auto"
                >
                  Tambah requirement
                </button>
                {requirements.length >= primaryClasses.length && (
                  <p className="text-xs leading-5 text-slate-500">
                    Jumlah requirement sudah mencapai jumlah Primary Class
                    yang tersedia.
                  </p>
                )}
              </div>
            </div>
          </fieldset>

          <div className="mt-7 flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                setFormErrors({});
                setSubmitFeedback(null);
                setIsOpen(false);
              }}
              className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-100 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-indigo-600 px-5 text-sm font-bold text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:bg-indigo-300 disabled:opacity-80 sm:w-auto"
            >
              {isSubmitting ? "Membuat Squad..." : "Simpan Squad"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
