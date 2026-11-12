import { useEffect, useRef, type ReactNode } from "react";

export function Overlay({ visible, z, align = "center", onClose, children }: { visible: boolean; z: string; align?: "center" | "left"; onClose?: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!visible) return;
    const previous = document.activeElement;
    const timer = setTimeout(() => dialog.current?.focus({ preventScroll: true }), 50);
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose?.();
      if (event.key !== "Tab") return;
      const items = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button, a, input, [tabindex="0"]') ?? []);
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => { clearTimeout(timer); document.removeEventListener("keydown", keydown); if (previous instanceof HTMLElement) previous.focus(); };
  }, [visible, onClose]);
  return (
    <div aria-hidden={!visible} inert={!visible} onClick={(e) => e.target === e.currentTarget && onClose?.()} className={`fixed inset-0 ${z} flex items-center justify-center bg-[var(--overlay)] p-4 backdrop-blur-sm transition-all duration-300 ${visible ? "visible opacity-100" : "invisible opacity-0"}`}>
      <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" className={`panel loci-dialog ease-loci max-h-[calc(100dvh-32px)] w-full max-w-[460px] overflow-y-auto rounded-[22px] px-5 py-6 sm:px-8 sm:py-7 transition-transform duration-500 ${align === "center" ? "text-center" : ""} ${visible ? "translate-y-0 scale-100" : "translate-y-4 scale-95"}`}>
        {children}
      </div>
    </div>
  );
}
