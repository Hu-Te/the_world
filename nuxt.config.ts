// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',

  /** 静态站 + SEO：generate 预渲染；生产由 Nginx 托管 .output/public */
  ssr: true,
  nitro: {
    preset: 'static',
    prerender: {
      crawlLinks: true,
      routes: ['/', '/tools/recon', '/tools/cit-profit', '/tools/lexicore', '/tools/tax-planner', '/tools/aging', '/tools/xml-xlate'],
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
          content: '深空测控：浏览器直达的精密工具测控台。行业分舱选型，校对与核算结果可核。',
        },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        {
          rel: 'preconnect',
          href: 'https://fonts.gstatic.com',
          crossorigin: '',
        },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+SC:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap',
        },
      ],
    },
  },

  runtimeConfig: {
    public: {
      /** Java 后端（开发可走 Nuxt 代理） */
      apiOrigin: process.env.NUXT_PUBLIC_API_ORIGIN || '',
      /** 与 Java APP_API_TOKEN 对齐；本地可空 */
      apiToken: process.env.NUXT_PUBLIC_API_TOKEN || '',
      siteName: process.env.NUXT_PUBLIC_SITE_NAME || '深空测控',
      siteTagline: process.env.NUXT_PUBLIC_SITE_TAGLINE || '精密工具 · 即开即用',
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
