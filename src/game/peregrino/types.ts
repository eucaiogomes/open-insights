export type Dir = "down" | "left" | "right" | "up";
export type SceneId = "prologue" | "village" | "forest" | "dungeon" | "ending";

export interface Vec { x: number; y: number; }
export interface Rect extends Vec { w: number; h: number; }

export type EntityType = "enemy" | "boss" | "npc" | "item" | "portal" | "pickup" | "chest";

export interface Entity extends Rect {
  id: string;
  type: EntityType;
  hp?: number;
  maxHp?: number;
  dir?: Dir;
  speed?: number;
  cooldown?: number;
  hurtTimer?: number;
  data?: Record<string, unknown>;
  dialog?: string[];
  speaker?: string;
  faceKey?: string;
  target?: SceneId;
  spawnAt?: Vec;
}
