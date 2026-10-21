import { useEffect, useState, type CSSProperties } from 'react';
import './confetti.css';

/** Small DOM confetti burst; a dozen elements, removed after the animation. */
export function Confetti({ count, colours }: { count: number; colours: string[] }) {
  const [pieces] = useState(() =>
    Array.from({ length: count }, (_, i) => ({
      x: (((i * 37) % 100) - 50) * 3.2,
      y: -120 - ((i * 53) % 90),
      r: (i * 97) % 360,
      d: 900 + ((i * 71) % 500),
      c: colours[i % colours.length] as string,
    })),
  );
  const [alive, setAlive] = useState(true);
  useEffect(() => {
    const t = window.setTimeout(() => setAlive(false), 1600);
    return () => window.clearTimeout(t);
  }, []);
  if (!alive) return null;
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <span key={i} style={{ '--x': `${p.x}px`, '--y': `${p.y}px`, '--r': `${p.r}deg`, '--d': `${p.d}ms`, background: p.c } as CSSProperties} />
      ))}
    </div>
  );
}
