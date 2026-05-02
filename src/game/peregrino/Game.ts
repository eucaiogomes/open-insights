import type { ImageMap } from "./assets";
import { playSound, ASSETS } from "./assets";
import { SCENES, type SceneDef, type PropKind } from "./scenes";
import type { Dir, Entity, SceneId } from "./types";

const TILE = 32;
const PLAYER_SIZE = 22;
const PLAYER_SPEED = 115;
const VIEW_W = 480;
const VIEW_H = 320;
const SCALE = 2;

const dirRow: Record<Dir, number> = { down: 0, up: 1, left: 2, right: 3 };

interface Player {
  x: number; y: number; w: number; h: number;
  dir: Dir;
  hp: number; maxHp: number;
  moving: boolean;
  attackT: number;
  invuln: number;
  abilities: { determinacao: boolean; discernimento: boolean; graca: boolean };
}

interface Slash { x: number; y: number; w: number; h: number; life: number; maxLife: number; dmg: number; dir: Dir; }
interface FloatText { x: number; y: number; t: number; text: string; color: string }
interface Particle { x: number; y: number; vx: number; vy: number; t: number; life: number; color: string; size: number; }

export interface GameCallbacks {
  onHpChange: (hp: number, max: number) => void;
  onScene: (s: SceneId, def: SceneDef) => void;
  onDialog: (lines: string[] | null, speaker?: string, faceKey?: string) => void;
  onToast: (msg: string) => void;
  onWin: () => void;
  onGameOver: () => void;
}

function rectsOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// Monster sprite layout: 64x64 sheet -> 4 cols x 4 rows of 16x16
// rows: 0=down, 1=up, 2=left, 3=right (matches Ninja Adventure pack convention)
const MON_TILE = 16;

interface MonsterDef {
  imgKey: string;
}
const MONSTERS: Record<string, MonsterDef> = {
  slime:  { imgKey: "mon_slime" },
  eye:    { imgKey: "mon_eye" },
  skull:  { imgKey: "mon_skull" },
  spirit: { imgKey: "mon_spirit" },
  beast:  { imgKey: "mon_beast" },
};

export class Game {
  ctx: CanvasRenderingContext2D;
  images: ImageMap;
  cb: GameCallbacks;
  scene!: SceneDef;
  entities: Entity[] = [];
  player: Player;
  keys = new Set<string>();
  slashes: Slash[] = [];
  floats: FloatText[] = [];
  particles: Particle[] = [];
  raf = 0;
  last = 0;
  running = true;
  music?: HTMLAudioElement;
  dialogActive = false;
  attackCd = 0;
  animT = 0;
  defeatedBoss = false;
  // Cached pre-rendered ground per scene id
  private groundCache: Record<string, HTMLCanvasElement> = {};

  constructor(canvas: HTMLCanvasElement, images: ImageMap, cb: GameCallbacks) {
    this.ctx = canvas.getContext("2d")!;
    this.ctx.imageSmoothingEnabled = false;
    this.images = images;
    this.cb = cb;
    this.player = {
      x: 0, y: 0, w: PLAYER_SIZE, h: PLAYER_SIZE,
      dir: "down", hp: 6, maxHp: 6, moving: false,
      attackT: 0, invuln: 0,
      abilities: { determinacao: false, discernimento: false, graca: false },
    };
    canvas.width = VIEW_W * SCALE;
    canvas.height = VIEW_H * SCALE;
    canvas.style.width = `${VIEW_W * SCALE}px`;
    canvas.style.height = `${VIEW_H * SCALE}px`;
    this.ctx.scale(SCALE, SCALE);
    this.loadScene("prologue");
  }

  start() {
    this.last = performance.now();
    const tick = (t: number) => {
      const dt = Math.min(0.05, (t - this.last) / 1000);
      this.last = t;
      if (this.running) {
        this.update(dt);
        this.draw();
      }
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.music?.pause();
  }

  loadScene(id: SceneId) {
    this.scene = SCENES[id];
    this.entities = this.scene.entities();
    this.player.x = this.scene.spawn.x;
    this.player.y = this.scene.spawn.y;
    this.slashes = [];
    this.floats = [];
    this.particles = [];
    this.cb.onScene(id, this.scene);
    this.cb.onDialog(null);
    this.dialogActive = false;
    if (this.music) { this.music.pause(); this.music = undefined; }
    if (this.scene.music) {
      try {
        const a = new Audio(this.scene.music);
        a.loop = true; a.volume = 0.22;
        void a.play().catch(() => {});
        this.music = a;
      } catch { /* ignore */ }
    }
    if (id === "ending") {
      setTimeout(() => this.cb.onWin(), 2400);
    }
  }

  setKey(code: string, down: boolean) {
    if (down) this.keys.add(code); else this.keys.delete(code);
  }

  interact() {
    if (this.dialogActive) { this.cb.onDialog(null); this.dialogActive = false; return; }
    const reach = { x: this.player.x - 12, y: this.player.y - 12, w: this.player.w + 24, h: this.player.h + 24 };
    for (const e of this.entities) {
      if ((e.type === "npc" || e.type === "item" || e.type === "portal") && rectsOverlap(reach, e)) {
        if (e.type === "npc" && e.dialog) {
          this.cb.onDialog(e.dialog, e.speaker, e.faceKey);
          this.dialogActive = true;
          return;
        }
        if (e.type === "item") {
          const d = e.data as { kind: string; text?: string };
          this.cb.onToast(d.text ?? "Item coletado");
          this.spawnSparkles(e.x + e.w / 2, e.y + e.h / 2, "#ffec8a");
          this.entities = this.entities.filter(x => x.id !== e.id);
          return;
        }
        if (e.type === "portal" && e.target) {
          this.loadScene(e.target);
          return;
        }
      }
    }
  }

  attack() {
    if (this.attackCd > 0 || this.dialogActive) return;
    this.attackCd = 0.32;
    this.player.attackT = 0.22;
    playSound(ASSETS.audio.slash, 0.35);
    const reach = 24;
    const p = this.player;
    let r: Slash;
    const dmg = this.player.abilities.determinacao ? 2 : 1;
    const life = 0.18;
    if (p.dir === "down")  r = { x: p.x - 6, y: p.y + p.h - 2, w: p.w + 12, h: reach, life, maxLife: life, dmg, dir: p.dir };
    else if (p.dir === "up") r = { x: p.x - 6, y: p.y - reach + 2, w: p.w + 12, h: reach, life, maxLife: life, dmg, dir: p.dir };
    else if (p.dir === "left") r = { x: p.x - reach + 2, y: p.y - 6, w: reach, h: p.h + 12, life, maxLife: life, dmg, dir: p.dir };
    else r = { x: p.x + p.w - 2, y: p.y - 6, w: reach, h: p.h + 12, life, maxLife: life, dmg, dir: p.dir };
    this.slashes.push(r);
  }

  collidesWalls(r: { x: number; y: number; w: number; h: number }) {
    for (const w of this.scene.walls) if (rectsOverlap(r, w)) return true;
    return false;
  }

  spawnSparkles(x: number, y: number, color: string, n = 8) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 30 + Math.random() * 40;
      this.particles.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20,
        t: 0, life: 0.5 + Math.random() * 0.3, color, size: 2,
      });
    }
  }

  spawnHitFx(x: number, y: number) {
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 40 + Math.random() * 40;
      this.particles.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        t: 0, life: 0.35, color: "#ff5544", size: 2,
      });
    }
  }

  pickup(e: Entity) {
    const d = e.data as { kind: string; amount?: number };
    if (d.kind === "heart") {
      const amt = d.amount ?? 1;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + amt);
      this.cb.onHpChange(this.player.hp, this.player.maxHp);
      this.cb.onToast(`+${amt} ♥`);
      this.spawnSparkles(e.x + e.w / 2, e.y + e.h / 2, "#ff7799");
    }
    this.entities = this.entities.filter(x => x.id !== e.id);
  }

  update(dt: number) {
    this.animT += dt;
    if (this.attackCd > 0) this.attackCd -= dt;
    if (this.player.attackT > 0) this.player.attackT -= dt;
    if (this.player.invuln > 0) this.player.invuln -= dt;

    if (this.player.abilities.graca && this.player.hp < this.player.maxHp) {
      const me = this as unknown as { _grace?: number };
      const next = (me._grace ?? 0) + dt;
      if (next > 4) {
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + 1);
        this.cb.onHpChange(this.player.hp, this.player.maxHp);
        me._grace = 0;
      } else me._grace = next;
    }

    // input
    if (!this.dialogActive) {
      let dx = 0, dy = 0;
      if (this.keys.has("ArrowUp") || this.keys.has("KeyW")) dy -= 1;
      if (this.keys.has("ArrowDown") || this.keys.has("KeyS")) dy += 1;
      if (this.keys.has("ArrowLeft") || this.keys.has("KeyA")) dx -= 1;
      if (this.keys.has("ArrowRight") || this.keys.has("KeyD")) dx += 1;
      this.player.moving = dx !== 0 || dy !== 0;
      if (this.player.moving) {
        if (Math.abs(dx) > Math.abs(dy)) this.player.dir = dx < 0 ? "left" : "right";
        else this.player.dir = dy < 0 ? "up" : "down";
        const len = Math.hypot(dx, dy) || 1;
        const nx = this.player.x + (dx / len) * PLAYER_SPEED * dt;
        const ny = this.player.y + (dy / len) * PLAYER_SPEED * dt;
        const tryX = { x: nx, y: this.player.y, w: this.player.w, h: this.player.h };
        if (!this.collidesWalls(tryX)) this.player.x = Math.max(0, Math.min(this.scene.size.w - this.player.w, nx));
        const tryY = { x: this.player.x, y: ny, w: this.player.w, h: this.player.h };
        if (!this.collidesWalls(tryY)) this.player.y = Math.max(0, Math.min(this.scene.size.h - this.player.h, ny));
      }
    }

    for (const s of this.slashes) s.life -= dt;
    this.slashes = this.slashes.filter(s => s.life > 0);

    // damage to enemies/boss
    for (const e of this.entities) {
      if (e.type !== "enemy" && e.type !== "boss") continue;
      if (e.hurtTimer && e.hurtTimer > 0) e.hurtTimer -= dt;
      for (const s of this.slashes) {
        if (rectsOverlap(s, e) && (!e.hurtTimer || e.hurtTimer <= 0)) {
          e.hp = (e.hp ?? 1) - s.dmg;
          e.hurtTimer = 0.25;
          this.floats.push({ x: e.x + e.w / 2, y: e.y, t: 0.6, text: `-${s.dmg}`, color: "#ffec8a" });
          this.spawnHitFx(e.x + e.w / 2, e.y + e.h / 2);
          playSound(ASSETS.audio.hit, 0.3);
          // knockback enemy
          const k = e.type === "boss" ? 4 : 10;
          if (s.dir === "down") e.y += k;
          else if (s.dir === "up") e.y -= k;
          else if (s.dir === "left") e.x -= k;
          else e.x += k;
        }
      }
    }

    // pickups (auto on touch)
    for (const e of this.entities) {
      if (e.type === "pickup" && rectsOverlap(this.player, e)) this.pickup(e);
    }

    // remove dead enemies
    const before = this.entities.length;
    this.entities = this.entities.filter(e => {
      if ((e.type === "enemy" || e.type === "boss") && (e.hp ?? 1) <= 0) {
        // drop chance: heart
        if (e.type === "enemy" && Math.random() < 0.3) {
          this.entities.push({
            id: `drop${Math.random()}`,
            type: "pickup",
            x: e.x, y: e.y, w: 16, h: 16,
            data: { kind: "heart", amount: 1 },
          });
        }
        this.spawnSparkles(e.x + e.w / 2, e.y + e.h / 2, e.type === "boss" ? "#ffd86b" : "#ffffff", e.type === "boss" ? 24 : 8);
        if (e.type === "boss") {
          this.defeatedBoss = true;
          this.player.abilities.determinacao = true;
          this.cb.onToast("✨ Habilidade adquirida: Determinação");
          setTimeout(() => this.loadScene("ending"), 1400);
        }
        return false;
      }
      return true;
    });
    void before;

    // enemies AI
    for (const e of this.entities) {
      if (e.type !== "enemy" && e.type !== "boss") continue;
      const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
      const px = this.player.x + this.player.w / 2, py = this.player.y + this.player.h / 2;
      const dx = px - cx, dy = py - cy;
      const dist = Math.hypot(dx, dy);
      const sight = e.type === "boss" ? 600 : 220;
      if (dist < sight && dist > 4) {
        const sp = (e.speed ?? 30) * dt;
        const nx = e.x + (dx / dist) * sp;
        const ny = e.y + (dy / dist) * sp;
        const tryX = { x: nx, y: e.y, w: e.w, h: e.h };
        if (!this.collidesWalls(tryX)) e.x = nx;
        const tryY = { x: e.x, y: ny, w: e.w, h: e.h };
        if (!this.collidesWalls(tryY)) e.y = ny;
        // facing
        if (Math.abs(dx) > Math.abs(dy)) e.dir = dx < 0 ? "left" : "right";
        else e.dir = dy < 0 ? "up" : "down";
      }
      if (this.player.invuln <= 0 && rectsOverlap(this.player, e)) {
        const d = e.type === "boss" ? 2 : 1;
        this.player.hp -= d;
        this.player.invuln = 0.8;
        this.cb.onHpChange(this.player.hp, this.player.maxHp);
        playSound(ASSETS.audio.hit, 0.45);
        const k = 16;
        if (dist > 0) {
          this.player.x -= (dx / dist) * k;
          this.player.y -= (dy / dist) * k;
        }
        if (this.player.hp <= 0) {
          this.running = false;
          this.cb.onGameOver();
        }
      }
    }

    for (const f of this.floats) { f.t -= dt; f.y -= 18 * dt; }
    this.floats = this.floats.filter(f => f.t > 0);

    for (const p of this.particles) {
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 80 * dt;
    }
    this.particles = this.particles.filter(p => p.t < p.life);
  }

  // ---------- Drawing ----------
  draw() {
    const c = this.ctx;
    c.fillStyle = this.scene.bgFill;
    c.fillRect(0, 0, VIEW_W, VIEW_H);

    const camX = Math.max(0, Math.min(this.scene.size.w - VIEW_W, this.player.x + this.player.w / 2 - VIEW_W / 2));
    const camY = Math.max(0, Math.min(this.scene.size.h - VIEW_H, this.player.y + this.player.h / 2 - VIEW_H / 2));

    c.save();
    c.translate(-Math.floor(camX), -Math.floor(camY));
    this.drawGround();

    // y-sort props + entities + player
    const drawables: { y: number; fn: () => void }[] = [];
    for (const p of this.scene.props) drawables.push({ y: p.y + p.h, fn: () => this.drawProp(p) });
    for (const e of this.entities) drawables.push({ y: e.y + e.h, fn: () => this.drawEntity(e) });
    drawables.push({ y: this.player.y + this.player.h, fn: () => this.drawPlayer() });
    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) d.fn();

    this.drawSlashes();

    // particles
    for (const p of this.particles) {
      const a = 1 - p.t / p.life;
      c.fillStyle = p.color;
      c.globalAlpha = Math.max(0, a);
      c.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    c.globalAlpha = 1;

    c.font = "10px monospace";
    for (const f of this.floats) {
      c.fillStyle = "rgba(0,0,0,0.6)";
      c.fillText(f.text, f.x - 5, f.y + 1);
      c.fillStyle = f.color;
      c.fillText(f.text, f.x - 6, f.y);
    }
    c.restore();

    if (this.scene.vignette) {
      const g = c.createRadialGradient(VIEW_W / 2, VIEW_H / 2, 60, VIEW_W / 2, VIEW_H / 2, 280);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, "rgba(0,0,0,0.7)");
      c.fillStyle = g;
      c.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  }

  drawGround() {
    const id = this.scene.id;
    let cache = this.groundCache[id];
    if (!cache) {
      cache = document.createElement("canvas");
      cache.width = this.scene.size.w;
      cache.height = this.scene.size.h;
      const cc = cache.getContext("2d")!;
      cc.imageSmoothingEnabled = false;
      const ts = this.images[this.scene.baseTile.ts];
      if (ts) {
        const sx = this.scene.baseTile.col * 16;
        const sy = this.scene.baseTile.row * 16;
        for (let y = 0; y < this.scene.size.h; y += 16) {
          for (let x = 0; x < this.scene.size.w; x += 16) {
            cc.drawImage(ts, sx, sy, 16, 16, x, y, 16, 16);
          }
        }
      } else {
        cc.fillStyle = this.scene.bgFill;
        cc.fillRect(0, 0, cache.width, cache.height);
      }
      // Per-scene path overlay
      if (id === "village") {
        // dirt path along y=12
        const path = this.images["ts_field"];
        if (path) {
          const px = 0 * 16, py = 9 * 16; // approximate dirt tile
          for (let x = 0; x < this.scene.size.w; x += 16) {
            cc.drawImage(path, px, py, 16, 16, x, 12 * TILE, 16, 16);
            cc.drawImage(path, px, py, 16, 16, x, 12 * TILE + 16, 16, 16);
          }
        } else {
          cc.fillStyle = "#caa56a";
          cc.fillRect(0, 12 * TILE, this.scene.size.w, TILE);
        }
      }
      this.groundCache[id] = cache;
    }
    this.ctx.drawImage(cache, 0, 0);
  }

  // Pick a sprite from the Nature tileset by (col, row).
  natureSprite(col: number, row: number, w = 32, h = 32) {
    return { img: this.images.ts_nature, sx: col * 16, sy: row * 16, sw: 16, sh: 16, dw: w, dh: h };
  }

  drawProp(p: { x: number; y: number; w: number; h: number; kind: PropKind }) {
    const c = this.ctx;
    const nature = this.images.ts_nature;
    if (!nature) {
      // fallback
      c.fillStyle = "#3a5a2a";
      c.fillRect(p.x, p.y, p.w, p.h);
      return;
    }

    const pickFromNature = (col: number, row: number, sw = 16, sh = 16, dw = 32, dh = 32) => {
      c.drawImage(nature, col * 16, row * 16, sw, sh, p.x, p.y, dw, dh);
    };

    switch (p.kind) {
      case "tree":
        // 32x32 tree
        c.drawImage(nature, 0 * 16, 1 * 16, 32, 32, p.x, p.y - 8, 32, 40);
        return;
      case "tree2":
        c.drawImage(nature, 4 * 16, 1 * 16, 32, 32, p.x, p.y - 8, 32, 40);
        return;
      case "pine":
        c.drawImage(nature, 16 * 16, 1 * 16, 32, 32, p.x, p.y - 8, 32, 40);
        return;
      case "bush":
        pickFromNature(8, 1, 32, 16, 32, 16);
        return;
      case "rock":
        pickFromNature(20, 7, 16, 16, 24, 24);
        return;
      case "rockBig":
        c.drawImage(nature, 20 * 16, 8 * 16, 32, 32, p.x, p.y, 32, 32);
        return;
      case "flower":
        // tiny decoration
        pickFromNature(12, 11, 16, 16, 16, 16);
        return;
      case "stump":
        pickFromNature(13, 16, 16, 16, 24, 24);
        return;
      case "grave":
        c.fillStyle = "#aaa";
        c.fillRect(p.x + 6, p.y + 4, p.w - 12, p.h - 4);
        c.fillStyle = "#777";
        c.fillRect(p.x + 6, p.y + 4, p.w - 12, 4);
        return;
      case "torch": {
        c.fillStyle = "#3a2a1a";
        c.fillRect(p.x + 12, p.y + 12, 8, 18);
        const flick = 5 + Math.sin(this.animT * 8 + p.x) * 1.5;
        c.fillStyle = "#ffae3a";
        c.beginPath(); c.arc(p.x + 16, p.y + 8, flick, 0, Math.PI * 2); c.fill();
        c.fillStyle = "#fff2a6";
        c.beginPath(); c.arc(p.x + 16, p.y + 8, flick * 0.5, 0, Math.PI * 2); c.fill();
        return;
      }
      case "house": {
        // Body
        c.fillStyle = "#8a5a32";
        c.fillRect(p.x, p.y + 16, p.w, p.h - 16);
        // Roof
        c.fillStyle = "#5a2a18";
        c.beginPath();
        c.moveTo(p.x - 4, p.y + 22);
        c.lineTo(p.x + p.w / 2, p.y);
        c.lineTo(p.x + p.w + 4, p.y + 22);
        c.closePath();
        c.fill();
        // Door
        c.fillStyle = "#3a1f10";
        c.fillRect(p.x + p.w / 2 - 8, p.y + p.h - 22, 16, 22);
        c.fillStyle = "#ffce5b";
        c.fillRect(p.x + p.w / 2 - 6, p.y + p.h - 20, 12, 18);
        // Window
        c.fillStyle = "#3a2010";
        c.fillRect(p.x + 8, p.y + 24, 14, 12);
        c.fillStyle = "#a8d8ff";
        c.fillRect(p.x + 10, p.y + 26, 10, 8);
        return;
      }
    }
  }

  drawPlayer() {
    const c = this.ctx;
    const p = this.player;
    const row = dirRow[p.dir];
    let img: HTMLImageElement | undefined;
    let sx = 0, sy = 0;
    const fs = 16;

    if (p.attackT > 0 && this.images.player_attack) {
      img = this.images.player_attack; // 64x16 = 4 dirs single frame
      sx = row * fs; sy = 0;
    } else if (p.moving && this.images.player_walk) {
      img = this.images.player_walk; // 64x64 = 4 frames x 4 dirs
      const frame = Math.floor((this.animT * 8) % 4);
      sx = frame * fs; sy = row * fs;
    } else if (this.images.player_idle) {
      img = this.images.player_idle;
      sx = row * fs; sy = 0;
    }

    const flicker = p.invuln > 0 && Math.floor(this.animT * 20) % 2 === 0;
    if (img && !flicker) {
      const dw = 28, dh = 28;
      c.drawImage(img, sx, sy, fs, fs, p.x - 3, p.y - 6, dw, dh);
    } else if (!img) {
      c.fillStyle = "#ffd86b";
      c.fillRect(p.x, p.y, p.w, p.h);
    }
  }

  drawEntity(e: Entity) {
    const c = this.ctx;
    if (e.type === "npc") {
      // Elder uses 64x112 sheet: row 0 col 0 = idle down 16x16
      const img = this.images.npc_elder;
      if (img) c.drawImage(img, 0, 0, 16, 16, e.x - 4, e.y - 8, 28, 32);
      else { c.fillStyle = "#ddd"; c.fillRect(e.x, e.y, e.w, e.h); }
      // little floating "!" emote
      c.fillStyle = "#ffec8a";
      c.font = "bold 10px monospace";
      const yoff = Math.sin(this.animT * 4) * 1.5;
      c.fillText("!", e.x + e.w / 2 - 2, e.y - 10 + yoff);
      return;
    }
    if (e.type === "item") {
      const k = (e.data as { kind: string }).kind;
      const img = k === "scroll" ? this.images.it_scroll : this.images.it_coin;
      const yoff = Math.sin(this.animT * 4 + e.x) * 1.5;
      if (img) c.drawImage(img, 0, 0, img.width, img.height, e.x, e.y + yoff, 16, 16);
      else { c.fillStyle = "#ffd86b"; c.fillRect(e.x, e.y, e.w, e.h); }
      return;
    }
    if (e.type === "pickup") {
      const img = this.images.it_heart;
      const yoff = Math.sin(this.animT * 5 + e.x) * 1.5;
      if (img) c.drawImage(img, 0, 0, img.width, img.height, e.x, e.y + yoff, 16, 14);
      else { c.fillStyle = "#ff6677"; c.fillRect(e.x, e.y, e.w, e.h); }
      return;
    }
    if (e.type === "portal") {
      const pulse = 0.35 + Math.sin(this.animT * 3) * 0.15;
      c.fillStyle = `rgba(255, 240, 180, ${pulse})`;
      c.fillRect(e.x, e.y, e.w, e.h);
      c.strokeStyle = "rgba(255,255,255,0.7)";
      c.strokeRect(e.x + 0.5, e.y + 0.5, e.w - 1, e.h - 1);
      c.fillStyle = "#fff";
      c.font = "bold 9px monospace";
      const lbl = (e.data as { label?: string } | undefined)?.label ?? "→";
      c.fillText(lbl, e.x, e.y - 2);
      return;
    }
    if (e.type === "enemy") {
      const k = (e.data as { kind: string }).kind;
      const def = MONSTERS[k] ?? MONSTERS.slime;
      const img = this.images[def.imgKey];
      if (!img) { c.fillStyle = "#ff44aa"; c.fillRect(e.x, e.y, e.w, e.h); this.drawHpBar(e); return; }
      const row = dirRow[e.dir ?? "down"];
      const frame = Math.floor((this.animT * 6) % 4);
      const blink = (e.hurtTimer ?? 0) > 0.12;
      if (!blink) {
        c.drawImage(img, frame * MON_TILE, row * MON_TILE, MON_TILE, MON_TILE, e.x - 5, e.y - 8, 32, 32);
      } else {
        // flash red
        c.save();
        c.filter = "brightness(2)";
        c.drawImage(img, frame * MON_TILE, row * MON_TILE, MON_TILE, MON_TILE, e.x - 5, e.y - 8, 32, 32);
        c.restore();
      }
      this.drawHpBar(e);
      return;
    }
    if (e.type === "boss") {
      const sheet = (e.hurtTimer ?? 0) > 0.12 ? this.images.boss_hit : this.images.boss_walk;
      if (!sheet) { c.fillStyle = "#a02222"; c.fillRect(e.x, e.y, e.w, e.h); this.drawHpBar(e, 56); return; }
      const fs = 50;
      const frames = sheet === this.images.boss_walk ? 6 : 3;
      const f = Math.floor((this.animT * 6) % frames);
      // flip horizontally if facing right
      const flip = e.dir === "right";
      c.save();
      if (flip) {
        c.translate(e.x - 8 + 64, e.y - 12);
        c.scale(-1, 1);
        c.drawImage(sheet, f * fs, 0, fs, fs, 0, 0, 64, 64);
      } else {
        c.drawImage(sheet, f * fs, 0, fs, fs, e.x - 8, e.y - 12, 64, 64);
      }
      c.restore();
      this.drawHpBar(e, 56);
      return;
    }
  }

  drawSlashes() {
    const c = this.ctx;
    const fx = this.images.fx_slash; // 130x32, treat as 4 frames of 32x32
    for (const s of this.slashes) {
      const t = 1 - s.life / s.maxLife;
      const frame = Math.min(3, Math.floor(t * 4));
      if (fx) {
        const fs = 32;
        c.save();
        const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
        c.translate(cx, cy);
        if (s.dir === "up") c.rotate(-Math.PI / 2);
        else if (s.dir === "down") c.rotate(Math.PI / 2);
        else if (s.dir === "left") c.scale(-1, 1);
        c.globalAlpha = 0.95 * (1 - t * 0.4);
        c.drawImage(fx, frame * fs, 0, fs, fs, -fs / 2, -fs / 2, fs, fs);
        c.globalAlpha = 1;
        c.restore();
      } else {
        c.fillStyle = "rgba(255,255,255,0.55)";
        c.fillRect(s.x, s.y, s.w, s.h);
      }
    }
  }

  drawHpBar(e: Entity, w = 24) {
    const c = this.ctx;
    const ratio = (e.hp ?? 0) / (e.maxHp ?? 1);
    if (ratio >= 1) return;
    c.fillStyle = "rgba(0,0,0,0.7)"; c.fillRect(e.x - 1, e.y - 7, w + 2, 4);
    c.fillStyle = "#3a1010"; c.fillRect(e.x, e.y - 6, w, 2);
    c.fillStyle = "#e44"; c.fillRect(e.x, e.y - 6, w * Math.max(0, ratio), 2);
  }
}
