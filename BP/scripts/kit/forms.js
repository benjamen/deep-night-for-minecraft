// Kit: reusable forms. Game-agnostic.
import { system } from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";

// A combination lock: `count` dials of 0-9. Resolves to the digits chosen, or undefined if the player walked away.
// Retries for a while if the player is busy (another screen open, still loading).
export async function askCombination(player, { title, body, count = 3, labels } = {}) {
  const digits = Array.from({ length: 10 }, (_, i) => String(i));
  for (let tries = 0; tries < 10; tries++) {
    const form = new ModalFormData().title(title ?? "Lock");
    for (let i = 0; i < count; i++) form.dropdown(`${i === 0 && body ? `${body}\n\n` : ""}${labels?.[i] ?? `Dial ${i + 1}`}`, digits);
    const response = await form.show(player);
    if (response.cancelationReason === "UserBusy") {
      await new Promise((resolve) => system.runTimeout(resolve, 20));
      continue;
    }
    if (response.canceled) return undefined;
    return response.formValues.map((v) => Number(v));
  }
  return undefined;
}
