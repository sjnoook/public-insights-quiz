"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const SCREENS = [
  { href: "/slideshow", label: "Slideshow" },
  { href: "/quiz", label: "Kwis" },
  { href: "/editor", label: "Editor" },
];

export default function ScreenSwitcher() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onFullscreenChange() {
      setFullscreen(Boolean(document.fullscreenElement));
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (!target || wrapperRef.current?.contains(target)) return;
      setOpen(false);
    }

    document.addEventListener("fullscreenchange", onFullscreenChange);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);

    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, []);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }

      await document.documentElement.requestFullscreen();
    } catch {
      // Some browsers block fullscreen without a direct user gesture.
    }
  }

  return (
    <div className="screen-switcher" ref={wrapperRef}>
      <div className="screen-switcher-controls">
        <button
          aria-label={fullscreen ? "Volledig scherm sluiten" : "Volledig scherm openen"}
          className={`fullscreen-button ${fullscreen ? "active" : ""}`}
          onClick={toggleFullscreen}
          title={fullscreen ? "Volledig scherm sluiten" : "Volledig scherm openen"}
          type="button"
        >
          <span aria-hidden="true" />
        </button>

        <button
          aria-expanded={open}
          aria-label="Schermwisselaar openen"
          className="screen-switcher-button"
          onClick={() => setOpen((value) => !value)}
          type="button"
        >
          <span aria-hidden="true" />
        </button>
      </div>

      {open ? (
        <nav aria-label="Schermwisselaar" className="screen-switcher-menu">
          {SCREENS.map((screen) => {
            const active =
              pathname === screen.href ||
              (screen.href === "/slideshow" && pathname?.startsWith("/slideshow")) ||
              (screen.href === "/quiz" && pathname === "/") ||
              (screen.href === "/editor" && pathname === "/studio");

            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={active ? "active" : ""}
                href={screen.href}
                key={screen.href}
                onClick={() => setOpen(false)}
              >
                {screen.label}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}
