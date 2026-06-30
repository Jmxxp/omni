import { useEffect, useRef } from "react";
import type { AgentState } from "../lib/types";

interface VantaOrbProps {
  state: AgentState;
  muted: boolean;
}

const stateText: Record<AgentState, string> = {
  idle: "Pronto",
  listening: "Ouvindo",
  thinking: "Pensando",
  planning: "Planejando",
  waiting_confirmation: "Aguardando",
  executing: "Executando",
  observing: "Observando",
  speaking: "Falando",
  completed: "Concluido",
  error: "Erro",
};

function loadScript(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve(true);
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function VantaOrb({ state, muted }: VantaOrbProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const effectRef = useRef<{ setOptions?: (options: unknown) => void; destroy?: () => void } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function setup() {
      await loadScript("https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.4.0/p5.min.js");
      await loadScript("https://cdn.jsdelivr.net/npm/vanta@0.5.24/dist/vanta.trunk.min.js");

      if (cancelled || !hostRef.current) return;

      const win = window as Window & {
        VANTA?: {
          TRUNK?: (options: Record<string, unknown>) => { setOptions?: (options: unknown) => void; destroy?: () => void };
        };
        p5?: unknown;
      };

      if (!win.VANTA?.TRUNK || !win.p5) return;

      effectRef.current = win.VANTA.TRUNK({
        el: hostRef.current,
        p5: win.p5,
        mouseControls: false,
        touchControls: false,
        gyroControls: false,
        minHeight: 600,
        minWidth: 600,
        scale: 1,
        scaleMobile: 1,
        color: 0x1da3b9,
        backgroundColor: 0x000000,
        spacing: 0,
        chaos: 3,
      });
    }

    setup();

    return () => {
      cancelled = true;
      effectRef.current?.destroy?.();
      effectRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chaosByState: Record<AgentState, number> = {
      idle: 2.6,
      listening: 3.2,
      thinking: 6.4,
      planning: 5.4,
      waiting_confirmation: 4.6,
      executing: 7.2,
      observing: 5.8,
      speaking: 6.8,
      completed: 3.4,
      error: 8,
    };

    effectRef.current?.setOptions?.({
      chaos: muted ? 1.7 : chaosByState[state],
      color: state === "error" ? 0xff4d6d : state === "waiting_confirmation" ? 0xf5c66b : 0x1da3b9,
    });
  }, [state, muted]);

  return (
    <div className={`orb-wrap state-${state} ${muted ? "is-muted" : ""}`}>
      <div ref={hostRef} className="vanta-host" />
      <div className="orb-fallback" />
      <div className="orb-readout">
        <span>{muted ? "Mudo" : stateText[state]}</span>
      </div>
    </div>
  );
}

