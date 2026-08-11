import { withAuth } from '../lib/handler';
import { ok } from '../lib/response';
import { requirePathParam } from '../lib/validation';
import * as categoryService from '../services/categoryService';

/** GET /bag/categories/{id} */
export const handler = withAuth(async (event, actor) =>
  ok(await categoryService.get(actor.id, requirePathParam(event.pathParameters, 'id'))),
);
