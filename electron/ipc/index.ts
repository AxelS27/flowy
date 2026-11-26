import { registerWindowIpc } from "./windowIpc";
import { registerIslandIpc } from "./islandIpc";
import { registerRoutineIpc } from "./routineIpc";
import { registerCelebrationIpc } from "./celebrationIpc";
import { registerAiIpc } from "./aiIpc";
import { registerSttIpc } from "./sttIpc";
import { registerUpdaterIpc } from "./updaterIpc";
import { registerSettingsIpc } from "./settingsIpc";
import { isTrustedSender } from "./trust";

export function registerAllIpc() {
  registerWindowIpc();
  registerIslandIpc();
  registerRoutineIpc();
  registerCelebrationIpc();
  registerAiIpc();
  registerSttIpc({
    isTrustedSender: (sender) =>
      isTrustedSender({
        sender,
        senderFrame: sender.mainFrame,
      } as Electron.IpcMainInvokeEvent),
  });
  registerUpdaterIpc();
  registerSettingsIpc();
}
