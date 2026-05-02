import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import PeregrinoGame from "@/components/PeregrinoGame";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "O Peregrino — RPG 2D top-down" },
      {
        name: "description",
        content:
          "Jornada simbólica de um peregrino: 3 fases, combate, NPCs e um boss. Jogue no navegador.",
      },
    ],
  }),
});

function Index() {
  const [playing, setPlaying] = useState(false);
  if (playing) return <PeregrinoGame onExit={() => setPlaying(false)} />;
  return <Menu onPlay={() => setPlaying(true)} />;
}

function Menu({ onPlay }: { onPlay: () => void }) {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#0a0a14] text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(ellipse at 50% 30%, rgba(255,220,140,0.25), transparent 60%)",
        }}
      />
      <div className="relative z-10 flex max-w-xl flex-col items-center gap-6 px-6 text-center">
        <h1 className="text-5xl font-bold tracking-wider">O PEREGRINO</h1>
        <p className="text-sm uppercase tracking-[0.3em] text-yellow-200/70">
          Uma jornada · Três fases · Uma transformação
        </p>
        <p className="max-w-md text-base text-white/70">
          "Eu tinha tudo… mas ainda faltava algo." Atravesse a Vila, a Floresta da Dúvida
          e a Caverna do Eu Antigo.
        </p>

        <button
          onClick={onPlay}
          className="rounded-md bg-yellow-300 px-8 py-3 text-base font-semibold text-black shadow-lg transition hover:bg-yellow-200"
        >
          ▶ Iniciar jornada
        </button>

        <div className="mt-4 grid grid-cols-3 gap-3 text-xs text-white/60">
          <div className="rounded border border-white/10 p-3">
            <div className="font-semibold text-white">WASD / Setas</div>
            <div>mover</div>
          </div>
          <div className="rounded border border-white/10 p-3">
            <div className="font-semibold text-white">Espaço</div>
            <div>atacar</div>
          </div>
          <div className="rounded border border-white/10 p-3">
            <div className="font-semibold text-white">Enter</div>
            <div>interagir</div>
          </div>
        </div>

        <p className="mt-6 text-[11px] text-white/40">
          Sprites: Ninja Adventure Asset Pack (Pixel-boy / AAA, CC0).
        </p>
      </div>
    </main>
  );
}
