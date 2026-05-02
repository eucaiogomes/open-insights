import { useEffect, useRef, useState } from "react";
import { Game } from "@/game/peregrino/Game";
import { loadAllImages, ASSETS } from "@/game/peregrino/assets";
import type { SceneId } from "@/game/peregrino/types";

interface SceneInfo { title: string; subtitle: string }
interface DialogState { lines: string[]; idx: number; speaker?: string; faceKey?: string }

export default function PeregrinoGame({ onExit }: { onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [hp, setHp] = useState({ cur: 6, max: 6 });
  const [scene, setScene] = useState<{ id: SceneId; info: SceneInfo } | null>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [over, setOver] = useState<"win" | "lose" | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadAllImages()
      .then((imgs) => {
        if (cancelled || !canvasRef.current) return;
        const g = new Game(canvasRef.current, imgs, {
          onHpChange: (cur, max) => setHp({ cur, max }),
          onScene: (id, def) => setScene({ id, info: { title: def.title, subtitle: def.subtitle } }),
          onDialog: (lines, speaker, faceKey) => {
            if (lines) setDialog({ lines, idx: 0, speaker, faceKey });
            else setDialog(null);
          },
          onToast: (m) => { setToast(m); setTimeout(() => setToast(null), 2800); },
          onWin: () => setOver("win"),
          onGameOver: () => setOver("lose"),
        });
        gameRef.current = g;
        g.start();
        setLoaded(true);
      })
      .catch((e) => setError(e.message));

    return () => {
      cancelled = true;
      gameRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const g = gameRef.current; if (!g) return;
      if (e.code === "Space" || e.code === "KeyJ") { e.preventDefault(); g.attack(); return; }
      if (e.code === "Enter" || e.code === "KeyE") {
        e.preventDefault();
        if (dialog) {
          const next = dialog.idx + 1;
          if (next >= dialog.lines.length) { setDialog(null); g.interact(); }
          else setDialog({ ...dialog, idx: next });
        } else g.interact();
        return;
      }
      g.setKey(e.code, true);
    };
    const up = (e: KeyboardEvent) => gameRef.current?.setKey(e.code, false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [dialog]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#0b0b14] p-4 text-foreground">
      <div className="flex w-full max-w-[960px] items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-wide text-yellow-100">O Peregrino</h1>
          {scene && <p className="text-xs text-white/60">{scene.info.title}</p>}
        </div>
        <button
          onClick={onExit}
          className="rounded border border-white/20 px-3 py-1 text-sm text-white/80 hover:bg-white/10"
        >
          ← Menu
        </button>
      </div>

      <div className="relative">
        <canvas
          ref={canvasRef}
          className="rounded border border-white/15 bg-black shadow-[0_0_60px_rgba(0,0,0,0.6)]"
          style={{ imageRendering: "pixelated" }}
        />

        {/* HUD: hearts using item sprite */}
        <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-1 rounded bg-black/55 px-2 py-1">
          {Array.from({ length: hp.max }).map((_, i) => (
            <img
              key={i}
              src={ASSETS.items.heart}
              alt=""
              className="h-5 w-5"
              style={{
                imageRendering: "pixelated",
                filter: i < hp.cur ? "none" : "grayscale(1) brightness(0.4)",
              }}
            />
          ))}
        </div>

        {scene && (
          <div className="pointer-events-none absolute right-3 top-3 max-w-[280px] rounded border border-white/10 bg-black/65 px-3 py-1.5 text-right text-[11px] leading-tight text-white">
            <div className="font-semibold tracking-wide">{scene.info.title}</div>
            <div className="opacity-75 italic">"{scene.info.subtitle}"</div>
          </div>
        )}

        {!loaded && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/85 text-white">
            <div className="flex flex-col items-center gap-2">
              <div className="h-2 w-40 overflow-hidden rounded bg-white/10">
                <div className="h-full w-1/2 animate-pulse bg-yellow-300" />
              </div>
              <span className="text-xs uppercase tracking-[0.3em] text-white/70">Carregando…</span>
            </div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-red-300">
            Erro: {error}
          </div>
        )}

        {dialog && (
          <div className="absolute inset-x-3 bottom-3 flex gap-3 rounded-lg border border-yellow-200/30 bg-black/85 p-3 text-sm text-white shadow-xl backdrop-blur">
            {dialog.faceKey && (
              <img
                src={ASSETS.npc.elderFace}
                alt=""
                className="h-16 w-16 shrink-0 rounded border border-white/20"
                style={{ imageRendering: "pixelated" }}
              />
            )}
            <div className="flex-1">
              {dialog.speaker && (
                <div className="mb-1 text-xs font-bold uppercase tracking-widest text-yellow-200">
                  {dialog.speaker}
                </div>
              )}
              <p className="leading-relaxed">{dialog.lines[dialog.idx]}</p>
              <p className="mt-2 text-right text-[11px] opacity-60">
                ▸ [Enter] {dialog.idx + 1 < dialog.lines.length ? "continuar" : "fechar"}
              </p>
            </div>
          </div>
        )}

        {toast && (
          <div className="pointer-events-none absolute left-1/2 top-14 -translate-x-1/2 rounded-md bg-black/80 px-3 py-1.5 text-sm text-yellow-100 shadow-lg">
            {toast}
          </div>
        )}

        {over && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/90 text-white">
            <h2 className="text-3xl font-bold tracking-wide">
              {over === "win" ? "✨ Transformação" : "Você caiu…"}
            </h2>
            <p className="max-w-md text-center text-sm opacity-80">
              {over === "win"
                ? "O caminho nunca foi sobre chegar… mas sobre se tornar."
                : "Mas todo peregrino se levanta. Tente novamente."}
            </p>
            <button
              onClick={() => location.reload()}
              className="mt-2 rounded-md bg-yellow-300 px-5 py-2 text-sm font-semibold text-black hover:bg-yellow-200"
            >
              Recomeçar
            </button>
          </div>
        )}
      </div>

      <div className="max-w-[960px] text-xs text-white/60">
        <strong className="text-white/80">Controles:</strong> WASD/Setas mover · Espaço atacar · Enter interagir/diálogo
      </div>
    </div>
  );
}
