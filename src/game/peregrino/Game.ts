import type { ImageMap } from "./assets";
import { playSound, ASSETS } from "./assets";
import { SCENES, type SceneDef } from "./scenes";
import type { Dir, Entity, SceneId } from "./types";

const TILE = 32;
const PLAYER_SIZE = 24;
const PLAYER_SPEED = 110;
const VIEW_W = 480;
const VIEW_H = 320;
const SCALE = 2;

const dirOrder: Dir[] = ["down", "up", "left", "right"];
const dirRow: Record<Dir, number> = { down: 0, up: 1, left: 2, right: 3 };

interface Player {
  x: number;
  y: number;
  w: number;
  h: number;
  dir: Dir;
  hp: number;
  maxHp: number;
  moving: boolean;
  attackT: number;
  invuln: number;
  abilities: { determinacao: boolean; discernimento: boolean; graca: boolean };
}

interface Slash {
  x: number;
  y: number;
  w: number;
  h: number;
  life: number;
  dmg: number;
}

interface FloatText { x: number; y: number; t: number; text: string; color: string }

export interface GameCallbacks {
  onHpChange: (hp: number, max: number) => void;
  onScene: (s: SceneId, def: SceneDef) => void;
  onDialog: (lines: string[] | null) => void;
  onToast: (msg: string) => void;
  onWin: () => void;
  onGameOver: () => void;
}

function rectsOverlap(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

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
  raf = 0;
  last = 0;
  running = true;
  music?: HTMLAudioElement;
  dialogActive = false;
  attackCd = 0;
  animT = 0;
  defeatedBoss = false;

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
    this.cb.onScene(id, this.scene);
    this.cb.onDialog(null);
    this.dialogActive = false;
    if (this.music) { this.music.pause(); this.music = undefined; }
    if (this.scene.music) {
      try {
        const a = new Audio(this.scene.music);
        a.loop = true; a.volume = 0.25;
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
    // try interact with NPC/item nearby
    const reach = { x: this.player.x - 10, y: this.player.y - 10, w: this.player.w + 20, h: this.player.h + 20 };
    for (const e of this.entities) {
      if ((e.type === "npc" || e.type === "item" || e.type === "portal") && rectsOverlap(reach, e)) {
        if (e.type === "npc" && e.dialog) {
          this.cb.onDialog(e.dialog);
          this.dialogActive = true;
          return;
        }
        if (e.type === "item") {
          const d = e.data as { kind: string; text?: string };
          this.cb.onToast(d.text ?? "Item coletado");
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
    this.attackCd = 0.35;
    this.player.attackT = 0.25;
    playSound(ASSETS.audio.slash, 0.4);
    const reach = 22;
    const p = this.player;
    let r: Slash;
    const dmg = this.player.abilities.determinacao ? 2 : 1;
    if (p.dir === "down")  r = { x: p.x - 4, y: p.y + p.h, w: p.w + 8, h: reach, life: 0.15, dmg };
    else if (p.dir === "up") r = { x: p.x - 4, y: p.y - reach, w: p.w + 8, h: reach, life: 0.15, dmg };
    else if (p.dir === "left") r = { x: p.x - reach, y: p.y - 4, w: reach, h: p.h + 8, life: 0.15, dmg };
    else r = { x: p.x + p.w, y: p.y - 4, w: reach, h: p.h + 8, life: 0.15, dmg };
    this.slashes.push(r);
  }

  collidesWalls(r: { x: number; y: number; w: number; h: number }) {
    for (const w of this.scene.walls) if (rectsOverlap(r, w)) return true;
    return false;
  }

  update(dt: number) {
    this.animT += dt;
    if (this.attackCd > 0) this.attackCd -= dt;
    if (this.player.attackT > 0) this.player.attackT -= dt;
    if (this.player.invuln > 0) this.player.invuln -= dt;

    // ability: graça regen
    if (this.player.abilities.graca && this.player.hp < this.player.maxHp) {
      const grace = (this as unknown as { _grace?: number })._grace ?? 0;
      const next = grace + dt;
      if (next > 4) {
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + 1);
        this.cb.onHpChange(this.player.hp, this.player.maxHp);
        (this as unknown as { _grace?: number })._grace = 0;
      } else {
        (this as unknown as { _grace?: number })._grace = next;
      }
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

    // slashes
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
          playSound(ASSETS.audio.hit, 0.3);
        }
      }
    }
    // remove dead
    const before = this.entities.length;
    this.entities = this.entities.filter(e => {
      if ((e.type === "enemy" || e.type === "boss") && (e.hp ?? 1) <= 0) {
        if (e.type === "boss") {
          this.defeatedBoss = true;
          this.player.abilities.determinacao = true;
          this.cb.onToast("✨ Habilidade adquirida: Determinação");
          setTimeout(() => this.loadScene("ending"), 1200);
        }
        return false;
      }
      return true;
    });
    if (this.entities.length < before) {
      // any victory in forest unlocks no skill but feels good
    }

    // enemies AI
    for (const e of this.entities) {
      if (e.type !== "enemy" && e.type !== "boss") continue;
      const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
      const px = this.player.x + this.player.w / 2, py = this.player.y + this.player.h / 2;
      const dx = px - cx, dy = py - cy;
      const dist = Math.hypot(dx, dy);
      const sight = e.type === "boss" ? 600 : 200;
      if (dist < sight && dist > 4) {
        const sp = (e.speed ?? 30) * dt;
        const nx = e.x + (dx / dist) * sp;
        const ny = e.y + (dy / dist) * sp;
        const tryX = { x: nx, y: e.y, w: e.w, h: e.h };
        if (!this.collidesWalls(tryX)) e.x = nx;
        const tryY = { x: e.x, y: ny, w: e.w, h: e.h };
        if (!this.collidesWalls(tryY)) e.y = ny;
      }
      // damage player on touch
      if (this.player.invuln <= 0 && rectsOverlap(this.player, e)) {
        const d = e.type === "boss" ? 2 : 1;
        this.player.hp -= d;
        this.player.invuln = 0.8;
        this.cb.onHpChange(this.player.hp, this.player.maxHp);
        playSound(ASSETS.audio.hit, 0.5);
        // knockback
        const k = 14;
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
  }

  draw() {
    const c = this.ctx;
    c.fillStyle = this.scene.bg;
    c.fillRect(0, 0, VIEW_W, VIEW_H);

    const camX = Math.max(0, Math.min(this.scene.size.w - VIEW_W, this.player.x + this.player.w / 2 - VIEW_W / 2));
    const camY = Math.max(0, Math.min(this.scene.size.h - VIEW_H, this.player.y + this.player.h / 2 - VIEW_H / 2));

    // ground pattern
    c.save();
    c.translate(-Math.floor(camX), -Math.floor(camY));
    this.drawGround();

    // props
    for (const p of this.scene.props) this.drawProp(p);

    // walls (debug-tinted in dungeon to read paths)
    if (this.scene.id === "dungeon") {
      c.fillStyle = this.scene.accent;
      for (const w of this.scene.walls) c.fillRect(w.x, w.y, w.w, w.h);
    }

    // entities sorted by y
    const drawables: { y: number; fn: () => void }[] = [];
    for (const e of this.entities) drawables.push({ y: e.y + e.h, fn: () => this.drawEntity(e) });
    drawables.push({ y: this.player.y + this.player.h, fn: () => this.drawPlayer() });
    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) d.fn();

    // slashes
    c.fillStyle = "rgba(255,255,255,0.55)";
    for (const s of this.slashes) c.fillRect(s.x, s.y, s.w, s.h);

    // float texts
    c.font = "10px monospace";
    for (const f of this.floats) {
      c.fillStyle = f.color;
      c.fillText(f.text, f.x - 6, f.y);
    }

    c.restore();

    // vignette in prologue/dungeon
    if (this.scene.id === "prologue" || this.scene.id === "dungeon") {
      const g = c.createRadialGradient(VIEW_W / 2, VIEW_H / 2, 60, VIEW_W / 2, VIEW_H / 2, 260);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, "rgba(0,0,0,0.7)");
      c.fillStyle = g;
      c.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  }

  drawGround() {
    const c = this.ctx;
    const { w, h } = this.scene.size;
    if (this.scene.id === "village") {
      // grass with darker tile checker
      c.fillStyle = this.scene.bg;
      c.fillRect(0, 0, w, h);
      c.fillStyle = "rgba(0,0,0,0.08)";
      for (let y = 0; y < h; y += TILE)
        for (let x = 0; x < w; x += TILE)
          if (((x / TILE + y / TILE) & 1) === 0) c.fillRect(x, y, TILE, TILE);
      // path
      c.fillStyle = "#caa56a";
      c.fillRect(0, 12 * TILE, w, TILE);
    } else if (this.scene.id === "forest") {
      c.fillStyle = this.scene.bg;
      c.fillRect(0, 0, w, h);
      c.fillStyle = "rgba(0,0,0,0.18)";
      for (let i = 0; i < 200; i++) {
        const x = (i * 53) % w, y = (i * 97) % h;
        c.fillRect(x, y, 3, 3);
      }
    } else if (this.scene.id === "dungeon") {
      c.fillStyle = this.scene.bg;
      c.fillRect(0, 0, w, h);
      c.strokeStyle = "rgba(255,255,255,0.05)";
      for (let x = 0; x < w; x += TILE) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
      for (let y = 0; y < h; y += TILE) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
    } else if (this.scene.id === "ending") {
      const grad = this.ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, "#fff7d6");
      grad.addColorStop(1, "#e6c98a");
      c.fillStyle = grad;
      c.fillRect(0, 0, w, h);
    } else {
      c.fillStyle = this.scene.bg;
      c.fillRect(0, 0, w, h);
    }
  }

  drawProp(p: { x: number; y: number; w: number; h: number; kind: string }) {
    const c = this.ctx;
    if (p.kind === "house") {
      c.fillStyle = "#7a4a2b";
      c.fillRect(p.x, p.y, p.w, p.h);
      c.fillStyle = "#3a1f10";
      c.fillRect(p.x, p.y, p.w, 10);
      c.fillStyle = "#ffce5b";
      c.fillRect(p.x + p.w / 2 - 6, p.y + p.h - 16, 12, 16);
    } else if (p.kind === "tree") {
      c.fillStyle = "#1f3a18";
      c.beginPath(); c.arc(p.x + 16, p.y + 14, 16, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#5a3318";
      c.fillRect(p.x + 13, p.y + 22, 6, 10);
    } else if (p.kind === "rock") {
      c.fillStyle = "#666";
      c.beginPath(); c.arc(p.x + 12, p.y + 12, 12, 0, Math.PI * 2); c.fill();
    } else if (p.kind === "torch") {
      c.fillStyle = "#3a2a1a";
      c.fillRect(p.x + 8, p.y + 8, 8, 16);
      c.fillStyle = "#ffae3a";
      c.beginPath(); c.arc(p.x + 12, p.y + 6, 6 + Math.sin(this.animT * 8) * 1.5, 0, Math.PI * 2); c.fill();
    } else if (p.kind === "grave") {
      c.fillStyle = "#aaa";
      c.fillRect(p.x, p.y, p.w, p.h);
    }
  }

  drawPlayer() {
    const c = this.ctx;
    const p = this.player;
    const sheet = p.attackT > 0 ? this.images.player_attack : (p.moving ? this.images.player_walk : this.images.player_idle);
    const row = dirRow[p.dir];
    const frame = Math.floor((this.animT * 6) % 4);
    const fs = 32;
    const flicker = p.invuln > 0 && Math.floor(this.animT * 20) % 2 === 0;
    if (!flicker) {
      c.drawImage(sheet, frame * fs, row * fs, fs, fs, p.x - 4, p.y - 8, fs, fs);
    }
    void dirOrder;
  }

  drawEntity(e: Entity) {
    const c = this.ctx;
    if (e.type === "npc") {
      // elder sheet 64x112
      c.drawImage(this.images.npc_elder, 0, 0, 16, 16, e.x, e.y, 24, 32);
      return;
    }
    if (e.type === "item") {
      c.fillStyle = "#ffd86b";
      c.fillRect(e.x, e.y, e.w, e.h);
      c.strokeStyle = "#7a5a10"; c.strokeRect(e.x + 0.5, e.y + 0.5, e.w - 1, e.h - 1);
      return;
    }
    if (e.type === "portal") {
      c.fillStyle = "rgba(255,255,200,0.35)";
      c.fillRect(e.x, e.y, e.w, e.h);
      c.fillStyle = "#fff";
      c.font = "8px monospace";
      const lbl = (e.data as { label?: string } | undefined)?.label ?? "→";
      c.fillText(lbl, e.x, e.y - 2);
      return;
    }
    if (e.type === "enemy") {
      const k = (e.data as { kind: string }).kind;
      const img = k === "eye" ? this.images.mon_eye : this.images.mon_beast;
      // sprites are 64x64 sheets, draw 16x16 first cell scaled
      const blink = e.hurtTimer && e.hurtTimer > 0.1;
      if (!blink) {
        c.drawImage(img, 0, 0, 16, 16, e.x - 4, e.y - 8, 32, 32);
      }
      this.drawHpBar(e);
      return;
    }
    if (e.type === "boss") {
      const sheet = (e.hurtTimer ?? 0) > 0.1 ? this.images.boss_hit : this.images.boss_walk;
      const fs = 50;
      const f = Math.floor((this.animT * 4) % (sheet === this.images.boss_walk ? 6 : 3));
      c.drawImage(sheet, f * fs, 0, fs, fs, e.x - 8, e.y - 8, 64, 64);
      this.drawHpBar(e, 56);
    }
  }

  drawHpBar(e: Entity, w = 24) {
    const c = this.ctx;
    const ratio = (e.hp ?? 0) / (e.maxHp ?? 1);
    c.fillStyle = "#000"; c.fillRect(e.x, e.y - 6, w, 3);
    c.fillStyle = "#e44"; c.fillRect(e.x, e.y - 6, w * Math.max(0, ratio), 3);
  }
}
