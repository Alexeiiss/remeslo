"use client";

/** Tlačítko, které se před odesláním formuláře zeptá */
export default function ConfirmButton({
  children, message, className = "btn",
}: { children: React.ReactNode; message: string; className?: string }) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => { if (!confirm(message)) e.preventDefault(); }}
    >
      {children}
    </button>
  );
}
