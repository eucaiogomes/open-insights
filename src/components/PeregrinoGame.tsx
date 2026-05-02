import { useEffect, useRef, useState } from "react";
import { Game } from "@/game/peregrino/Game";
import { loadAllImages } from "@/game/peregrino/assets";
import type { SceneId } from "@/game/peregrino/types";

interface SceneInfo { title: string; subtitle: string }

export default function PeregrinoGame({ onExit }: { onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [hp, setHp] = useState({ cur: 6, max: 6 });
  const [scene, setScene] = useState<{ id: SceneId; info: SceneInfo } | null>(null);
  const [dialog, setDialog] = useState<string[] | null>(null);
  const [dialogIdx, setDialogIdx] = useState(0);
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
          onDialog: (lines) => { setDialog(lines); setDialogIdx(0); },
          onToast: (m) => { setToast(m); setTimeout(() => setToast(null), 3500); },
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
          const next = dialogIdx + 1;
          if (next >= dialog.length) { setDialog(null); g.interact(); /* close */ }
          else setDialogIdx(next);
        } else {
          g.interact();
        }
        return;
      }
      g.setKey(e.code, true);
    };
    const up = (e: KeyboardEvent) => gameRef.current?.setKey(e.code, false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [dialog, dialogIdx]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-4 text-foreground">
      <div className="flex w-full max-w-[960px] items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">O Peregrino</h1>
          {scene && <p className="text-xs text-muted-foreground">{scene.info.title}</p>}
        </div>
        <button
          onClick={onExit}
          className="rounded border border-border px-3 py-1 text-sm hover:bg-accent"
        >
          ← Menu
        </button>
      </div>

      <div className="relative">
        <canvas
          ref={canvasRef}
          className="rounded border border-border bg-black"
          style={{ imageRendering: "pixelated" }}
        />

        {/* HUD */}
        <div className="pointer-events-none absolute left-2 top-2 flex gap-1">
          {Array.from({ length: hp.max }).map((_, i) => (
            <div
              key={i}
              className="h-5 w-5 rounded-sm"
              style={{
                background: i < hp.cur ? "#e23a3a" : "#333",
                boxShadow: "inset 0 0 0 2px #000",
              }}
            />
          ))}
        </div>

        {scene && (
          <div className="pointer-events-none absolute right-2 top-2 max-w-[260px] rounded bg-black/60 px-2 py-1 text-right text-[11px] leading-tight text-white">
            <div className="font-semibold">{scene.info.title}</div>
            <div className="opacity-80">"{scene.info.subtitle}"</div>
          </div>
        )}

        {!loaded && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-white">
            Carregando...
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-red-300">
            Erro: {error}
          </div>
        )}

        {dialog && (
          <div className="absolute inset-x-4 bottom-4 rounded border border-white/20 bg-black/85 p-3 text-sm text-white">
            <p>{dialog[dialogIdx]}</p>
            <p className="mt-2 text-right text-[11px] opacity-60">
              [Enter] {dialogIdx + 1 < dialog.length ? "continuar" : "fechar"}
            </p>
          </div>
        )}

        {toast && (
          <div className="pointer-events-none absolute left-1/2 top-12 -translate-x-1/2 rounded bg-black/80 px-3 py-1 text-sm text-yellow-200">
            {toast}
          </div>
        )}

        {over && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/85 text-white">
            <h2 className="text-2xl font-bold">
              {over === "win" ? "✨ Transformação" : "Você caiu…"}
            </h2>
            <p className="max-w-md text-center text-sm opacity-80">
              {over === "win"
                ? "O caminho nunca foi sobre chegar… mas sobre se tornar."
                : "Mas todo peregrino se levanta. Tente novamente."}
            </p>
            <button
              onClick={() => location.reload()}
              className="rounded bg-white px-4 py-2 text-sm font-semibold text-black"
            >
              Recomeçar
            </button>
          </div>
        )}
      </div>

      <div className="max-w-[960px] text-xs text-muted-foreground">
        <strong>Controles:</strong> WASD/Setas mover · Espaço atacar · Enter interagir/diálogo
      </div>
    </div>
  );
}
