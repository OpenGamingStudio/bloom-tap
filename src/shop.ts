export type PerkId = 'gold' | 'slow' | 'life';

export interface Item {
  id: PerkId;
  name: string;
  desc: string;
  price: number;
}

export const ITEMS: Item[] = [
  { id: 'slow', name: 'Fleur lente', desc: 'Les fleurs durent 35 % plus longtemps avant de faner.', price: 30 },
  { id: 'gold', name: 'Fleur dorée', desc: 'Une fleur sur cinq est dorée et vaut deux fois plus de points.', price: 40 },
  { id: 'life', name: 'Vie en plus', desc: 'Tu commences chaque partie avec 4 vies au lieu de 3.', price: 60 },
];

export const itemById = (id: string): Item | undefined => ITEMS.find((i) => i.id === id);
