import type { Item, ItemRow } from '../types';
import { badRequest, notFound } from '../lib/errors';
import {
  assertValid,
  checkDatePacked,
  checkExpiresOn,
  checkName,
  checkQuantity,
} from '../lib/validation';
import * as categories from '../repositories/categoryRepository';
import * as items from '../repositories/itemRepository';
import type { ItemPatch } from '../repositories/itemRepository';

function toItem(row: ItemRow): Item {
  return {
    id: row.id,
    categoryId: row.category_id,
    name: row.name,
    description: row.description,
    quantity: row.quantity,
    datePacked: row.date_packed,
    expiresOn: row.expires_on,
  };
}

/**
 * Filed under a category that isn't yours is the same answer as filed under one
 * that doesn't exist — the foreign key alone would let you discover that
 * someone else's id is real.
 */
async function assertOwnsCategory(userId: string, categoryId: string) {
  if (!(await categories.findById(userId, categoryId))) {
    throw badRequest('That category does not exist.', 'categoryId');
  }
}

export async function list(userId: string): Promise<Item[]> {
  return (await items.findAll(userId)).map(toItem);
}

export async function listByCategory(
  userId: string,
  categoryId: string,
): Promise<Item[]> {
  await assertOwnsCategory(userId, categoryId);
  return (await items.findByCategory(userId, categoryId)).map(toItem);
}

export async function get(userId: string, id: string): Promise<Item> {
  const row = await items.findById(userId, id);
  if (!row) throw notFound('Item');

  return toItem(row);
}

export async function create(
  userId: string,
  body: Record<string, unknown>,
): Promise<Item> {
  if (typeof body.categoryId !== 'string' || !body.categoryId) {
    throw badRequest('Say which category it goes in.', 'categoryId');
  }
  assertValid(checkName(body.name, 'item'), 'name');
  assertValid(checkQuantity(body.quantity), 'quantity');
  assertValid(checkDatePacked(body.datePacked), 'datePacked');

  const datePacked = String(body.datePacked);
  assertValid(checkExpiresOn(body.expiresOn ?? null, datePacked), 'expiresOn');

  await assertOwnsCategory(userId, body.categoryId);

  return toItem(
    await items.insert(userId, {
      categoryId: body.categoryId,
      name: String(body.name).trim(),
      description: typeof body.description === 'string' ? body.description : '',
      quantity: body.quantity as number,
      datePacked,
      expiresOn: (body.expiresOn as string | null | undefined) ?? null,
    }),
  );
}

export async function update(
  userId: string,
  id: string,
  body: Record<string, unknown>,
): Promise<Item> {
  const current = await items.findById(userId, id);
  if (!current) throw notFound('Item');

  const patch: ItemPatch = {};

  if ('categoryId' in body) {
    if (typeof body.categoryId !== 'string' || !body.categoryId) {
      throw badRequest('Say which category it goes in.', 'categoryId');
    }
    await assertOwnsCategory(userId, body.categoryId);
    patch.categoryId = body.categoryId;
  }

  if ('name' in body) {
    assertValid(checkName(body.name, 'item'), 'name');
    patch.name = String(body.name).trim();
  }

  if ('description' in body) {
    if (typeof body.description !== 'string') {
      throw badRequest('Description must be text.', 'description');
    }
    patch.description = body.description;
  }

  if ('quantity' in body) {
    assertValid(checkQuantity(body.quantity), 'quantity');
    patch.quantity = body.quantity as number;
  }

  if ('datePacked' in body) {
    assertValid(checkDatePacked(body.datePacked), 'datePacked');
    patch.datePacked = String(body.datePacked);
  }

  // Both dates are checked against whichever value ends up stored, not just
  // the one that happens to be in this request.
  if ('expiresOn' in body) {
    const datePacked = patch.datePacked ?? current.date_packed;
    assertValid(checkExpiresOn(body.expiresOn, datePacked), 'expiresOn');
    patch.expiresOn = (body.expiresOn as string | null) ?? null;
  } else if (patch.datePacked && current.expires_on) {
    assertValid(
      checkExpiresOn(current.expires_on, patch.datePacked),
      'datePacked',
    );
  }

  if (Object.keys(patch).length === 0) throw badRequest('Nothing to update.');

  const row = await items.update(userId, id, patch);
  if (!row) throw notFound('Item');

  return toItem(row);
}

export async function updateQuantity(
  userId: string,
  id: string,
  body: Record<string, unknown>,
): Promise<Item> {
  assertValid(checkQuantity(body.quantity), 'quantity');

  const row = await items.updateQuantity(userId, id, body.quantity as number);
  if (!row) throw notFound('Item');

  return toItem(row);
}

export async function remove(userId: string, id: string): Promise<void> {
  if (!(await items.remove(userId, id))) throw notFound('Item');
}
