export type IslandState = "idle" | "listening" | "thinking" | "ambiguous" | "executing" | "completed" | "failed";

export interface IslandDimensions {
  width: number;
  height: number;
  borderRadius: number;
}
