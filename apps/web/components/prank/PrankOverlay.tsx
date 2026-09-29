"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import gsap from "gsap";
import type { PrankDefinition } from "@yrud/shared";
import { playPrankSting } from "@/lib/sfx";
import { useSuppressAmbiance } from "@/lib/ambiance";

// Per-id visual flourish. Any future registry entry without bespoke sprite
// art here still gets a full jumpscare treatment via the emoji fallback —
// no new plumbing needed to add another gag.
const PRANK_SPRITE: Record<string, string> = {
  zeratchoupi: "/sprites/zeratchoupi.png",
};
const FALLBACK_EMOJI = "👹";

interface PrankOverlayProps {
  prank: PrankDefinition;
  text: string;
  onDone: () => void;
}

function SpritePrankOverlay({ prank, text, onDone }: PrankOverlayProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const creatureRef = useRef<HTMLDivElement>(null);
  const sprite = PRANK_SPRITE[prank.id];

  useEffect(() => {
    playPrankSting();
    const root = rootRef.current;
    const creature = creatureRef.current;
    if (root && creature) {
      const tl = gsap.timeline();
      tl.fromTo(
        creature,
        { scale: 4, opacity: 0, rotation: -15 },
        { scale: 1, opacity: 1, rotation: 0, duration: 0.25, ease: "power4.out" }
      ).to(
        root,
        { x: -14, duration: 0.05, ease: "power1.inOut", repeat: 7, yoyo: true },
        0
      );
    }
    const timeout = setTimeout(onDone, prank.durationMs);
    return () => clearTimeout(timeout);
  }, [onDone, prank.durationMs]);

  return (
    <div
      ref={rootRef}
      onClick={onDone}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onDone()}
      className="fixed inset-0 z-[60] flex cursor-pointer flex-col items-center justify-center gap-6 bg-black px-6"
    >
      <div ref={creatureRef} className="flex h-48 items-center justify-center drop-shadow-[0_0_40px_rgba(232,193,90,0.6)]">
        {sprite ? (
          <Image
            src={sprite}
            alt={prank.id}
            width={202}
            height={182}
            className="h-full w-auto max-w-[14rem] object-contain"
            style={{ imageRendering: "pixelated" }}
          />
        ) : (
          <span className="text-[8rem] leading-none">{FALLBACK_EMOJI}</span>
        )}
      </div>
      <p
        className={`max-w-2xl rounded-2xl bg-black/50 px-6 py-3 text-center font-black italic leading-tight text-gold-bright shadow-[0_0_30px_rgba(0,0,0,0.6)] ${
          text.length > 90 ? "text-lg sm:text-xl" : text.length > 40 ? "text-2xl sm:text-3xl" : "text-4xl tracking-tight"
        }`}
      >
        {text}
      </p>
      <span className="text-xs text-white/40">Cliquer pour fermer</span>
    </div>
  );
}

// A video gag: plays full-screen and closes itself when the clip ends. The
// callback goes through a ref because callers pass a fresh closure every
// render, and re-running the effect would restart the safety timer.
function VideoPrankOverlay({ prank, onDone }: PrankOverlayProps) {
  useSuppressAmbiance();
  const videoRef = useRef<HTMLVideoElement>(null);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      // Browsers block sound-on autoplay until the page has had a tap — the
      // players have (they joined), a bare spectator screen may not. Better
      // a silent gag than no gag.
      video.play().catch(() => {
        video.muted = true;
        video.play().catch(() => onDoneRef.current());
      });
    }
    // Safety net: if the clip stalls or never loads, don't leave a black
    // screen blocking everyone's question.
    const timeout = setTimeout(() => onDoneRef.current(), prank.durationMs + 2000);
    return () => clearTimeout(timeout);
  }, [prank.durationMs]);

  return (
    <div
      onClick={onDone}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onDone()}
      className="fixed inset-0 z-[60] flex cursor-pointer items-center justify-center bg-black"
    >
      <video
        ref={videoRef}
        src={prank.videoUrl}
        autoPlay
        playsInline
        preload="auto"
        onEnded={onDone}
        onError={onDone}
        className="h-full w-full object-contain"
      />
    </div>
  );
}

// An image popping up over the game while an audio clip plays; closes when
// the clip ends. Same ref-for-onDone reasoning as VideoPrankOverlay.
function ImageAudioPrankOverlay({ prank, onDone }: PrankOverlayProps) {
  useSuppressAmbiance();
  const imageRef = useRef<HTMLDivElement>(null);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const image = imageRef.current;
    const tl = gsap.timeline();
    if (image) {
      tl.fromTo(
        image,
        { scale: 0.2, opacity: 0, rotation: -12 },
        { scale: 1, opacity: 1, rotation: 0, duration: 0.45, ease: "back.out(2.4)" }
      ).to(image, { rotation: 2.5, duration: 0.18, ease: "sine.inOut", repeat: -1, yoyo: true });
    }

    // Set on cleanup: pausing the audio there makes its pending play() reject,
    // and that rejection (React's dev double-mount triggers it, so can a fast
    // dismiss) must not be mistaken for a real playback failure.
    let cancelled = false;
    let closeTimer: ReturnType<typeof setTimeout> | undefined;
    const closeSoon = (ms: number) => {
      if (cancelled) return;
      clearTimeout(closeTimer);
      closeTimer = setTimeout(() => onDoneRef.current(), ms);
    };

    let audio: HTMLAudioElement | undefined;
    if (prank.audioUrl) {
      audio = new Audio(prank.audioUrl);
      audio.onended = () => closeSoon(400);
      // Unsupported format or blocked autoplay: the image alone still lands,
      // it just doesn't have to stay up for the whole clip's length.
      audio.onerror = () => closeSoon(3500);
      audio.play().catch(() => closeSoon(3500));
    }
    // Safety net if the clip stalls partway and never ends.
    closeTimer = setTimeout(() => onDoneRef.current(), prank.durationMs + 2000);

    return () => {
      cancelled = true;
      clearTimeout(closeTimer);
      tl.kill();
      if (audio) {
        audio.onended = null;
        audio.onerror = null;
        audio.pause();
      }
    };
  }, [prank.audioUrl, prank.durationMs]);

  return (
    <div
      onClick={onDone}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onDone()}
      className="fixed inset-0 z-[60] flex cursor-pointer flex-col items-center justify-center gap-3 bg-black/85 px-6 py-4"
    >
      <div ref={imageRef} className="drop-shadow-[0_0_40px_rgba(232,193,90,0.55)]">
        {prank.imageUrl && prank.bigSprite && (
          // eslint-disable-next-line @next/next/no-img-element -- pixel-art sprite scaled to fill the screen
          <img
            src={prank.imageUrl}
            alt=""
            className="h-[80vh] max-w-[95vw] object-contain"
            style={{ imageRendering: "pixelated" }}
          />
        )}
        {prank.imageUrl && !prank.bigSprite && (
          <Image
            src={prank.imageUrl}
            alt=""
            width={658}
            height={906}
            priority
            className="h-auto max-h-[82vh] w-auto max-w-full object-contain"
          />
        )}
      </div>
      <span className="text-xs text-white/40">Cliquer pour fermer</span>
    </div>
  );
}

export function PrankOverlay(props: PrankOverlayProps) {
  if (props.prank.videoUrl) return <VideoPrankOverlay {...props} />;
  if (props.prank.imageUrl) return <ImageAudioPrankOverlay {...props} />;
  return <SpritePrankOverlay {...props} />;
}
