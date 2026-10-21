export type JobStatus =
  "pending" | "submitting" | "queued" | "processing" | "completed" | "failed";
export type TryOnJob = {
  id: string;
  owner_id: string;
  status: JobStatus;
  error_code: string | null;
  created_at: string;
  expires_at: string;
  person_asset_id: string;
  garment_asset_id: string;
  result_asset_id: string | null;
};
export type JobView = {
  job: TryOnJob;
  beforeUrl: string | null;
  afterUrl: string | null;
  look: { id: string; saved: boolean } | null;
  spin: {
    status: "processing" | "completed" | "failed";
    error: string | null;
    sheetUrl: string | null;
    start: number;
  } | null;
};
export type Wallet = { available: number; reserved: number };
export type LocalPhoto = {
  uri: string;
  base64: string;
  width: number;
  height: number;
  bytes: number;
};
export type TryOnConfig = {
  enabled: boolean;
  spinEnabled?: boolean;
  provider: string;
  consentVersion: string;
  maxImageBytes: number;
};
export const isTerminal = (status: JobStatus) =>
  status === "completed" || status === "failed";
export const errorMessages: Record<string, string> = {
  UNAUTHORIZED: "Please sign in again to continue.",
  NO_CREDITS:
    "You’ve used your available try-ons. Purchases aren’t available yet.",
  ACTIVE_JOB:
    "You already have a try-on in progress. Open your recent try-ons to resume it.",
  RATE_LIMIT: "That’s a few too many requests. Please try again later.",
  INVALID_IMAGE:
    "We couldn’t read that photo. Please choose a clear JPEG image.",
  IMAGE_DIMENSIONS:
    "Choose a clear photo at least 64 pixels across, up to 4096 pixels.",
  INVALID_ASSETS:
    "A photo is no longer available. Please select your photos again.",
  PROVIDER_NOT_CONFIGURED:
    "Live try-ons aren’t connected yet. You can still explore the demo.",
  GENERATION_FAILED:
    "The provider couldn’t create this look. Your credit has been returned.",
  GENERATION_TIMEOUT:
    "This try-on took too long. Your credit has been returned.",
  SUBMISSION_FAILED:
    "We couldn’t start this try-on. Your credit has been returned.",
  INVALID_RESULT:
    "The preview couldn’t be used. Your credit has been returned.",
  NOT_FOUND: "This look is no longer available.",
  PROVIDER_BUSY:
    "The AI service is busy right now. Your credit has been returned — try again in a minute.",
};
export const friendlyError = (error: unknown) =>
  error instanceof Error
    ? (errorMessages[error.message] ??
      "We couldn’t complete that request. Please try again.")
    : "Please try again.";
