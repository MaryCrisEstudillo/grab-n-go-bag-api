import { withAuth } from '../lib/handler';
import { created } from '../lib/response';
import { parseBody } from '../lib/validation';
import * as itemService from '../services/itemService';

/** POST /bag/items */
export const handler = withAuth(async (event, actor) =>
  created(await itemService.create(actor.id, parseBody(event.body))),
);
