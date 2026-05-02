import type { Entity, SceneId, Vec } from "./types";

// Each scene now provides:
//  - a base ground tile (from Field tileset) and an optional decoration layer
//    referencing tiles by [tilesetKey, col, row] — drawn as a parallax-free background
//  - colliders + props (visual sprites) + interactive entities
//
// Field tileset layout (5 cols x 15 rows of 16x16):
//   row index → biome variants. Common picks:
//   - light grass: col 1 row 1
//   - dark grass:  col 2 row 1
//   - sand:        col 0 row 0
//   - dirt path:   col 0 row 9 (approx)
// We just cherry-pick a single tile per biome for the base fill.
//
// Nature tileset (24x21 of 16x16): trees and rocks. We pick decorative sprites
// for trees/rocks/bushes by (col, row) within Nature.

export type TilePick = { ts: string; col: number; row: number };

export type PropKind =
  | "tree"
  | "tree2"
  | "bush"
  | "rock"
  | "rockBig"
  | "torch"
  | "grave"
  | "house"
  | "flower"
  | "stump"
  | "pine";

export interface SceneDef {
  id: SceneId;
  title: string;
  subtitle: string;
  bgFill: string;            // fallback color before tiles paint
  baseTile: TilePick;        // ground tile drawn across the whole map
  vignette?: boolean;
  music?: string;
  size: { w: number; h: number };
  walls: { x: number; y: number; w: number; h: number }[];
  props: { x: number; y: number; w: number; h: number; kind: PropKind }[];
  spawn: Vec;
  entities: () => Entity[];
}

const TILE = 32;

function makeWalls(rects: number[][]) {
  return rects.map(([x, y, w, h]) => ({ x: x * TILE, y: y * TILE, w: w * TILE, h: h * TILE }));
}

let idc = 0;
const eid = () => `e${++idc}`;

// Helper: scatter props deterministically
function scatter(
  count: number,
  kind: PropKind,
  bounds: { x: number; y: number; w: number; h: number },
  size = 32,
  seed = 1,
) {
  const out: { x: number; y: number; w: number; h: number; kind: PropKind }[] = [];
  let s = seed;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  for (let i = 0; i < count; i++) {
    out.push({
      x: bounds.x + Math.floor(rnd() * (bounds.w - size)),
      y: bounds.y + Math.floor(rnd() * (bounds.h - size)),
      w: size, h: size, kind,
    });
  }
  return out;
}

export const SCENES: Record<SceneId, SceneDef> = {
  prologue: {
    id: "prologue",
    title: "Prólogo",
    subtitle: "Eu tinha tudo… mas ainda faltava algo.",
    bgFill: "#08070d",
    baseTile: { ts: "ts_dungeon", col: 4, row: 1 }, // dark stone-ish
    vignette: true,
    size: { w: 30 * TILE, h: 18 * TILE },
    walls: [],
    props: [
      { x: 8 * TILE, y: 6 * TILE, w: 32, h: 32, kind: "torch" },
      { x: 8 * TILE, y: 12 * TILE, w: 32, h: 32, kind: "torch" },
      { x: 22 * TILE, y: 6 * TILE, w: 32, h: 32, kind: "torch" },
      { x: 22 * TILE, y: 12 * TILE, w: 32, h: 32, kind: "torch" },
    ],
    spawn: { x: 4 * TILE, y: 9 * TILE },
    entities: () => [
      {
        id: eid(),
        type: "portal",
        x: 26 * TILE,
        y: 8 * TILE,
        w: 32,
        h: 32,
        target: "village",
        data: { label: "✦ Luz" },
      },
    ],
  },

  village: {
    id: "village",
    title: "Fase 1 — A Vila (O Chamado)",
    subtitle: "Todo mundo vive… mas nem todos despertam.",
    bgFill: "#5b8a3a",
    baseTile: { ts: "ts_field", col: 1, row: 1 }, // light grass
    music: "/peregrino/audio/village.ogg",
    size: { w: 40 * TILE, h: 24 * TILE },
    walls: makeWalls([
      [0, 0, 40, 1],
      [0, 23, 40, 1],
      [0, 0, 1, 24],
      [39, 0, 1, 24],
      [10, 6, 6, 4],
      [22, 8, 5, 3],
      [14, 15, 4, 3],
    ]),
    props: [
      { x: 10 * TILE, y: 6 * TILE, w: 6 * TILE, h: 4 * TILE, kind: "house" },
      { x: 22 * TILE, y: 8 * TILE, w: 5 * TILE, h: 3 * TILE, kind: "house" },
      { x: 14 * TILE, y: 15 * TILE, w: 4 * TILE, h: 3 * TILE, kind: "house" },
      // border trees
      ...scatter(10, "tree", { x: 32, y: 32, w: 38 * TILE, h: 2 * TILE }, 32, 7),
      ...scatter(10, "tree", { x: 32, y: 21 * TILE, w: 38 * TILE, h: 2 * TILE }, 32, 11),
      ...scatter(8, "tree2", { x: 32, y: 96, w: 2 * TILE, h: 18 * TILE }, 32, 23),
      ...scatter(8, "tree2", { x: 36 * TILE, y: 96, w: 2 * TILE, h: 18 * TILE }, 32, 41),
      // decorative
      ...scatter(14, "flower", { x: 3 * TILE, y: 4 * TILE, w: 32 * TILE, h: 16 * TILE }, 16, 5),
      ...scatter(6, "bush", { x: 3 * TILE, y: 4 * TILE, w: 32 * TILE, h: 16 * TILE }, 32, 13),
      { x: 28 * TILE, y: 16 * TILE, w: 32, h: 32, kind: "rockBig" },
      { x: 6 * TILE, y: 18 * TILE, w: 32, h: 32, kind: "stump" },
    ],
    spawn: { x: 4 * TILE, y: 12 * TILE },
    entities: () => [
      {
        id: eid(),
        type: "npc",
        x: 18 * TILE,
        y: 12 * TILE,
        w: 24,
        h: 32,
        dir: "down",
        speaker: "Ancião",
        faceKey: "npc_elder_face",
        dialog: [
          "Você sente, não sente? Há algo dentro de você que não cala.",
          "Há um caminho estreito… poucos o encontram.",
          "Saia pela borda leste. A floresta o aguarda — e nela, suas dúvidas.",
        ],
      },
      {
        id: eid(),
        type: "item",
        x: 26 * TILE,
        y: 14 * TILE,
        w: 16,
        h: 16,
        data: {
          kind: "scroll",
          text: "Pergaminho: 'O caminho começa quando você decide caminhar.'",
        },
      },
      {
        id: eid(),
        type: "pickup",
        x: 8 * TILE,
        y: 18 * TILE,
        w: 16,
        h: 16,
        data: { kind: "heart", amount: 1 },
      },
      {
        id: eid(),
        type: "portal",
        x: 38 * TILE,
        y: 12 * TILE,
        w: 32,
        h: 64,
        target: "forest",
        data: { label: "→ Floresta" },
      },
    ],
  },

  forest: {
    id: "forest",
    title: "Fase 2 — Floresta da Dúvida",
    subtitle: "Você não vai conseguir… volte pra onde é seguro.",
    bgFill: "#22361f",
    baseTile: { ts: "ts_field", col: 2, row: 1 }, // dark grass
    music: "/peregrino/audio/forest.ogg",
    vignette: true,
    size: { w: 40 * TILE, h: 24 * TILE },
    walls: makeWalls([
      [0, 0, 40, 1],
      [0, 23, 40, 1],
      [0, 0, 1, 24],
      [39, 0, 1, 24],
    ]),
    props: [
      ...scatter(60, "pine", { x: 32, y: 32, w: 38 * TILE, h: 22 * TILE }, 32, 3),
      ...scatter(20, "tree2", { x: 32, y: 32, w: 38 * TILE, h: 22 * TILE }, 32, 17),
      ...scatter(15, "bush", { x: 32, y: 32, w: 38 * TILE, h: 22 * TILE }, 32, 29),
      ...scatter(8, "rock", { x: 32, y: 32, w: 38 * TILE, h: 22 * TILE }, 24, 47),
    ],
    spawn: { x: 2 * TILE, y: 12 * TILE },
    entities: () => [
      ...[
        [10, 6], [14, 14], [22, 8], [26, 18], [30, 10],
      ].map(([x, y]) => ({
        id: eid(),
        type: "enemy" as const,
        x: x * TILE, y: y * TILE,
        w: 22, h: 22,
        hp: 3, maxHp: 3, speed: 38,
        dir: "down" as const,
        data: { kind: "spirit" },
      })),
      ...[
        [18, 4], [28, 20],
      ].map(([x, y]) => ({
        id: eid(),
        type: "enemy" as const,
        x: x * TILE, y: y * TILE,
        w: 22, h: 22,
        hp: 2, maxHp: 2, speed: 30,
        dir: "down" as const,
        data: { kind: "slime" },
      })),
      {
        id: eid(),
        type: "pickup",
        x: 20 * TILE, y: 12 * TILE,
        w: 16, h: 16,
        data: { kind: "heart", amount: 2 },
      },
      {
        id: eid(),
        type: "portal",
        x: 38 * TILE, y: 12 * TILE,
        w: 32, h: 64,
        target: "dungeon",
        data: { label: "→ Caverna" },
      },
    ],
  },

  dungeon: {
    id: "dungeon",
    title: "Fase 3 — Caverna do Eu Antigo",
    subtitle: "Quem você pensa que é?",
    bgFill: "#1a141d",
    baseTile: { ts: "ts_dungeon", col: 4, row: 1 },
    music: "/peregrino/audio/dungeon.ogg",
    vignette: true,
    size: { w: 32 * TILE, h: 20 * TILE },
    walls: makeWalls([
      [0, 0, 32, 1],
      [0, 19, 32, 1],
      [0, 0, 1, 20],
      [31, 0, 1, 20],
      [8, 5, 1, 10],
      [20, 5, 1, 10],
    ]),
    props: [
      { x: 4 * TILE, y: 4 * TILE, w: 32, h: 32, kind: "torch" },
      { x: 4 * TILE, y: 16 * TILE, w: 32, h: 32, kind: "torch" },
      { x: 28 * TILE, y: 4 * TILE, w: 32, h: 32, kind: "torch" },
      { x: 28 * TILE, y: 16 * TILE, w: 32, h: 32, kind: "torch" },
      { x: 16 * TILE, y: 10 * TILE, w: 32, h: 32, kind: "grave" },
    ],
    spawn: { x: 2 * TILE, y: 10 * TILE },
    entities: () => [
      ...[
        [10, 6], [12, 14],
      ].map(([x, y]) => ({
        id: eid(),
        type: "enemy" as const,
        x: x * TILE, y: y * TILE,
        w: 22, h: 22,
        hp: 4, maxHp: 4, speed: 50,
        dir: "down" as const,
        data: { kind: "eye" },
      })),
      ...[
        [14, 4], [14, 16],
      ].map(([x, y]) => ({
        id: eid(),
        type: "enemy" as const,
        x: x * TILE, y: y * TILE,
        w: 22, h: 22,
        hp: 3, maxHp: 3, speed: 42,
        dir: "down" as const,
        data: { kind: "skull" },
      })),
      {
        id: eid(),
        type: "pickup",
        x: 16 * TILE, y: 12 * TILE,
        w: 16, h: 16,
        data: { kind: "heart", amount: 2 },
      },
      {
        id: eid(),
        type: "boss",
        x: 26 * TILE, y: 10 * TILE,
        w: 44, h: 44,
        hp: 18, maxHp: 18, speed: 38,
        dir: "left" as const,
        data: { kind: "cyclop" },
      },
    ],
  },

  ending: {
    id: "ending",
    title: "Final — Transformação",
    subtitle: "O caminho nunca foi sobre chegar… mas sobre se tornar.",
    bgFill: "#f4e9c8",
    baseTile: { ts: "ts_field", col: 0, row: 0 }, // sandy
    size: { w: 30 * TILE, h: 18 * TILE },
    walls: [],
    props: [
      ...scatter(20, "flower", { x: 2 * TILE, y: 2 * TILE, w: 26 * TILE, h: 14 * TILE }, 16, 91),
    ],
    spawn: { x: 14 * TILE, y: 9 * TILE },
    entities: () => [],
  },
};
