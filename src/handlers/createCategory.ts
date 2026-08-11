import { withAuth } from '../lib/handler';
import { created } from '../lib/response';
import { parseBody } from '../lib/validation';
import * as categoryService from '../services/categoryService';

/** POST /bag/categories */
export const handler = withAuth(async (event, actor) =>
  created(await categoryService.create(actor.id, parseBody(event.body))),
);
