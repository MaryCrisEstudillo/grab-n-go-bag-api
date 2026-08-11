import { withAuth } from '../lib/handler';
import { ok } from '../lib/response';
import * as itemService from '../services/itemService';

/** GET /bag/items */
export const handler = withAuth(async (_event, actor) =>
  ok(await itemService.list(actor.id)),
);
