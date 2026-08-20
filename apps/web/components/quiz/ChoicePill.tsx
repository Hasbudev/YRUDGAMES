import Image from "next/image";

export type ChoiceLetter = "a" | "b" | "c" | "d";
export type ChoiceVisualState = "idle" | "confirmed" | "correct" | "wrong" | "locked";

const TEXT_CLASS: Record<ChoiceVisualState, string> = {
  idle: "text-ink",
  confirmed: "text-void-deep",
  correct: "text-white",
  wrong: "text-white/90",
  locked: "text-ink-muted",
};

interface ChoicePillProps {
  letter: ChoiceLetter;
  label: string;
  state: ChoiceVisualState;
  disabled?: boolean;
  onClick?: () => void;
}

// The pill art bakes in a letter badge on the left ~30% and leaves the rest
// blank for the (dynamic) answer text — the taller aspect ratio matches the
// glow-bleed states (selected/confirmed/correct/wrong/locked) so idle's
// tighter art object-contains into the same box without shifting the badge.
export function ChoicePill({ letter, label, state, disabled, onClick }: ChoicePillProps) {
  const canHover = state === "idle" && !disabled;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`group relative block aspect-[340/124] w-full ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
    >
      <Image src={`/play/choices/${state}-${letter}.png`} alt="" fill unoptimized className="object-contain" />
      {canHover && (
        <Image
          src={`/play/choices/selected-${letter}.png`}
          alt=""
          fill
          unoptimized
          className="object-contain opacity-0 transition-opacity duration-150 group-hover:opacity-100"
        />
      )}
      <span
        className={`absolute inset-y-0 right-[6%] flex items-center text-left text-sm font-semibold leading-tight sm:text-base ${TEXT_CLASS[state]}`}
        style={{ left: "30%" }}
      >
        {label}
      </span>
    </button>
  );
}
