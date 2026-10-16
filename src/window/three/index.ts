/** The 3D rooms, loaded on demand so the 2D rooms don't carry three.js. */
import { japaneseRoom } from "./japanese-room";
import { listeningRoom } from "./listening-room";
import { mediterranean } from "./mediterranean";
import { nordicCabin } from "./nordic-cabin";
import type { Design } from "./room3d";

export { Room3D } from "./room3d";
export const DESIGNS: Record<string, Design> = {
  listening: listeningRoom,
  cabin: nordicCabin,
  japanese: japaneseRoom,
  mediterranean,
};
