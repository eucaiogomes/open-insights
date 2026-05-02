// Asset registry for O Peregrino.
const base = "/peregrino";

export const ASSETS = {
  player: {
    idle: `${base}/player/idle.png`,     // 64x16  -> 4 dirs (down,up,left,right) x 1 frame (16x16)
    walk: `${base}/player/walk.png`,     // 64x64  -> 4 dirs x 4 frames
    attack: `${base}/player/attack.png`, // 64x16  -> 4 dirs x 1 frame
    face: `${base}/player/face.png`,
  },
  npc: {
    elder: `${base}/npc/elder.png`,         // 64x112 sprite sheet (Monk format)
    elderFace: `${base}/npc/elder_face.png`,
  },
  monsters: {
    slime: `${base}/monsters/slime.png`,   // 64x64 sheet
    eye: `${base}/monsters/eye.png`,
    skull: `${base}/monsters/skull.png`,
    spirit: `${base}/monsters/spirit.png`,
    beast: `${base}/monsters/beast.png`,
  },
  boss: {
    walk: `${base}/boss/cyclop_walk.png`, // 300x50 -> 6 frames of 50x50
    idle: `${base}/boss/cyclop_idle.png`, // 250x50 -> 5 frames
    hit: `${base}/boss/cyclop_hit.png`,   // 150x50 -> 3 frames
  },
  tilesets: {
    field: `${base}/tilesets/field.png`,     // 80x240
    nature: `${base}/tilesets/nature.png`,   // 384x336
    dungeon: `${base}/tilesets/dungeon.png`, // 192x64
    house: `${base}/tilesets/house.png`,
    floor: `${base}/tilesets/floor.png`,
    water: `${base}/tilesets/water.png`,
  },
  fx: {
    slash: `${base}/fx/slash.png`,   // 130x32 -> ~4 frames of ~32px
    spark: `${base}/fx/spark.png`,
    leaf: `${base}/fx/leaf.png`,
    fire: `${base}/fx/fire.png`,
  },
  items: {
    heart: `${base}/items/heart_pickup.png`,
    chest: `${base}/items/chest.png`,
    scroll: `${base}/items/scroll.png`,
    coin: `${base}/items/coin.png`,
  },
  ui: {
    heart: `${base}/ui/heart.png`,
    dialog: `${base}/ui/dialog.png`,
    facesetBox: `${base}/ui/faceset_box.png`,
  },
  audio: {
    slash: `${base}/audio/slash.wav`,
    hit: `${base}/audio/hit.wav`,
    village: `${base}/audio/village.ogg`,
    forest: `${base}/audio/forest.ogg`,
    dungeon: `${base}/audio/dungeon.ogg`,
  },
} as const;

export type ImageMap = Record<string, HTMLImageElement>;

const IMG_LIST: [string, string][] = [
  ["player_idle", ASSETS.player.idle],
  ["player_walk", ASSETS.player.walk],
  ["player_attack", ASSETS.player.attack],
  ["player_face", ASSETS.player.face],
  ["npc_elder", ASSETS.npc.elder],
  ["npc_elder_face", ASSETS.npc.elderFace],
  ["mon_slime", ASSETS.monsters.slime],
  ["mon_eye", ASSETS.monsters.eye],
  ["mon_skull", ASSETS.monsters.skull],
  ["mon_spirit", ASSETS.monsters.spirit],
  ["mon_beast", ASSETS.monsters.beast],
  ["boss_walk", ASSETS.boss.walk],
  ["boss_idle", ASSETS.boss.idle],
  ["boss_hit", ASSETS.boss.hit],
  ["ts_field", ASSETS.tilesets.field],
  ["ts_nature", ASSETS.tilesets.nature],
  ["ts_dungeon", ASSETS.tilesets.dungeon],
  ["ts_house", ASSETS.tilesets.house],
  ["ts_floor", ASSETS.tilesets.floor],
  ["ts_water", ASSETS.tilesets.water],
  ["fx_slash", ASSETS.fx.slash],
  ["fx_spark", ASSETS.fx.spark],
  ["fx_leaf", ASSETS.fx.leaf],
  ["fx_fire", ASSETS.fx.fire],
  ["it_heart", ASSETS.items.heart],
  ["it_chest", ASSETS.items.chest],
  ["it_scroll", ASSETS.items.scroll],
  ["it_coin", ASSETS.items.coin],
  ["ui_heart", ASSETS.ui.heart],
  ["ui_dialog", ASSETS.ui.dialog],
  ["ui_faceset_box", ASSETS.ui.facesetBox],
];

export async function loadAllImages(): Promise<ImageMap> {
  const map: ImageMap = {};
  await Promise.all(
    IMG_LIST.map(
      ([k, src]) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => { map[k] = img; resolve(); };
          // Don't hard-fail the whole game if a single asset is missing; just skip it.
          img.onerror = () => { console.warn("[peregrino] missing asset:", src); resolve(); };
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
