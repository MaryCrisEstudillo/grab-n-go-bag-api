/**
 * The API as a long-running Node server.
 *
 * Every route below points at the same handler Lambda would invoke — the only
 * difference is what calls it. Keeping one route table means an endpoint can't
 * exist in one deployment target and quietly not in the other.
 *
 *   npm start
 */

import { createServer } from 'node:http';
import { createRequestListener, type Route } from './lib/router';

import { handler as signIn } from './handlers/signIn';
import { handler as signOut } from './handlers/signOut';
import { handler as register } from './handlers/register';
import { handler as getCurrentUser } from './handlers/getCurrentUser';

import { handler as listCategories } from './handlers/listCategories';
import { handler as getCategory } from './handlers/getCategory';
import { handler as createCategory } from './handlers/createCategory';
import { handler as updateCategory } from './handlers/updateCategory';
import { handler as deleteCategory } from './handlers/deleteCategory';
import { handler as listItemsByCategory } from './handlers/listItemsByCategory';

import { handler as listItems } from './handlers/listItems';
import { handler as getItem } from './handlers/getItem';
import { handler as createItem } from './handlers/createItem';
import { handler as updateItem } from './handlers/updateItem';
import { handler as updateItemQuantity } from './handlers/updateItemQuantity';
import { handler as deleteItem } from './handlers/deleteItem';

import { handler as unsubscribe } from './handlers/unsubscribe';
import { handler as runDigest } from './handlers/runDigest';

const routes: Route[] = [
  // Auth
  { method: 'POST', path: '/auth/sessions', handler: signIn },
  { method: 'DELETE', path: '/auth/sessions', handler: signOut },
  { method: 'POST', path: '/auth/users', handler: register },
  { method: 'GET', path: '/auth/users/me', handler: getCurrentUser },

  // Categories
  { method: 'GET', path: '/bag/categories', handler: listCategories },
  { method: 'POST', path: '/bag/categories', handler: createCategory },
  { method: 'GET', path: '/bag/categories/:id', handler: getCategory },
  { method: 'PATCH', path: '/bag/categories/:id', handler: updateCategory },
  { method: 'DELETE', path: '/bag/categories/:id', handler: deleteCategory },
  { method: 'GET', path: '/bag/categories/:id/items', handler: listItemsByCategory },

  // Items
  { method: 'GET', path: '/bag/items', handler: listItems },
  { method: 'POST', path: '/bag/items', handler: createItem },
  { method: 'GET', path: '/bag/items/:id', handler: getItem },
  { method: 'PATCH', path: '/bag/items/:id', handler: updateItem },
  { method: 'PATCH', path: '/bag/items/:id/quantity', handler: updateItemQuantity },
  { method: 'DELETE', path: '/bag/items/:id', handler: deleteItem },

  // Notifications
  { method: 'POST', path: '/notifications/unsubscribe', handler: unsubscribe },
  { method: 'POST', path: '/internal/run-digest', handler: runDigest },
];

const listener = createRequestListener(routes);

const server = createServer((req, res) => {
  /**
   * Free hosts sleep an idle instance and wake it on the next request, and
   * they poll this to know it's up. It answers before any route matching so a
   * health check never touches the database.
   */
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', routes: routes.length }));
    return;
  }

  void listener(req, res);
});

const port = Number(process.env.PORT ?? 3001);

server.listen(port, () => {
  console.log(`API listening on http://localhost:${port} — ${routes.length} routes`);
});
