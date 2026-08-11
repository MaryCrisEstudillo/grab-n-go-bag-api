import { withAuth } from '../lib/handler';
import { noContent } from '../lib/response';
import { requirePathParam } from '../lib/validation';
import * as categoryService from '../services/categoryService';

/** DELETE /bag/categories/{id} — takes its items with it. */
export const handler = withAuth(async (event, actor) => {
  await categoryService.remove(actor.id, requirePathParam(event.pathParameters, 'id'));
  return noContent();
});
