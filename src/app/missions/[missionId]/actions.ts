"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

const SMALLINT_MAX = 32767;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SAFE_MESSAGES = {
  authRequired: "Sesi Anda telah berakhir. Silakan login kembali.",
  onboardingRequired: "Lengkapi onboarding sebelum membuat Squad.",
  accountNotEligible: "Akun Anda tidak dapat membuat Squad.",
  invalidInput: "Data Squad yang diberikan tidak valid.",
  missionNotFound: "Mission tidak ditemukan.",
  missionClosed: "Pendaftaran Mission sudah ditutup.",
  capacityBelowMinimum: "Kapasitas Squad di bawah minimum Mission.",
  capacityAboveMaximum: "Kapasitas Squad melebihi maksimum Mission.",
  individualMission: "Mission individu tidak menggunakan alur Create Squad.",
  limitsUnavailable: "Batas anggota Mission belum tersedia.",
  activeSquadConflict: "Anda sudah memiliki Squad aktif pada Mission ini.",
  databaseError: "Squad belum dapat dibuat. Silakan coba lagi.",
} as const;

const RPC_TRIGGER_MESSAGES = {
  missionNotFound: "Mission not found",
  missionClosed:
    "A new Squad cannot be created after the Mission registration deadline",
  activeSquadConflict:
    "A user may have only one active Squad membership per Mission",
  capacityBelowMinimum: "Squad capacity is below the Mission minimum",
  capacityAboveMaximum: "Squad capacity is above the Mission maximum",
  individualMission: "Individual Missions do not support Squads",
  limitsUnavailable: "Mission team size limits are not configured",
} as const;

export type CreateSquadRequirementInput = {
  primaryClassId: number;
  slots: number;
};

export type CreateSquadInput = {
  missionId: string;
  namaSquad: string;
  deskripsiSquad: string;
  kapasitasAnggota: number;
  requirements: CreateSquadRequirementInput[];
};

export type CreateSquadErrorCode =
  | "AUTH_REQUIRED"
  | "ONBOARDING_REQUIRED"
  | "ACCOUNT_NOT_ELIGIBLE"
  | "INVALID_INPUT"
  | "MISSION_NOT_FOUND"
  | "MISSION_REGISTRATION_CLOSED"
  | "CAPACITY_BELOW_MISSION_MINIMUM"
  | "CAPACITY_ABOVE_MISSION_MAXIMUM"
  | "INDIVIDUAL_MISSION"
  | "MISSION_LIMITS_UNAVAILABLE"
  | "ACTIVE_SQUAD_CONFLICT"
  | "DATABASE_ERROR";

export type CreateSquadResult =
  | { success: true; squadId: string }
  | {
      success: false;
      code: CreateSquadErrorCode;
      message: string;
    };

type NormalizedCreateSquadInput = {
  missionId: string;
  namaSquad: string;
  deskripsiSquad: string;
  kapasitasAnggota: number;
  requirements: Array<{
    primary_class_id: number;
    slot_dibutuhkan: number;
  }>;
};

type DatabaseError = {
  code?: string | null;
  message?: string | null;
};

function failure(
  code: CreateSquadErrorCode,
  message: string,
): CreateSquadResult {
  return { success: false, code, message };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
): boolean {
  const actualKeys = Object.keys(value);

  return (
    actualKeys.length === expectedKeys.length &&
    expectedKeys.every((key) =>
      Object.prototype.hasOwnProperty.call(value, key),
    )
  );
}

function normalizeInput(input: unknown): NormalizedCreateSquadInput | null {
  if (
    !isRecord(input) ||
    !hasExactKeys(input, [
      "missionId",
      "namaSquad",
      "deskripsiSquad",
      "kapasitasAnggota",
      "requirements",
    ]) ||
    typeof input.missionId !== "string" ||
    typeof input.namaSquad !== "string" ||
    typeof input.deskripsiSquad !== "string" ||
    typeof input.kapasitasAnggota !== "number" ||
    !Number.isInteger(input.kapasitasAnggota) ||
    input.kapasitasAnggota < 2 ||
    input.kapasitasAnggota > SMALLINT_MAX ||
    !Array.isArray(input.requirements) ||
    input.requirements.length === 0
  ) {
    return null;
  }

  const missionId = input.missionId.trim().toLocaleLowerCase("en-US");
  const namaSquad = input.namaSquad.trim();
  const deskripsiSquad = input.deskripsiSquad.trim();

  if (
    !UUID_PATTERN.test(missionId) ||
    namaSquad.length === 0 ||
    deskripsiSquad.length === 0
  ) {
    return null;
  }

  const primaryClassIds = new Set<number>();
  const requirements: NormalizedCreateSquadInput["requirements"] = [];
  let totalSlots = 0;

  for (const requirement of input.requirements) {
    if (
      !isRecord(requirement) ||
      !hasExactKeys(requirement, ["primaryClassId", "slots"]) ||
      typeof requirement.primaryClassId !== "number" ||
      !Number.isSafeInteger(requirement.primaryClassId) ||
      typeof requirement.slots !== "number" ||
      !Number.isInteger(requirement.slots) ||
      requirement.slots <= 0 ||
      requirement.slots > SMALLINT_MAX ||
      primaryClassIds.has(requirement.primaryClassId)
    ) {
      return null;
    }

    primaryClassIds.add(requirement.primaryClassId);
    totalSlots += requirement.slots;
    requirements.push({
      primary_class_id: requirement.primaryClassId,
      slot_dibutuhkan: requirement.slots,
    });
  }

  if (totalSlots !== input.kapasitasAnggota - 1) return null;

  return {
    missionId,
    namaSquad,
    deskripsiSquad,
    kapasitasAnggota: input.kapasitasAnggota,
    requirements,
  };
}

function mapRpcError(error: DatabaseError): CreateSquadResult {
  if (error.code === "P0001") {
    if (error.message === RPC_TRIGGER_MESSAGES.missionNotFound) {
      return failure("MISSION_NOT_FOUND", SAFE_MESSAGES.missionNotFound);
    }

    if (error.message === RPC_TRIGGER_MESSAGES.missionClosed) {
      return failure(
        "MISSION_REGISTRATION_CLOSED",
        SAFE_MESSAGES.missionClosed,
      );
    }

    if (error.message === RPC_TRIGGER_MESSAGES.activeSquadConflict) {
      return failure(
        "ACTIVE_SQUAD_CONFLICT",
        SAFE_MESSAGES.activeSquadConflict,
      );
    }
  }

  if (error.message === RPC_TRIGGER_MESSAGES.capacityBelowMinimum) {
    return failure(
      "CAPACITY_BELOW_MISSION_MINIMUM",
      SAFE_MESSAGES.capacityBelowMinimum,
    );
  }

  if (error.message === RPC_TRIGGER_MESSAGES.capacityAboveMaximum) {
    return failure(
      "CAPACITY_ABOVE_MISSION_MAXIMUM",
      SAFE_MESSAGES.capacityAboveMaximum,
    );
  }

  if (error.message === RPC_TRIGGER_MESSAGES.individualMission) {
    return failure("INDIVIDUAL_MISSION", SAFE_MESSAGES.individualMission);
  }

  if (error.message === RPC_TRIGGER_MESSAGES.limitsUnavailable) {
    return failure(
      "MISSION_LIMITS_UNAVAILABLE",
      SAFE_MESSAGES.limitsUnavailable,
    );
  }

  if (error.code === "42501") {
    return failure(
      "ACCOUNT_NOT_ELIGIBLE",
      SAFE_MESSAGES.accountNotEligible,
    );
  }

  if (error.code === "23505") {
    return failure(
      "ACTIVE_SQUAD_CONFLICT",
      SAFE_MESSAGES.activeSquadConflict,
    );
  }

  if (
    error.code === "22003" ||
    error.code === "22023" ||
    error.code === "22P02" ||
    error.code === "23503" ||
    error.code === "23514"
  ) {
    return failure("INVALID_INPUT", SAFE_MESSAGES.invalidInput);
  }

  return failure("DATABASE_ERROR", SAFE_MESSAGES.databaseError);
}

export async function createSquad(
  input: CreateSquadInput,
): Promise<CreateSquadResult> {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    return failure("AUTH_REQUIRED", SAFE_MESSAGES.authRequired);
  }

  const normalizedInput = normalizeInput(input);

  if (!normalizedInput) {
    return failure("INVALID_INPUT", SAFE_MESSAGES.invalidInput);
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("primary_class_id, status_akun")
    .eq("user_id", authData.user.id)
    .maybeSingle();

  if (profileError) {
    return failure("DATABASE_ERROR", SAFE_MESSAGES.databaseError);
  }

  if (!profile || profile.status_akun !== "ACTIVE") {
    return failure(
      "ACCOUNT_NOT_ELIGIBLE",
      SAFE_MESSAGES.accountNotEligible,
    );
  }

  if (profile.primary_class_id === null) {
    return failure(
      "ONBOARDING_REQUIRED",
      SAFE_MESSAGES.onboardingRequired,
    );
  }

  const { data: mission, error: missionError } = await supabase
    .from("missions")
    .select("min_anggota_tim, max_anggota_tim")
    .eq("mission_id", normalizedInput.missionId)
    .maybeSingle();

  if (missionError) {
    return failure("DATABASE_ERROR", SAFE_MESSAGES.databaseError);
  }

  if (!mission) {
    return failure("MISSION_NOT_FOUND", SAFE_MESSAGES.missionNotFound);
  }

  if (
    mission.min_anggota_tim === null ||
    mission.max_anggota_tim === null
  ) {
    return failure(
      "MISSION_LIMITS_UNAVAILABLE",
      SAFE_MESSAGES.limitsUnavailable,
    );
  }

  if (mission.max_anggota_tim === 1) {
    return failure("INDIVIDUAL_MISSION", SAFE_MESSAGES.individualMission);
  }

  if (normalizedInput.kapasitasAnggota < mission.min_anggota_tim) {
    return failure(
      "CAPACITY_BELOW_MISSION_MINIMUM",
      SAFE_MESSAGES.capacityBelowMinimum,
    );
  }

  if (normalizedInput.kapasitasAnggota > mission.max_anggota_tim) {
    return failure(
      "CAPACITY_ABOVE_MISSION_MAXIMUM",
      SAFE_MESSAGES.capacityAboveMaximum,
    );
  }

  const { data: squadId, error: rpcError } = await supabase.rpc(
    "create_squad",
    {
      p_mission_id: normalizedInput.missionId,
      p_nama_squad: normalizedInput.namaSquad,
      p_deskripsi_squad: normalizedInput.deskripsiSquad,
      p_kapasitas_anggota: normalizedInput.kapasitasAnggota,
      p_requirements: normalizedInput.requirements,
    },
  );

  if (rpcError) return mapRpcError(rpcError);

  if (typeof squadId !== "string" || !UUID_PATTERN.test(squadId)) {
    return failure("DATABASE_ERROR", SAFE_MESSAGES.databaseError);
  }

  revalidatePath(`/missions/${normalizedInput.missionId}`);

  return { success: true, squadId };
}

const APPLICATION_MESSAGES = {
  authRequired: "Sesi Anda telah berakhir. Silakan login kembali.",
  accountInactive: "Akun Anda tidak dapat mengajukan permintaan Join.",
  onboardingRequired: "Lengkapi onboarding sebelum mengajukan Join Squad.",
  invalidInput: "Squad yang dipilih tidak valid.",
  squadNotFound: "Squad tidak ditemukan.",
  missionNotFound: "Mission tidak ditemukan.",
  squadLocked: "Squad ini sudah tidak menerima aplikasi.",
  missionClosed: "Pendaftaran Mission sudah ditutup.",
  ownSquad: "Anda tidak dapat mengajukan Join ke Squad sendiri.",
  activeMembership: "Anda sudah menjadi anggota Squad pada Mission ini.",
  duplicatePending: "Anda sudah mengajukan Join ke Squad ini.",
  pendingLimit:
    "Anda sudah mencapai batas 3 aplikasi Pending pada Mission ini.",
  databaseError: "Permintaan Join belum dapat dikirim. Silakan coba lagi.",
} as const;

const APPLICATION_DATABASE_MESSAGES = {
  authRequired: "Not authorized",
  squadRequired: "Squad is required",
  accountInactive: "Account is not active",
  onboardingRequired:
    "Onboarding must be completed before applying to a Squad",
  squadNotFound: "Squad not found",
  missionNotFound: "Mission not found",
  squadLocked: "This Squad is not accepting applications",
  missionClosed: "The Mission registration deadline has passed",
  ownSquad: "You cannot apply to your own Squad",
  activeMembership: "You already have an active Squad for this Mission",
  duplicatePending: "You already have a pending application for this Squad",
  pendingLimit:
    "A user may have at most 3 pending Squad applications per Mission",
} as const;

export type SubmitSquadApplicationErrorCode =
  | "AUTH_REQUIRED"
  | "ACCOUNT_INACTIVE"
  | "ONBOARDING_REQUIRED"
  | "INVALID_INPUT"
  | "SQUAD_NOT_FOUND"
  | "MISSION_NOT_FOUND"
  | "SQUAD_LOCKED"
  | "MISSION_REGISTRATION_CLOSED"
  | "OWN_SQUAD"
  | "ACTIVE_MEMBERSHIP"
  | "DUPLICATE_PENDING"
  | "PENDING_LIMIT_REACHED"
  | "DATABASE_ERROR";

export type SubmitSquadApplicationResult =
  | { success: true; applicationId: string }
  | {
      success: false;
      code: SubmitSquadApplicationErrorCode;
      message: string;
    };

function applicationFailure(
  code: SubmitSquadApplicationErrorCode,
  message: string,
): SubmitSquadApplicationResult {
  return { success: false, code, message };
}

function mapApplicationError(error: DatabaseError): SubmitSquadApplicationResult {
  if (error.message === APPLICATION_DATABASE_MESSAGES.authRequired) {
    return applicationFailure(
      "AUTH_REQUIRED",
      APPLICATION_MESSAGES.authRequired,
    );
  }

  if (error.message === APPLICATION_DATABASE_MESSAGES.squadRequired) {
    return applicationFailure("INVALID_INPUT", APPLICATION_MESSAGES.invalidInput);
  }

  if (error.message === APPLICATION_DATABASE_MESSAGES.accountInactive) {
    return applicationFailure(
      "ACCOUNT_INACTIVE",
      APPLICATION_MESSAGES.accountInactive,
    );
  }

  if (error.message === APPLICATION_DATABASE_MESSAGES.onboardingRequired) {
    return applicationFailure(
      "ONBOARDING_REQUIRED",
      APPLICATION_MESSAGES.onboardingRequired,
    );
  }

  if (error.message === APPLICATION_DATABASE_MESSAGES.squadNotFound) {
    return applicationFailure(
      "SQUAD_NOT_FOUND",
      APPLICATION_MESSAGES.squadNotFound,
    );
  }

  if (error.message === APPLICATION_DATABASE_MESSAGES.missionNotFound) {
    return applicationFailure(
      "MISSION_NOT_FOUND",
      APPLICATION_MESSAGES.missionNotFound,
    );
  }

  if (error.message === APPLICATION_DATABASE_MESSAGES.squadLocked) {
    return applicationFailure(
      "SQUAD_LOCKED",
      APPLICATION_MESSAGES.squadLocked,
    );
  }

  if (error.message === APPLICATION_DATABASE_MESSAGES.missionClosed) {
    return applicationFailure(
      "MISSION_REGISTRATION_CLOSED",
      APPLICATION_MESSAGES.missionClosed,
    );
  }

  if (error.message === APPLICATION_DATABASE_MESSAGES.ownSquad) {
    return applicationFailure("OWN_SQUAD", APPLICATION_MESSAGES.ownSquad);
  }

  if (error.message === APPLICATION_DATABASE_MESSAGES.activeMembership) {
    return applicationFailure(
      "ACTIVE_MEMBERSHIP",
      APPLICATION_MESSAGES.activeMembership,
    );
  }

  if (
    error.code === "23505" ||
    error.message === APPLICATION_DATABASE_MESSAGES.duplicatePending
  ) {
    return applicationFailure(
      "DUPLICATE_PENDING",
      APPLICATION_MESSAGES.duplicatePending,
    );
  }

  if (error.message === APPLICATION_DATABASE_MESSAGES.pendingLimit) {
    return applicationFailure(
      "PENDING_LIMIT_REACHED",
      APPLICATION_MESSAGES.pendingLimit,
    );
  }

  if (error.code === "42501") {
    return applicationFailure(
      "ACCOUNT_INACTIVE",
      APPLICATION_MESSAGES.accountInactive,
    );
  }

  return applicationFailure(
    "DATABASE_ERROR",
    APPLICATION_MESSAGES.databaseError,
  );
}

export async function submitSquadApplication(
  squadId: string,
): Promise<SubmitSquadApplicationResult> {
  if (typeof squadId !== "string") {
    return applicationFailure(
      "INVALID_INPUT",
      APPLICATION_MESSAGES.invalidInput,
    );
  }

  const normalizedSquadId = squadId.trim().toLocaleLowerCase("en-US");

  if (!UUID_PATTERN.test(normalizedSquadId)) {
    return applicationFailure(
      "INVALID_INPUT",
      APPLICATION_MESSAGES.invalidInput,
    );
  }

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    return applicationFailure(
      "AUTH_REQUIRED",
      APPLICATION_MESSAGES.authRequired,
    );
  }

  const { data: squad, error: squadError } = await supabase
    .from("squads")
    .select("mission_id")
    .eq("squad_id", normalizedSquadId)
    .maybeSingle();

  if (squadError) {
    return applicationFailure(
      "DATABASE_ERROR",
      APPLICATION_MESSAGES.databaseError,
    );
  }

  if (!squad) {
    return applicationFailure(
      "SQUAD_NOT_FOUND",
      APPLICATION_MESSAGES.squadNotFound,
    );
  }

  const { data: applicationId, error: applicationError } = await supabase.rpc(
    "submit_squad_application",
    { p_squad_id: normalizedSquadId },
  );

  if (applicationError) return mapApplicationError(applicationError);

  if (typeof applicationId !== "string" || !UUID_PATTERN.test(applicationId)) {
    return applicationFailure(
      "DATABASE_ERROR",
      APPLICATION_MESSAGES.databaseError,
    );
  }

  revalidatePath(`/missions/${squad.mission_id}`);

  return { success: true, applicationId };
}

const APPLICATION_MUTATION_MESSAGES = {
  authRequired: "Sesi Anda telah berakhir. Silakan login kembali.",
  accountInactive: "Akun ACTIVE diperlukan untuk mengelola aplikasi Squad.",
  invalidInput: "Data aplikasi Squad tidak valid.",
  applicationNotFound: "Aplikasi Squad tidak ditemukan.",
  cancelNotAllowed: "Anda hanya dapat membatalkan aplikasi milik sendiri.",
  decideNotAllowed:
    "Hanya Ketua Squad terkait yang dapat memutuskan aplikasi ini.",
  alreadyDecided: "Aplikasi ini sudah tidak berstatus Pending.",
  squadLocked: "Squad sudah tidak menerima anggota baru.",
  missionClosed: "Pendaftaran Mission sudah ditutup.",
  squadFull: "Kapasitas Squad sudah penuh.",
  applicantInactive: "Akun pelamar sudah tidak ACTIVE.",
  activeMembership:
    "Pelamar sudah memiliki membership ACTIVE pada Mission ini.",
  concurrencyConflict:
    "Aplikasi berubah karena proses lain. Muat ulang lalu coba kembali.",
  databaseError: "Aplikasi Squad belum dapat diproses. Silakan coba lagi.",
} as const;

const APPLICATION_MUTATION_DATABASE_MESSAGES = {
  authRequired: "Not authorized",
  accountInactive: "Account is not active",
  applicationRequired: "Application is required",
  applicationNotFound: "Application not found",
  cancelNotAllowed:
    "Only the applicant or admin may cancel this application",
  decideNotAllowed:
    "Only the Squad leader or admin may decide this application",
  cancelAlreadyDecided: "Only a PENDING application can be cancelled",
  decideAlreadyDecided: "Only PENDING applications can be decided",
  invalidDecision: "Decision must be ACCEPTED or REJECTED",
  squadNotFound: "Squad not found",
  squadLocked: "The Squad is no longer open for recruitment",
  missionNotFound: "Mission not found",
  missionClosed: "The Mission registration deadline has passed",
  squadFull: "The Squad is already full",
  applicantInactive: "Applicant account is not active",
  activeMembership:
    "Applicant already has an active Squad for this Mission",
} as const;

export type SquadApplicationDecision = "ACCEPTED" | "REJECTED";

export type SquadApplicationMutationErrorCode =
  | "AUTH_REQUIRED"
  | "ACCOUNT_INACTIVE"
  | "INVALID_INPUT"
  | "APPLICATION_NOT_FOUND"
  | "NOT_ALLOWED"
  | "ALREADY_DECIDED"
  | "SQUAD_LOCKED"
  | "MISSION_REGISTRATION_CLOSED"
  | "SQUAD_FULL"
  | "APPLICANT_INACTIVE"
  | "ACTIVE_MEMBERSHIP"
  | "CONCURRENCY_CONFLICT"
  | "DATABASE_ERROR";

export type SquadApplicationMutationResult =
  | { success: true }
  | {
      success: false;
      code: SquadApplicationMutationErrorCode;
      message: string;
    };

function applicationMutationFailure(
  code: SquadApplicationMutationErrorCode,
  message: string,
): SquadApplicationMutationResult {
  return { success: false, code, message };
}

function mapApplicationMutationError(
  error: DatabaseError,
  operation: "cancel" | "decide",
): SquadApplicationMutationResult {
  if (error.message === APPLICATION_MUTATION_DATABASE_MESSAGES.authRequired) {
    return applicationMutationFailure(
      "AUTH_REQUIRED",
      APPLICATION_MUTATION_MESSAGES.authRequired,
    );
  }

  if (
    error.message === APPLICATION_MUTATION_DATABASE_MESSAGES.applicationRequired ||
    error.message === APPLICATION_MUTATION_DATABASE_MESSAGES.invalidDecision ||
    error.code === "22023" ||
    error.code === "22P02"
  ) {
    return applicationMutationFailure(
      "INVALID_INPUT",
      APPLICATION_MUTATION_MESSAGES.invalidInput,
    );
  }

  if (error.message === APPLICATION_MUTATION_DATABASE_MESSAGES.accountInactive) {
    return applicationMutationFailure(
      "ACCOUNT_INACTIVE",
      APPLICATION_MUTATION_MESSAGES.accountInactive,
    );
  }

  if (
    error.message === APPLICATION_MUTATION_DATABASE_MESSAGES.applicationNotFound ||
    error.message === APPLICATION_MUTATION_DATABASE_MESSAGES.squadNotFound ||
    error.message === APPLICATION_MUTATION_DATABASE_MESSAGES.missionNotFound
  ) {
    return applicationMutationFailure(
      "APPLICATION_NOT_FOUND",
      APPLICATION_MUTATION_MESSAGES.applicationNotFound,
    );
  }

  if (
    error.message === APPLICATION_MUTATION_DATABASE_MESSAGES.cancelNotAllowed ||
    error.message === APPLICATION_MUTATION_DATABASE_MESSAGES.decideNotAllowed
  ) {
    return applicationMutationFailure(
      "NOT_ALLOWED",
      operation === "cancel"
        ? APPLICATION_MUTATION_MESSAGES.cancelNotAllowed
        : APPLICATION_MUTATION_MESSAGES.decideNotAllowed,
    );
  }

  if (
    error.message ===
      APPLICATION_MUTATION_DATABASE_MESSAGES.cancelAlreadyDecided ||
    error.message ===
      APPLICATION_MUTATION_DATABASE_MESSAGES.decideAlreadyDecided
  ) {
    return applicationMutationFailure(
      "ALREADY_DECIDED",
      APPLICATION_MUTATION_MESSAGES.alreadyDecided,
    );
  }

  if (error.message === APPLICATION_MUTATION_DATABASE_MESSAGES.squadLocked) {
    return applicationMutationFailure(
      "SQUAD_LOCKED",
      APPLICATION_MUTATION_MESSAGES.squadLocked,
    );
  }

  if (error.message === APPLICATION_MUTATION_DATABASE_MESSAGES.missionClosed) {
    return applicationMutationFailure(
      "MISSION_REGISTRATION_CLOSED",
      APPLICATION_MUTATION_MESSAGES.missionClosed,
    );
  }

  if (error.message === APPLICATION_MUTATION_DATABASE_MESSAGES.squadFull) {
    return applicationMutationFailure(
      "SQUAD_FULL",
      APPLICATION_MUTATION_MESSAGES.squadFull,
    );
  }

  if (error.message === APPLICATION_MUTATION_DATABASE_MESSAGES.applicantInactive) {
    return applicationMutationFailure(
      "APPLICANT_INACTIVE",
      APPLICATION_MUTATION_MESSAGES.applicantInactive,
    );
  }

  if (
    error.code === "23505" ||
    error.message === APPLICATION_MUTATION_DATABASE_MESSAGES.activeMembership
  ) {
    return applicationMutationFailure(
      "ACTIVE_MEMBERSHIP",
      APPLICATION_MUTATION_MESSAGES.activeMembership,
    );
  }

  if (error.code === "40P01" || error.code === "40001") {
    return applicationMutationFailure(
      "CONCURRENCY_CONFLICT",
      APPLICATION_MUTATION_MESSAGES.concurrencyConflict,
    );
  }

  if (error.code === "42501") {
    return applicationMutationFailure(
      "NOT_ALLOWED",
      operation === "cancel"
        ? APPLICATION_MUTATION_MESSAGES.cancelNotAllowed
        : APPLICATION_MUTATION_MESSAGES.decideNotAllowed,
    );
  }

  return applicationMutationFailure(
    "DATABASE_ERROR",
    APPLICATION_MUTATION_MESSAGES.databaseError,
  );
}

function normalizeApplicationId(applicationId: unknown): string | null {
  if (typeof applicationId !== "string") return null;

  const normalized = applicationId.trim().toLocaleLowerCase("en-US");
  return UUID_PATTERN.test(normalized) ? normalized : null;
}

export async function cancelSquadApplication(
  applicationId: string,
): Promise<SquadApplicationMutationResult> {
  const normalizedApplicationId = normalizeApplicationId(applicationId);

  if (!normalizedApplicationId) {
    return applicationMutationFailure(
      "INVALID_INPUT",
      APPLICATION_MUTATION_MESSAGES.invalidInput,
    );
  }

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    return applicationMutationFailure(
      "AUTH_REQUIRED",
      APPLICATION_MUTATION_MESSAGES.authRequired,
    );
  }

  const { data: application, error: applicationQueryError } = await supabase
    .from("squad_applications")
    .select("mission_id")
    .eq("application_id", normalizedApplicationId)
    .maybeSingle();

  if (applicationQueryError) {
    return applicationMutationFailure(
      "DATABASE_ERROR",
      APPLICATION_MUTATION_MESSAGES.databaseError,
    );
  }

  if (!application) {
    return applicationMutationFailure(
      "APPLICATION_NOT_FOUND",
      APPLICATION_MUTATION_MESSAGES.applicationNotFound,
    );
  }

  const { error } = await supabase.rpc("cancel_squad_application", {
    p_application_id: normalizedApplicationId,
  });

  if (error) return mapApplicationMutationError(error, "cancel");

  revalidatePath(`/missions/${application.mission_id}`);
  return { success: true };
}

export async function decideSquadApplication(
  applicationId: string,
  decision: SquadApplicationDecision,
): Promise<SquadApplicationMutationResult> {
  const normalizedApplicationId = normalizeApplicationId(applicationId);

  if (
    !normalizedApplicationId ||
    (decision !== "ACCEPTED" && decision !== "REJECTED")
  ) {
    return applicationMutationFailure(
      "INVALID_INPUT",
      APPLICATION_MUTATION_MESSAGES.invalidInput,
    );
  }

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    return applicationMutationFailure(
      "AUTH_REQUIRED",
      APPLICATION_MUTATION_MESSAGES.authRequired,
    );
  }

  const { data: application, error: applicationQueryError } = await supabase
    .from("squad_applications")
    .select("mission_id")
    .eq("application_id", normalizedApplicationId)
    .maybeSingle();

  if (applicationQueryError) {
    return applicationMutationFailure(
      "DATABASE_ERROR",
      APPLICATION_MUTATION_MESSAGES.databaseError,
    );
  }

  if (!application) {
    return applicationMutationFailure(
      "APPLICATION_NOT_FOUND",
      APPLICATION_MUTATION_MESSAGES.applicationNotFound,
    );
  }

  const { error } = await supabase.rpc("decide_squad_application", {
    p_application_id: normalizedApplicationId,
    p_decision: decision,
  });

  if (error) return mapApplicationMutationError(error, "decide");

  revalidatePath(`/missions/${application.mission_id}`);
  return { success: true };
}
