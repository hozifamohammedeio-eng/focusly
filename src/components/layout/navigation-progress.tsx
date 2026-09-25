"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timer =
      window.setTimeout(
        () => {
          setLoading(false);
        },
        0,
      );

    return () => {
      window.clearTimeout(timer);
    };
  }, [pathname, searchParams]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a");

      if (!anchor) return;

      const href = anchor.getAttribute("href");

      if (
        !href ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        anchor.target === "_blank" ||
        anchor.hasAttribute("download")
      ) {
        return;
      }

      const destination = new URL(anchor.href, window.location.href);

      if (destination.origin !== window.location.origin) {
        return;
      }

      const current =
        window.location.pathname +
        window.location.search +
        window.location.hash;

      const next =
        destination.pathname +
        destination.search +
        destination.hash;

      if (current === next) {
        return;
      }

      setLoading(true);
    }

    document.addEventListener("click", handleClick, true);

    return () => {
      document.removeEventListener("click", handleClick, true);
    };
  }, []);

  return (
    <div
      className={`focusly-navigation-progress ${
        loading ? "is-loading" : ""
      }`}
      aria-hidden="true"
    >
      <div className="focusly-navigation-progress-bar" />
    </div>
  );
}