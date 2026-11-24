import { useEffect, useState } from 'react';

/**
 * Posisi atas tab bar (koordinat window) yang diukur langsung dari layar.
 * Dipakai layar Pindai agar tombol tidak pernah tertutup navbar,
 * apa pun perangkat / inset / versi navigasinya.
 */
let barTopY: number | null = null;
const listeners = new Set<(v: number | null) => void>();

export function setTabBarTop(y: number | null) {
  if (barTopY === y) return;
  barTopY = y;
  listeners.forEach((l) => l(y));
}

export function useTabBarTop(): number | null {
  const [y, setY] = useState<number | null>(barTopY);
  useEffect(() => {
    listeners.add(setY);
    setY(barTopY);
    return () => {
      listeners.delete(setY);
    };
  }, []);
  return y;
}
