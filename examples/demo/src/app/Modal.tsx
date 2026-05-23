import { useEffect, useId } from "react";
import type { ReactNode } from "react";

interface ModalProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}

export function Modal({ open, title, description, onClose, children }: ModalProps) {
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  return (
    <div
      aria-hidden={!open}
      inert={!open}
      className={[
        "fixed inset-0 z-50 flex items-end justify-center p-3 transition duration-200 sm:items-center sm:p-4",
        open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
      ].join(" ")}
    >
      <button
        type="button"
        aria-label="关闭弹窗"
        className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm"
        onClick={open ? onClose : undefined}
        tabIndex={-1}
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={[
          "relative z-10 flex w-full max-w-5xl translate-y-4 scale-[0.98] flex-col overflow-hidden rounded-3xl border border-white/10",
          "bg-slate-950/95 shadow-2xl ring-1 ring-white/10 backdrop-blur-xl transition duration-200",
          open ? "translate-y-0 scale-100" : "translate-y-4 scale-[0.98]",
        ].join(" ")}
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
              Modal
            </p>
            <h2 id={titleId} className="mt-2 text-2xl font-semibold text-white">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-2 text-sm leading-6 text-slate-300">
                {description}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-white/10"
            onClick={onClose}
          >
            关闭
          </button>
        </div>

        <div className="max-h-[calc(100vh-6.5rem)] overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
          {children}
        </div>
      </section>
    </div>
  );
}
