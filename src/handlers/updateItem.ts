import { withAuth } from '../lib/handler';
import { ok } from '../lib/response';
import { parseBody, requirePathParam } from '../lib/validation';
import * as itemService from '../services/itemService';

/** PATCH /bag/items/{id} */
export const handler = withAuth(async (event, actor) =>
  ok(
    await itemService.update(
      actor.id,
      requirePathParam(event.pathParameters, 'id'),
      parseBody(event.body),
    ),
  ),
);
