import { addDays, toISODate } from '../lib/dates';

/**
 * The bag a demo account starts with.
 *
 * Dates are relative to the moment the account is created, so a visitor always
 * lands on a bag showing one of each status — something already expired,
 * something expiring this week, and plenty that's fine. A fixed set of dates
 * would drift into "everything expired" within a year and make the app look
 * broken to whoever opened it next.
 */

export interface SeedCategory {
  /** Stable within this file only — the database mints the real id. */
  key: string;
  name: string;
  icon: string;
}

export interface SeedItem {
  categoryKey: string;
  name: string;
  description: string;
  quantity: number;
  /** Days from today. Negative is in the past. */
  packedOffset: number;
  /** Days from today, or null for something that doesn't expire. */
  expiryOffset: number | null;
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

export const SEED_ITEMS: SeedItem[] = [
  // Expired, expiring, and fine — one of each, so every status is on screen.
  { categoryKey: 'medicines', name: 'Paracetamol 500mg', description: 'Blister pack, 20 tablets', quantity: 2, packedOffset: -120, expiryOffset: -14 },
  { categoryKey: 'medicines', name: 'Antihistamine', description: 'For allergic reactions', quantity: 1, packedOffset: -120, expiryOffset: 6 },
  { categoryKey: 'medicines', name: 'Sterile gauze pads', description: '', quantity: 8, packedOffset: -120, expiryOffset: 400 },

  { categoryKey: 'vitamins', name: 'Vitamin C 1000mg', description: 'Chewable', quantity: 30, packedOffset: -90, expiryOffset: 210 },

  { categoryKey: 'canned', name: 'Corned beef', description: '150g tin', quantity: 4, packedOffset: -60, expiryOffset: 3 },
  { categoryKey: 'canned', name: 'Sardines in tomato sauce', description: '155g tin', quantity: 6, packedOffset: -60, expiryOffset: 540 },
  { categoryKey: 'canned', name: 'Instant noodles', description: '', quantity: 5, packedOffset: -60, expiryOffset: -3 },

  { categoryKey: 'clothes', name: 'Change of clothes', description: 'Shirt, shorts, underwear, socks', quantity: 1, packedOffset: -150, expiryOffset: null },
  { categoryKey: 'clothes', name: 'Rain poncho', description: '', quantity: 2, packedOffset: -150, expiryOffset: null },

  { categoryKey: 'hygiene', name: 'Alcohol 70%', description: '250ml bottle', quantity: 1, packedOffset: -45, expiryOffset: 9 },
  { categoryKey: 'hygiene', name: 'Wet wipes', description: '', quantity: 2, packedOffset: -45, expiryOffset: 300 },
  { categoryKey: 'hygiene', name: 'Toothbrush & toothpaste', description: '', quantity: 2, packedOffset: -45, expiryOffset: null },

  { categoryKey: 'cooking', name: 'Portable gas stove', description: 'Single burner', quantity: 1, packedOffset: -200, expiryOffset: null },
  { categoryKey: 'cooking', name: 'Manual can opener', description: '', quantity: 1, packedOffset: -200, expiryOffset: null },

  { categoryKey: 'utility', name: 'Flashlight', description: 'LED, takes AA batteries', quantity: 2, packedOffset: -200, expiryOffset: null },
  { categoryKey: 'utility', name: 'AA batteries', description: 'Alkaline, 4-pack', quantity: 8, packedOffset: -200, expiryOffset: 730 },
  { categoryKey: 'utility', name: 'Multi-tool', description: '', quantity: 1, packedOffset: -200, expiryOffset: null },

  { categoryKey: 'flammable', name: 'Butane canister', description: 'For the portable stove', quantity: 2, packedOffset: -200, expiryOffset: 120 },
  { categoryKey: 'flammable', name: 'Waterproof matches', description: '', quantity: 1, packedOffset: -200, expiryOffset: null },
];

export interface ResolvedSeedItem {
  categoryKey: string;
  name: string;
  description: string;
  quantity: number;
  datePacked: string;
  expiresOn: string | null;
}

/** Turns the offsets into the calendar dates they mean today. */
export function resolveSeedItems(today = new Date()): ResolvedSeedItem[] {
  const at = (offset: number) => toISODate(addDays(today, offset));

  return SEED_ITEMS.map((item) => ({
    categoryKey: item.categoryKey,
    name: item.name,
    description: item.description,
    quantity: item.quantity,
    datePacked: at(item.packedOffset),
    expiresOn: item.expiryOffset === null ? null : at(item.expiryOffset),
  }));
}
