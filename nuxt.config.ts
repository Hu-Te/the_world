// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',

  /**
   * 静态站不需要客户端 app-manifest 热更新检查。
   * 关闭可避免 yarn deploy / generate 后 dev 偶发
   * Failed to resolve import "#app-manifest"。
   */
  experimental: {
    appManifest: false,
    defaults: {
      nuxtLink: {
        // 首页不要 prefetch 管理端/工具舱大包（会抢带宽）
        prefetch: false,
      },
    },
  },

  hooks: {
    'build:manifest'(manifest) {
      for (const item of Object.values(manifest)) {
        // 关掉路由级 prefetch，避免首页抢下 700KB+ 的 element-plus
        item.prefetch = false
      }
    },
  },

  /** 静态站 + SEO：generate 预渲染；生产由 Nginx 托管 .output/public */
  ssr: true,
  nitro: {
    preset: 'static',
    prerender: {
      crawlLinks: true,
      routes: [
        '/',
        '/login',
        '/console',
        '/console/finance',
        '/console/finance/desktop/auth-callback',
        '/console/fieldpulse',
        '/console/fieldpulse/devices',
        '/console/fieldpulse/monitor',
        '/console/fieldpulse/alarms',
        '/console/fieldpulse/trends',
        '/console/fieldpulse/scada',
        '/console/fieldpulse/scada-view',
        '/console/fieldpulse/agents',
        '/console/fieldpulse/collab',
        '/admin/users',
        '/403',
        '/upgrade',
        '/tools/recon',
        '/tools/cit-profit',
        '/tools/lexicore',
        '/tools/tax-planner',
        '/tools/aging',
        '/tools/xml-xlate',
        '/tools/fieldpulse',
        '/tools/pack-3d',
      ],
    },
    /** 开发态 /api 代理；WS 由 utils/fieldpulse/api.ts 在开发态直连 Java:8787 */
    devProxy: {
      '/api': {
        target: process.env.NUXT_BACKEND_URL || 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },

  modules: ['@nuxt/eslint', '@nuxtjs/tailwindcss', '@pinia/nuxt'],

  eslint: {
    config: {
      stylistic: false,
    },
  },

  css: ['~/assets/css/main.scss'],

  app: {
    head: {
      htmlAttrs: { lang: 'zh-CN' },
      title: '深空测控',
      meta: [
        { charset: 'utf-8' },
        {
          name: 'viewport',
          content: 'width=device-width, initial-scale=1.0, viewport-fit=cover, maximum-scale=5.0',
        },
        {
          name: 'format-detection',
          content: 'telephone=no, email=no, address=no',
        },
        {
          name: 'mobile-web-app-capable',
          content: 'yes',
        },
        {
          name: 'apple-mobile-web-app-status-bar-style',
          content: 'black-translucent',
        },
        {
          name: 'description',
          content: '深空测控：浏览器直达的精密测控台。行业分舱入位，校对与核算结果可溯。',
        },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        // 不再阻塞拉 Google CJK 字体；首屏用系统字体，弱网可快数秒
      ],
    },
  },

  runtimeConfig: {
    /** 服务端私密：仅 Agent 部署/运维脚本使用，禁止打进 public */
    apiToken: process.env.NUXT_API_TOKEN || process.env.APP_API_TOKEN || '',
    backendUrl: process.env.NUXT_BACKEND_URL || 'http://127.0.0.1:8787',
    public: {
      /** Java 后端（开发可走 Nuxt 代理） */
      apiOrigin: process.env.NUXT_PUBLIC_API_ORIGIN || '',
      /** WebSocket 专用 Origin；空则开发态直连 hostname:devBackendPort */
      wsOrigin: process.env.NUXT_PUBLIC_WS_ORIGIN || '',
      /** 开发态直连 Java 端口（Nuxt /ws 代理不可靠时的回退） */
      devBackendPort: process.env.NUXT_PUBLIC_DEV_BACKEND_PORT || '8787',
      siteName: process.env.NUXT_PUBLIC_SITE_NAME || '深空测控',
      siteTagline: process.env.NUXT_PUBLIC_SITE_TAGLINE || '精密测控 · 即开即用',
      /** 管理员微信二维码（静态资源路径，用于「联系管理员创建账号」） */
      adminWechatQr: process.env.NUXT_PUBLIC_ADMIN_WECHAT_QR || '/iam/wechat-admin-qr.png',
      /** 可选：微信号文案展示 */
      adminWechatId: process.env.NUXT_PUBLIC_ADMIN_WECHAT_ID || '',
      icp: '赣ICP备2026012918号-1',
      icpUrl: 'https://beian.miit.gov.cn/',
    },
  },

  vite: {
    css: {
      // 避免 sass-embedded 原生二进制架构错配（arm64/x64）导致 ENOENT
      preprocessorOptions: {
        scss: {
          api: 'modern',
        },
      },
    },
    server: {
      proxy: {
        '/api': {
          target: process.env.NUXT_BACKEND_URL || 'http://127.0.0.1:8787',
          changeOrigin: true,
          // Long XML translate SSE can run many minutes; never idle-cut the proxy.
          timeout: 0,
          proxyTimeout: 0,
          configure(proxy) {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.removeHeader('origin')
            })
            proxy.on('proxyRes', (proxyRes, _req, res) => {
              const ct = String(proxyRes.headers['content-type'] || '')
              if (ct.includes('text/event-stream')) {
                // Prevent buffering of SSE frames (nginx/vite/http-proxy).
                res.setHeader('Cache-Control', 'no-cache, no-transform')
                res.setHeader('X-Accel-Buffering', 'no')
                res.setHeader('Connection', 'keep-alive')
              }
            })
          },
        },
        '/ws': {
          target: process.env.NUXT_BACKEND_URL || 'http://127.0.0.1:8787',
          changeOrigin: true,
          ws: true,
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/three')) return 'three'
            if (id.includes('three/examples') || id.includes('three/addons')) return 'three-addons'
          },
        },
      },
    },
    optimizeDeps: {
      include: ['three'],
    },
  },

  /** 局域网 IP 访问（手机 / 同网段调试） */
  devServer: {
    host: '0.0.0.0',
    port: 3111,
  },

  /** 管理端依赖 Element Plus / 登录态，仅客户端渲染（含尾斜杠变体） */
  routeRules: {
    '/admin': { ssr: false },
    '/admin/**': { ssr: false },
    '/console': { ssr: false },
    '/console/**': { ssr: false },
    '/login': { ssr: false },
    '/403': { ssr: false },
    '/upgrade': { ssr: false },
  },

  typescript: {
    strict: true,
    typeCheck: false,
  },

  components: [
    { path: '~/components/ui', pathPrefix: false },
    { path: '~/components/web3d', pathPrefix: false },
    { path: '~/components/recon', pathPrefix: false },
    { path: '~/components/tax', pathPrefix: false },
    { path: '~/components/aging', pathPrefix: false },
    { path: '~/components/xmlxlate', pathPrefix: false },
    { path: '~/components/fieldpulse', pathPrefix: false },
    { path: '~/components/pack3d', pathPrefix: false },
    { path: '~/components/console', pathPrefix: false },
    { path: '~/components/sprite', pathPrefix: false },
    /** IAM：登录 / 系统选择；pathPrefix 保留目录名 → IamCornerPortal 等 */
    { path: '~/components/iam', pathPrefix: true },

  ],

  imports: {
    dirs: ['composables', 'stores'],
  },

  pinia: {
    storesDirs: ['./stores/**'],
  },

  tailwindcss: {
    cssPath: '~/assets/css/main.scss',
    configPath: 'tailwind.config.ts',
  },

  devtools: { enabled: true },
})
