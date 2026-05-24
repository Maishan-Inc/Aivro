import { Hono } from 'hono';
import type { AppContext } from './types';
import { QueueCoordinator } from './durable/QueueCoordinator';
import { requestId } from './middleware/requestId';
import { securityHeaders } from './middleware/security';
import { corsPolicy } from './middleware/corsPolicy';
import { loadUser } from './services/session';
import { healthRoutes } from './routes/health';
import { configRoutes } from './routes/config';
import { authRoutes } from './routes/auth';
import { generateRoutes } from './routes/generate';
import { queueRoutes } from './routes/queue';
import { adminRoutes } from './routes/admin';
import { imagesRoutes } from './routes/images';
import { fail } from './utils/response';

export { QueueCoordinator };

const app = new Hono<AppContext>();

app.use('*', requestId);
app.use('*', securityHeaders);
app.use('/api/*', corsPolicy());
app.use('/api/*', loadUser);

app.route('/api/health', healthRoutes);
app.route('/api/config', configRoutes);
app.route('/api/auth', authRoutes);
app.route('/api/generate', generateRoutes);
app.route('/api/queue', queueRoutes);
app.route('/api/admin', adminRoutes);
app.route('/api/images', imagesRoutes);

app.notFound((c) => {
  if (new URL(c.req.url).pathname.startsWith('/api/')) return fail(c, 'NOT_FOUND', '接口不存在。', 404);
  return c.env.ASSETS.fetch(c.req.raw);
});

app.onError((err, c) => {
  const requestId = c.get('requestId');
  console.error('Unhandled error', { requestId, message: err.message, stack: err.stack });
  return fail(c, 'INTERNAL_ERROR', `服务器错误。requestId=${requestId}`, 500);
});

export default app;
