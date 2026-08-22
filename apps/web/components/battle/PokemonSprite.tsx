"use client";

import { useState } from "react";
import Image from "next/image";

function slug(species: string) {
  return species.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// The animated "xyani" set (X/Y 3D-model derived) doesn't cover every
// species Showdown itself supports — Gen 9 Paradox Pokémon in particular
// (e.g. Iron Valiant) 404 there, since those models didn't exist yet when
// that set was made. "gen5" static art has full coverage across every gen,
// so it's the fallback once the animated sprite fails to load, rather than
// silently showing broken-image alt text.
function animatedUrl(species: string, facing: "front" | "back") {
  return `https://play.pokemonshowdown.com/sprites/${facing === "back" ? "xyani-back" : "xyani"}/${slug(species)}.gif`;
}

function staticUrl(species: string, facing: "front" | "back") {
  return `https://play.pokemonshowdown.com/sprites/${facing === "back" ? "gen5-back" : "gen5"}/${slug(species)}.png`;
}

interface PokemonSpriteProps {
  species: string;
  facing?: "front" | "back";
  className?: string;
  fainted?: boolean;
}

export function PokemonSprite({ species, facing = "front", className = "", fainted }: PokemonSpriteProps) {
  const [failed, setFailed] = useState(false);
  return (
    <Image
      key={species}
      src={failed ? staticUrl(species, facing) : animatedUrl(species, facing)}
      alt={species}
      fill
      unoptimized
      onError={() => setFailed(true)}
      className={`object-contain ${fainted ? "opacity-45 grayscale" : ""} ${className}`}
    />
  );
}
