import type { SceneMood } from "@/components/scene/SceneMoodContext";

// Background ambiance per scene mood — a YouTube video id per slot, looped
// quietly behind the live event. Left null until real tracks are picked:
// no video plays for a null slot, same as if ambiance were off entirely.
//
// To add music: find a track on YouTube you have the rights to use (a
// no-copyright/royalty-free upload fitting the mood), copy the video id
// from its URL (the part after "watch?v="), and paste it in below.
export const AMBIANCE_TRACKS: Record<SceneMood, string | null> = {
  calm: null, // lobby, quiz rounds
  tense: null, // close calls, trap reveals
  duel: null, // Yrud duels, the Pokémon final battle
  finale: null, // end-of-event summary
};
