export type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function captureInstallPrompt(event: Event, installed: boolean) {
  event.preventDefault();
  return installed ? null : (event as InstallPromptEvent);
}

export async function showInstallPrompt(prompt: InstallPromptEvent) {
  await prompt.prompt();
  return (await prompt.userChoice).outcome;
}
