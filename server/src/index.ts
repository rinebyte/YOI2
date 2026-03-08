import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { swagger } from '@elysiajs/swagger'
import { authRoutes } from './routes/auth'
import { accountRoutes } from './routes/accounts'
import { imageRoutes } from './routes/images'
import { adminRoutes } from './routes/admin'

const app = new Elysia()

  // ── Global middleware ────────────────────────────────────────────────
  .use(
    cors({
      origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization'],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    })
  )

  .use(
    swagger({
      path: '/docs',
      documentation: {
        info: {
          title: 'CF Image Dashboard API',
          version: '1.0.0',
          description:
            'Multi-account Cloudflare Images storage API. Auth via Supabase JWT.',
        },
        tags: [
          { name: 'auth',     description: 'Authentication (register, login, logout)' },
          { name: 'accounts', description: 'CF account management with data isolation' },
          { name: 'images',   description: 'Image upload, retrieval, and management' },
        ],
      },
    })
  )

  // ── Health check ─────────────────────────────────────────────────────
  .get('/health', () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  }))

  // ── Routes ───────────────────────────────────────────────────────────
  .use(authRoutes)
  .use(accountRoutes)
  .use(imageRoutes)
  .use(adminRoutes)

  // ── Global error handler ─────────────────────────────────────────────
  .onError(({ error, code, set }) => {
    console.error(`[${code}]`, error)

    if (code === 'VALIDATION') {
      set.status = 422
      return { error: 'Validation failed', details: error.message }
    }

    if (code === 'NOT_FOUND') {
      set.status = 404
      return { error: 'Route not found' }
    }

    set.status = 500
    return { error: 'Internal server error' }
  })

  .listen(Number(process.env.PORT ?? 3000))

console.log(
  `\n  CF Image API ready at http://localhost:${app.server?.port}` +
  `\n  Swagger docs:        http://localhost:${app.server?.port}/docs\n`
)

// Export the app type for the Eden treaty client (frontend type-safety)
export type App = typeof app
