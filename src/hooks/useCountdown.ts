import { useEffect, useState } from 'react';

export function useCountdown(targetIso: string): string {
  const [label, setLabel] = useState('');

  useEffect(() => {
    const tick = () => {
      const target = new Date(targetIso).getTime();
      const now = Date.now();
      let diff = Math.max(0, target - now);
      const s = Math.floor(diff / 1000);
      const days = Math.floor(s / 86400);
      const hours = Math.floor((s % 86400) / 3600);
      const minutes = Math.floor((s % 3600) / 60);
      const secs = s % 60;
      if (diff <= 0) {
        setLabel('Başlıyor');
        return;
      }
      if (days > 0) setLabel(`${days}g ${hours}s ${minutes}dk`);
      else setLabel(`${hours}s ${minutes}dk ${secs}sn`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetIso]);

  return label;
}
