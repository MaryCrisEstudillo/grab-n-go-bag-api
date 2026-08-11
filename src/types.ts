/**
 * The wire shapes. These are the contract the frontend was built against —
 * camelCase, calendar dates as 'YYYY-MM-DD' strings, `expiresOn` genuinely
 * nullable because a crowbar doesn't expire. Database rows are snake_case and
 * never leave the repository layer untranslated.
 */

export interface User {
  email: string;
}

export interface AuthSession {
  token: string;
  user: User;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
}

export interface Item {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  quantity: number;
  datePacked: string;
  expiresOn: string | null;
}

/** Who the request is acting as, resolved from the token by `withAuth`. */
export interface Actor {
  id: string;
  email: string;
}

/**
 * ─── Row shapes ──────────────────────────────────────────────────────────────
 */

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
}

export interface CategoryRow {
  id: string;
  name: string;
  icon: string;
}

export interface ItemRow {
  id: string;
  category_id: string;
  name: string;
  description: string;
  quantity: number;
  date_packed: string;
  expires_on: string | null;
}
