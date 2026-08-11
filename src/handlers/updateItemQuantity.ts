import { withAuth } from '../lib/handler';
import { ok } from '../lib/response';
import { parseBody, requirePathParam } from '../lib/validation';
import * as itemService from '../services/itemService';

/**
 * PATCH /bag/items/{id}/quantity
 *
 * Its own endpoint because the stepper fires it on its own, far more often than
 * any other edit.
 */
export const handler = withAuth(async (event, actor) =>
  ok(
    await itemService.updateQuantity(
      actor.id,
      requirePathParam(event.pathParameters, 'id'),
      parseBody(event.body),
    ),
  ),
);
