import { withAuth } from '../lib/handler';
import { ok } from '../lib/response';
import { requirePathParam } from '../lib/validation';
import * as itemService from '../services/itemService';

/** GET /bag/items/{id} */
export const handler = withAuth(async (event, actor) =>
  ok(await itemService.get(actor.id, requirePathParam(event.pathParameters, 'id'))),
);
