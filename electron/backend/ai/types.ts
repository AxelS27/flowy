export interface RoutineMetadata {
  id: string;
  name: string;
  description?: string;
  category?: string;
}

export interface RouteRequest {
  requestId: string;
  text: string;
  routines: RoutineMetadata[];
}

export type RouteDecision =
  | { status: "match"; routineId: string }
  | { status: "ambiguous"; candidateIds: string[] }
  | { status: "no_match" };

export type RouteErrorCode =
  | "NOT_CONFIGURED"
  | "INVALID_REQUEST"
  | "AUTHENTICATION"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "OFFLINE"
  | "INVALID_RESPONSE"
  | "CANCELLED"
  | "PROVIDER_ERROR";

export type RouteResult =
  | { ok: true; requestId: string; decision: RouteDecision }
  | { ok: false; requestId: string; code: RouteErrorCode; error: string };

export interface AiConfigurationStatus {
  configured: boolean;
  provider: "gemini";
  model: string;
}
