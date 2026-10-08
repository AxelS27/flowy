import { registerWindowIpc } from "./windowIpc";
import { registerIslandIpc } from "./islandIpc";
import { registerRoutineIpc } from "./routineIpc";
import { registerCelebrationIpc } from "./celebrationIpc";
import { registerAiIpc } from "./aiIpc";

export function registerAllIpc() {
  registerWindowIpc();
  registerIslandIpc();
  registerRoutineIpc();
  registerCelebrationIpc();
  registerAiIpc();
}
