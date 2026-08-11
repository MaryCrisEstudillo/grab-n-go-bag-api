import { withAuth } from '../lib/handler';
import { ok } from '../lib/response';
import { parseBody, requirePathParam } from '../lib/validation';
import * as categoryService from '../services/categoryService';

/** PATCH /bag/categories/{id} */
export const handler = withAuth(async (event, actor) =>
  ok(
    await categoryService.update(
      actor.id,
      requirePathParam(event.pathParameters, 'id'),
      parseBody(event.body),
    ),
  ),
);
