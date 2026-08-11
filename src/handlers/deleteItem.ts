import { withAuth } from '../lib/handler';
import { noContent } from '../lib/response';
import { requirePathParam } from '../lib/validation';
import * as itemService from '../services/itemService';

/** DELETE /bag/items/{id} */
export const handler = withAuth(async (event, actor) => {
  await itemService.remove(actor.id, requirePathParam(event.pathParameters, 'id'));
  return noContent();
});
