/**
 * The categories a new account starts with.
 *
 * Registration seeds the eight categories but no items: the shelves are put up,
 * what goes on them is the owner's. An empty set of categories would make the
 * first screen a blank page with a "create category" button, which is a worse
 * introduction than eight obvious places to start putting things.
 *
 * Items used to be seeded too, so a new account had something visibly expiring
 * and the daily digest could prove itself the next morning. That was worth it
 * while this was a demo; against real accounts it means handing people a bag of
 * things they never packed and then mailing them about it.
 */

export interface SeedCategory {
  /** Stable within this file only — the database mints the real id. */
  key: string;
  name: string;
  icon: string;
}

export const SEED_CATEGORIES: SeedCategory[] = [
  { key: 'medicines', name: 'Medicines', icon: 'Pill' },
  { key: 'vitamins', name: 'Vitamins', icon: 'HeartPulse' },
  { key: 'canned', name: 'Canned goods', icon: 'Soup' },
  { key: 'clothes', name: 'Clothes', icon: 'Shirt' },
  { key: 'hygiene', name: 'Hygiene kit', icon: 'Droplets' },
  { key: 'cooking', name: 'Cooking tools', icon: 'Utensils' },
  { key: 'utility', name: 'Utility tools', icon: 'Wrench' },
  { key: 'flammable', name: 'Flammable items', icon: 'Flame' },
];
