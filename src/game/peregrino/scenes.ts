import type { Entity, SceneId, Vec } from "./types";

export interface SceneDef {
  id: SceneId;
  title: string;
  subtitle: string;
  bg: string; // base ground color
  accent: string; // tint for props
  music?: string;
  size: { w: number; h: number };
  walls: { x: number; y: number; w: number; h: number }[]; // collision rects
  props: { x: number; y: number; w: number; h: number; kind: "tree" | "rock" | "grave" | "torch" | "house" }[];
  spawn: Vec;
  entities: () => Entity[];
}

const TILE = 32;

function makeWalls(rects: number[][]) {
  return rects.map(([x, y, w, h]) => ({ x: x * TILE, y: y * TILE, w: w * TILE, h: h * TILE }));
}

let idc = 0;
const eid = () => `e${++idc}`;

export const SCENES: Record<SceneId, SceneDef> = {
  prologue: {
    id: "prologue",
    title: "Prólogo",
    subtitle: "Eu tinha tudo… mas ainda faltava algo.",
    bg: "#0a0a10",
    accent: "#1a1a2a",
    size: { w: 30 * TILE, h: 18 * TILE },
    walls: [],
    props: [],
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
        data: { label: "Luz" },
      },
    ],
  },

  village: {
    id: "village",
    title: "Fase 1 — A Vila (O Chamado)",
    subtitle: "Todo mundo vive… mas nem todos despertam.",
    bg: "#5b8a3a",
    accent: "#3d6326",
    music: "/peregrino/audio/village.ogg",
    size: { w: 40 * TILE, h: 24 * TILE },
    walls: makeWalls([
      [0, 0, 40, 1],
      [0, 23, 40, 1],
      [0, 0, 1, 24],
      [39, 0, 1, 24],
      [10, 6, 6, 4], // house 1
      [22, 8, 5, 3], // house 2
      [14, 15, 4, 3], // house 3
    ]),
    props: [
      { x: 10 * TILE, y: 6 * TILE, w: 6 * TILE, h: 4 * TILE, kind: "house" },
      { x: 22 * TILE, y: 8 * TILE, w: 5 * TILE, h: 3 * TILE, kind: "house" },
      { x: 14 * TILE, y: 15 * TILE, w: 4 * TILE, h: 3 * TILE, kind: "house" },
      { x: 4 * TILE, y: 4 * TILE, w: 32, h: 32, kind: "tree" },
      { x: 6 * TILE, y: 18 * TILE, w: 32, h: 32, kind: "tree" },
      { x: 30 * TILE, y: 4 * TILE, w: 32, h: 32, kind: "tree" },
      { x: 32 * TILE, y: 18 * TILE, w: 32, h: 32, kind: "tree" },
      { x: 20 * TILE, y: 20 * TILE, w: 24, h: 24, kind: "rock" },
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
        dialog: [
          "Ancião: Você sente, não sente?",
          "Ancião: Há um caminho estreito… poucos o encontram.",
          "Ancião: Saia pela borda leste. A floresta o aguarda.",
        ],
      },
      {
        id: eid(),
        type: "item",
        x: 26 * TILE,
        y: 14 * TILE,
        w: 20,
        h: 20,
        data: { kind: "scroll", text: "Pergaminho: 'O caminho começa quando você decide caminhar.'" },
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
    bg: "#22361f",
    accent: "#0f1d0c",
    music: "/peregrino/audio/forest.ogg",
    size: { w: 40 * TILE, h: 24 * TILE },
    walls: makeWalls([
      [0, 0, 40, 1],
      [0, 23, 40, 1],
      [0, 0, 1, 24],
      [39, 0, 1, 24],
    ]),
    props: Array.from({ length: 40 }, (_, i) => ({
      x: ((i * 137) % 38) * TILE + TILE,
      y: ((i * 211) % 22) * TILE + TILE,
      w: 32,
      h: 32,
      kind: "tree" as const,
    })),
    spawn: { x: 2 * TILE, y: 12 * TILE },
    entities: () => [
      ...[
        [10, 6],
        [14, 14],
        [22, 8],
        [26, 18],
        [30, 10],
      ].map(([x, y]) => ({
        id: eid(),
        type: "enemy" as const,
        x: x * TILE,
        y: y * TILE,
        w: 24,
        h: 24,
        hp: 3,
        maxHp: 3,
        speed: 40,
        data: { kind: "shadow" },
      })),
      {
        id: eid(),
        type: "portal",
        x: 38 * TILE,
        y: 12 * TILE,
        w: 32,
        h: 64,
        target: "dungeon",
        data: { label: "→ Dungeon" },
      },
    ],
  },

  dungeon: {
    id: "dungeon",
    title: "Fase 3 — Caverna do Eu Antigo",
    subtitle: "Quem você pensa que é?",
    bg: "#2a232b",
    accent: "#15101a",
    music: "/peregrino/audio/dungeon.ogg",
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
      { x: 4 * TILE, y: 4 * TILE, w: 24, h: 24, kind: "torch" },
      { x: 4 * TILE, y: 16 * TILE, w: 24, h: 24, kind: "torch" },
      { x: 28 * TILE, y: 4 * TILE, w: 24, h: 24, kind: "torch" },
      { x: 28 * TILE, y: 16 * TILE, w: 24, h: 24, kind: "torch" },
      { x: 16 * TILE, y: 10 * TILE, w: 24, h: 24, kind: "grave" },
    ],
    spawn: { x: 2 * TILE, y: 10 * TILE },
    entities: () => [
      ...[
        [10, 6],
        [12, 14],
      ].map(([x, y]) => ({
        id: eid(),
        type: "enemy" as const,
        x: x * TILE,
        y: y * TILE,
        w: 24,
        h: 24,
        hp: 4,
        maxHp: 4,
        speed: 50,
        data: { kind: "eye" },
      })),
      {
        id: eid(),
        type: "boss",
        x: 26 * TILE,
        y: 10 * TILE,
        w: 48,
        h: 48,
        hp: 18,
        maxHp: 18,
        speed: 35,
        data: { kind: "cyclop" },
      },
    ],
  },

  ending: {
    id: "ending",
    title: "Final — Transformação",
    subtitle: "O caminho nunca foi sobre chegar… mas sobre se tornar.",
    bg: "#f4e9c8",
    accent: "#d8c48a",
    size: { w: 30 * TILE, h: 18 * TILE },
    walls: [],
    props: [],
    spawn: { x: 14 * TILE, y: 9 * TILE },
    entities: () => [],
  },
};
