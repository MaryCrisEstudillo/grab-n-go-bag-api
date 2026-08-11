import type { Category, CategoryRow } from '../types';
import { badRequest, conflict, notFound } from '../lib/errors';
import { assertValid, checkName } from '../lib/validation';
import { isUniqueViolation } from '../repositories/db';
import * as categories from '../repositories/categoryRepository';

const DEFAULT_ICON = 'package';
const NAME_TAKEN = 'You already have a category with that name.';

function toCategory(row: CategoryRow): Category {
  return { id: row.id, name: row.name, icon: row.icon };
}

export async function list(userId: string): Promise<Category[]> {
  return (await categories.findAll(userId)).map(toCategory);
}

export async function get(userId: string, id: string): Promise<Category> {
  const row = await categories.findById(userId, id);
  if (!row) throw notFound('Category');

  return toCategory(row);
}

export async function create(
  userId: string,
  body: Record<string, unknown>,
): Promise<Category> {
  assertValid(checkName(body.name, 'category'), 'name');

  const icon = typeof body.icon === 'string' && body.icon ? body.icon : DEFAULT_ICON;

  try {
    return toCategory(
      await categories.insert(userId, String(body.name).trim(), icon),
    );
  } catch (error) {
    if (isUniqueViolation(error, 'categories_user_name_unique')) {
      throw conflict(NAME_TAKEN, 'name');
    }
    throw error;
  }
}

export async function update(
  userId: string,
  id: string,
  body: Record<string, unknown>,
): Promise<Category> {
  const patch: { name?: string; icon?: string } = {};

  if ('name' in body) {
    assertValid(checkName(body.name, 'category'), 'name');
    patch.name = String(body.name).trim();
  }

  if ('icon' in body) {
    if (typeof body.icon !== 'string' || !body.icon) {
      throw badRequest('Pick an icon.', 'icon');
    }
    patch.icon = body.icon;
  }

  if (!patch.name && !patch.icon) throw badRequest('Nothing to update.');

  try {
    const row = await categories.update(userId, id, patch);
    if (!row) throw notFound('Category');

    return toCategory(row);
  } catch (error) {
    if (isUniqueViolation(error, 'categories_user_name_unique')) {
      throw conflict(NAME_TAKEN, 'name');
    }
    throw error;
  }
}

export async function remove(userId: string, id: string): Promise<void> {
  if (!(await categories.remove(userId, id))) throw notFound('Category');
}
