import { withAuth } from '../lib/handler';
import { ok } from '../lib/response';
import * as categoryService from '../services/categoryService';

/** GET /bag/categories */
export const handler = withAuth(async (_event, actor) =>
  ok(await categoryService.list(actor.id)),
);
