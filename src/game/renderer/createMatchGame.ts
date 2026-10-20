import type { MatchController } from './controller';
import type { SceneOptions } from './MatchScene';

export interface MatchGameHandle {
  destroy(): void;
}

/**
 * Boots Phaser (code-split: only loaded when a match starts) into `parent`. The canvas is
 * rendered at device-pixel resolution and CSS-scaled down so the pitch stays crisp on phones.
 */
export async function createMatchGame(parent: HTMLElement, controller: MatchController, opts: SceneOptions): Promise<MatchGameHandle> {
  const [{ default: Phaser }, { MatchScene }] = await Promise.all([import('phaser'), import('./MatchScene')]);
  const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
  const cssW = Math.max(200, parent.clientWidth);
  const cssH = Math.max(200, parent.clientHeight);
  const scene = new MatchScene(controller, opts);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    banner: false,
    backgroundColor: '#0d3a2f',
    audio: { noAudio: true },
    scale: { mode: Phaser.Scale.NONE, width: Math.round(cssW * dpr), height: Math.round(cssH * dpr), zoom: 1 / dpr },
    render: { antialias: true, powerPreference: 'low-power' },
    input: { keyboard: false, gamepad: false },
    scene: [scene],
  });

  const ro = new ResizeObserver(() => {
    const w = Math.max(200, parent.clientWidth);
    const h = Math.max(200, parent.clientHeight);
    game.scale.resize(Math.round(w * dpr), Math.round(h * dpr));
  });
  ro.observe(parent);

  return {
    destroy() {
      ro.disconnect();
      game.destroy(true);
    },
  };
}
