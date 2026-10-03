"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { captureInstallPrompt, showInstallPrompt, type InstallPromptEvent } from "./install-prompt";

type InstallState = {
  canInstall: boolean;
  showIosInstructions: boolean;
  install: () => Promise<void>;
};

const InstallContext = createContext<InstallState>({
  canInstall: false,
  showIosInstructions: false,
  install: async () => {},
});

export function InstallProvider({ children }: { children: ReactNode }) {
  const promptRef = useRef<InstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [iosSafari, setIosSafari] = useState(false);

  useEffect(() => {
    const mode = window.matchMedia("(display-mode: standalone)");
    const installed = () =>
      mode.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const syncMode = () => {
      const isInstalled = installed();
      setStandalone(isInstalled);
      if (isInstalled) {
        promptRef.current = null;
        setCanInstall(false);
      }
    };
    const onPrompt = (event: Event) => {
      promptRef.current = captureInstallPrompt(event, installed());
      setCanInstall(promptRef.current !== null);
    };
    const onInstalled = () => {
      promptRef.current = null;
      setCanInstall(false);
      setStandalone(true);
    };

    const agent = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/i.test(agent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    queueMicrotask(() => {
      setIosSafari(ios && /Safari/i.test(agent) && !/CriOS|FxiOS|EdgiOS/i.test(agent));
      syncMode();
    });
    mode.addEventListener("change", syncMode);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    // The existing notification worker has no fetch handler: app, Auth, Supabase,
    // and Gemini responses always use the network, including after deployment.
    const registerWorker = () => {
      void navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .catch(() => {});
    };
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      if (document.readyState === "complete") registerWorker();
      else window.addEventListener("load", registerWorker, { once: true });
    }

    return () => {
      mode.removeEventListener("change", syncMode);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("load", registerWorker);
    };
  }, []);

  async function install() {
    const prompt = promptRef.current;
    if (!prompt) return;
    promptRef.current = null;
    setCanInstall(false);
    try {
      await showInstallPrompt(prompt);
      // A dismissed prompt is consumed. A later beforeinstallprompt event can re-enable it.
    } catch {
      // Keep the control hidden until the browser offers another valid prompt.
    }
  }

  return (
    <InstallContext.Provider value={{
      canInstall: canInstall && !standalone,
      showIosInstructions: iosSafari && !standalone,
      install,
    }}>
      {children}
    </InstallContext.Provider>
  );
}

export function useInstallFocusly() {
  return useContext(InstallContext);
}
