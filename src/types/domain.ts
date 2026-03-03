export type AccountRole = "ACCOUNT_OWNER" | "DISPATCHER" | "TECH" | "READ_ONLY";

export type LeadStage =
  | "NEW"
  | "CONTACTED"
  | "QUALIFIED"
  | "BOOKED"
  | "COMPLETED"
  | "LOST";

export type Channel = "SMS" | "EMAIL" | "VOICE";

export type SequenceType = "MISSED_CALL_FOLLOWUP" | "NEW_LEAD_FOLLOWUP" | "REVIEW_REQUEST";
