// Asset loader for the Ninja Adventure pack pieces we use.
const base = "/peregrino";

export const ASSETS = {
  player: {
    idle: `${base}/player/idle.png`,
    walk: `${base}/player/walk.png`,
    attack: `${base}/player/attack.png`,
  },
  npc: { elder: `${base}/npc/elder.png` },
  monsters: {
    beast: `${base}/monsters/beast.png`,
    eye: `${base}/monsters/eye.png`,
  },
  boss: {
    walk: `${base}/boss/cyclop_walk.png`,
    idle: `${base}/boss/cyclop_idle.png`,
    hit: `${base}/boss/cyclop_hit.png`,
  },
  ui: { heart: `${base}/ui/heart.png` },
  audio: {
    slash: `${base}/audio/slash.wav`,
    hit: `${base}/audio/hit.wav`,
    village: `${base}/audio/village.ogg`,
    forest: `${base}/audio/forest.ogg`,
    dungeon: `${base}/audio/dungeon.ogg`,
  },
} as const;

export type ImageMap = Record<string, HTMLImageElement>;

export async function loadAllImages(): Promise<ImageMap> {
  const entries: [string, string][] = [
    ["player_idle", ASSETS.player.idle],
    ["player_walk", ASSETS.player.walk],
    ["player_attack", ASSETS.player.attack],
    ["npc_elder", ASSETS.npc.elder],
    ["mon_beast", ASSETS.monsters.beast],
    ["mon_eye", ASSETS.monsters.eye],
    ["boss_walk", ASSETS.boss.walk],
    ["boss_idle", ASSETS.boss.idle],
    ["boss_hit", ASSETS.boss.hit],
    ["ui_heart", ASSETS.ui.heart],
  ];
  const map: ImageMap = {};
  await Promise.all(
    entries.map(
      ([k, src]) =>
        new Promise<void>((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            map[k] = img;
            resolve();
          };
          img.onerror = () => reject(new Error(`Failed to load ${src}`));
          img.src = src;
        }),
    ),
  );
  return map;
}

export function playSound(src: string, volume = 0.6) {
  try {
    const a = new Audio(src);
    a.volume = volume;
    void a.play();
  } catch {
    // ignore
  }
}
