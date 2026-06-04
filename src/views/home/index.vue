<template>
  <div class="home">
    <div ref="sceneRef" class="home-scene" aria-hidden="true" />
    <div class="home-vignette" aria-hidden="true" />
    <div class="home-grain" aria-hidden="true" />

    <header class="nav" :class="{ 'nav--solid': scrolled }">
      <span class="nav-brand">
        <i class="brand-dot" />
        {{ SITE.name }}
      </span>
      <nav class="nav-links">
        <a v-for="item in SITE.nav" :key="item.href" :href="item.href">{{ item.label }}</a>
        <RouterLink class="nav-cta" to="/game">开始体验</RouterLink>
      </nav>
    </header>

    <section class="hero">
      <div class="hero-inner">
        <div class="hero-copy">
          <h1 class="hero-title">{{ SITE.name }}</h1>
          <p class="hero-subtitle">{{ SITE.title }}</p>
          <p class="hero-tagline">{{ SITE.tagline }}</p>

          <div class="hero-actions">
            <RouterLink class="btn btn-primary" to="/game">
              <span>启动模拟</span>
              <i aria-hidden="true">→</i>
            </RouterLink>
            <RouterLink class="btn btn-ghost" to="/world">沉浸世界</RouterLink>
          </div>
        </div>
      </div>

      <a class="scroll-hint" href="#portals">
        <span>探索入口</span>
        <i aria-hidden="true">↓</i>
      </a>
    </section>

    <section id="portals" class="portals">
      <div class="section-head">
        <p class="section-kicker">ENTRY POINTS</p>
        <h2>选择入口</h2>
      </div>
      <div class="portal-grid">
        <RouterLink
          v-for="portal in SITE.portals"
          :key="portal.href"
          :to="portal.href"
          class="portal-card"
        >
          <span class="portal-code">{{ portal.code }}</span>
          <h3>{{ portal.title }}</h3>
          <p>{{ portal.desc }}</p>
          <span class="portal-link">{{ portal.label }} →</span>
        </RouterLink>
      </div>
    </section>

    <section id="about" class="panel-section">
      <article class="glass-panel reveal">
        <p class="panel-label">ABOUT</p>
        <h2>关于系统</h2>
        <p>{{ SITE.description }}</p>
      </article>
    </section>

    <section id="works" class="panel-section">
      <div class="section-head section-head--left">
        <p class="section-kicker">MODULES</p>
        <h2>能力模块</h2>
      </div>
      <div class="works-grid">
        <article
          v-for="(work, index) in SITE.works"
          :key="work.title"
          class="glass-panel work-card reveal"
          :style="{ animationDelay: `${index * 0.08}s` }"
        >
          <h3>{{ work.title }}</h3>
          <p>{{ work.desc }}</p>
        </article>
      </div>
    </section>

    <section id="contact" class="panel-section contact">
      <article class="glass-panel contact-panel reveal">
        <p class="panel-label">CONTACT</p>
        <h2>建立连接</h2>
        <!--
        <div class="contact-links">
          <a :href="`mailto:${SITE.email}`">{{ SITE.email }}</a>
          <a :href="SITE.github" target="_blank" rel="noopener noreferrer">GitHub</a>
        </div>
        -->
      </article>
    </section>

    <footer class="footer">
      <span>© {{ year }} {{ SITE.name }}</span>
      <span class="footer-dot" />
      <span>SIMULATION ONLINE</span>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { mountHomeScene, type HomeSceneHandle } from '@/three'
import { SITE } from '@/config/site'

const sceneRef = ref<HTMLDivElement>()
let sceneHandle: HomeSceneHandle | null = null
const year = new Date().getFullYear()
const scrolled = ref(false)

function onScroll() {
  scrolled.value = window.scrollY > 24
  const max = document.documentElement.scrollHeight - window.innerHeight
  const progress = max > 0 ? window.scrollY / max : 0
  sceneHandle?.setScrollProgress(progress)
}

onMounted(() => {
  if (sceneRef.value) {
    sceneHandle = mountHomeScene(sceneRef.value)
  }

  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
})

onUnmounted(() => {
  sceneHandle?.dispose()
  sceneHandle = null
  window.removeEventListener('scroll', onScroll)
})
</script>

<style scoped>
.home {
  position: relative;
  min-height: 100vh;
  color: #dce8f0;
}

.home-scene {
  position: fixed;
  inset: 0;
  z-index: 0;
}

.home-scene :deep(canvas) {
  display: block;
  width: 100% !important;
  height: 100% !important;
}

.home-vignette {
  position: fixed;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background:
    linear-gradient(90deg, rgba(3, 6, 12, 0.88) 0%, rgba(3, 6, 12, 0.48) 40%, rgba(3, 6, 12, 0.08) 62%, rgba(3, 6, 12, 0.35) 100%),
    radial-gradient(ellipse at 68% 42%, rgba(42, 136, 160, 0.18), transparent 48%),
    linear-gradient(180deg, rgba(3, 6, 12, 0.35) 0%, rgba(3, 6, 12, 0.88) 100%);
}

.home-grain {
  position: fixed;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  opacity: 0.035;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}

.nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 2rem;
  transition: background 0.3s, border-color 0.3s, backdrop-filter 0.3s;
}

.nav--solid {
  background: rgba(4, 8, 16, 0.72);
  backdrop-filter: blur(16px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.nav-brand {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  font-size: 0.875rem;
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.brand-dot,
.live-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #4a98a8;
  box-shadow: 0 0 8px rgba(74, 152, 168, 0.45);
}

.live-dot {
  display: inline-block;
  margin-right: 0.5rem;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.35;
  }
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.nav-links a {
  color: rgba(220, 232, 240, 0.62);
  text-decoration: none;
  font-size: 0.8125rem;
  letter-spacing: 0.06em;
  transition: color 0.2s;
}

.nav-links a:hover {
  color: #8ab4c4;
}

.nav-cta {
  padding: 0.45rem 0.95rem !important;
  border-radius: 999px;
  border: 1px solid rgba(74, 152, 168, 0.35) !important;
  background: rgba(74, 152, 168, 0.12) !important;
  color: #b8d8e0 !important;
}

.hero {
  position: relative;
  z-index: 10;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 5.5rem 2rem 3rem;
}

.hero-inner {
  max-width: 760px;
  width: 100%;
  margin: 0 auto;
}

.hero-copy {
  animation: rise 0.9s ease both;
}

.hero-kicker {
  display: flex;
  align-items: center;
  margin: 0 0 1rem;
  font-size: 0.6875rem;
  letter-spacing: 0.28em;
  color: #6a9098;
}

.hero-title {
  margin: 0;
  font-size: clamp(2.75rem, 7vw, 4.75rem);
  font-weight: 700;
  line-height: 1.06;
  letter-spacing: 0.02em;
  background: linear-gradient(135deg, #eef4f8 0%, #8aa8b8 48%, #7a6898 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.hero-subtitle {
  margin: 1rem 0 0.45rem;
  font-size: clamp(1.05rem, 2.2vw, 1.3rem);
  color: rgba(220, 232, 240, 0.9);
}

.hero-tagline {
  margin: 0 0 2rem;
  max-width: 30rem;
  line-height: 1.75;
  color: rgba(220, 232, 240, 0.52);
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.85rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.78rem 1.65rem;
  border-radius: 999px;
  font-size: 0.875rem;
  letter-spacing: 0.04em;
  text-decoration: none;
  transition: transform 0.2s, background 0.2s, border-color 0.2s;
}

.btn:hover {
  transform: translateY(-2px);
}

.btn-primary {
  color: #eef4f8;
  font-weight: 600;
  background: linear-gradient(135deg, rgba(42, 104, 120, 0.95), rgba(58, 72, 104, 0.95));
  border: 1px solid rgba(138, 180, 196, 0.25);
}

.btn-primary i {
  font-style: normal;
  transition: transform 0.2s;
}

.btn-primary:hover i {
  transform: translateX(3px);
}

.btn-ghost {
  color: rgba(220, 232, 240, 0.78);
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
}

.hero-hud {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  animation: rise 0.9s 0.15s ease both;
}

.hud-card {
  padding: 1rem 1.1rem;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(6, 12, 20, 0.55);
  backdrop-filter: blur(12px);
}

.hud-label {
  margin: 0 0 0.75rem;
  font-size: 0.625rem;
  letter-spacing: 0.22em;
  color: #6a8898;
}

.hud-stats {
  margin: 0;
  padding: 0;
  list-style: none;
}

.hud-stats li {
  display: flex;
  justify-content: space-between;
  padding: 0.28rem 0;
  font-size: 0.8125rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.hud-stats span {
  color: rgba(220, 232, 240, 0.45);
}

.hud-stats strong {
  color: #9ab8c8;
  font-weight: 500;
}

.hud-bar {
  margin-top: 0.85rem;
  height: 4px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  overflow: hidden;
}

.hud-bar i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #3a7888, #6a88a8);
  transition: width 0.2s ease;
}

.hud-foot {
  margin: 0.45rem 0 0;
  font-size: 0.6875rem;
  color: rgba(154, 184, 200, 0.75);
}

.hud-card--mini .coord-line {
  margin: 0.15rem 0;
  font-size: 0.8125rem;
  font-family: ui-monospace, 'SF Mono', monospace;
  color: #8ab0bc;
}

.scroll-hint {
  position: absolute;
  left: 50%;
  bottom: 1.5rem;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  color: rgba(220, 232, 240, 0.38);
  text-decoration: none;
  font-size: 0.6875rem;
  letter-spacing: 0.16em;
  animation: float 2.4s ease-in-out infinite;
}

.scroll-hint i {
  font-style: normal;
}

@keyframes float {
  0%,
  100% {
    transform: translateX(-50%) translateY(0);
  }
  50% {
    transform: translateX(-50%) translateY(6px);
  }
}

@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(24px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.portals {
  position: relative;
  z-index: 10;
  padding: 4rem 2rem;
  max-width: 1100px;
  margin: 0 auto;
}

.section-head {
  margin-bottom: 1.5rem;
  text-align: center;
}

.section-head--left {
  text-align: left;
  max-width: 960px;
  margin-left: auto;
  margin-right: auto;
}

.section-kicker {
  margin: 0 0 0.45rem;
  font-size: 0.6875rem;
  letter-spacing: 0.24em;
  color: #6a8898;
}

.section-head h2 {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 600;
}

.portal-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1rem;
}

.portal-card {
  position: relative;
  padding: 1.5rem;
  border-radius: 16px;
  text-decoration: none;
  color: inherit;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(6, 12, 20, 0.62);
  backdrop-filter: blur(10px);
  overflow: hidden;
  transition: transform 0.25s, border-color 0.25s, background 0.25s;
}

.portal-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(58, 120, 136, 0.12), transparent 55%);
  opacity: 0;
  transition: opacity 0.25s;
}

.portal-card:hover {
  transform: translateY(-4px);
  border-color: rgba(138, 180, 196, 0.28);
  background: rgba(8, 16, 26, 0.78);
}

.portal-card:hover::before {
  opacity: 1;
}

.portal-code {
  display: inline-block;
  margin-bottom: 0.85rem;
  font-size: 0.625rem;
  letter-spacing: 0.18em;
  color: #6a8898;
}

.portal-card h3 {
  margin: 0 0 0.55rem;
  font-size: 1.25rem;
}

.portal-card p {
  margin: 0;
  line-height: 1.65;
  color: rgba(220, 232, 240, 0.58);
}

.portal-link {
  display: inline-block;
  margin-top: 1.15rem;
  font-size: 0.8125rem;
  color: #8ab4c4;
}

.panel-section {
  position: relative;
  z-index: 10;
  padding: 3rem 2rem 4rem;
}

.glass-panel {
  max-width: 960px;
  margin: 0 auto;
  padding: 1.75rem;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(6, 12, 20, 0.62);
  backdrop-filter: blur(12px);
}

.reveal {
  animation: rise 0.8s ease both;
}

.panel-label {
  margin: 0 0 0.75rem;
  font-size: 0.6875rem;
  letter-spacing: 0.22em;
  color: #6a7888;
}

.glass-panel h2,
.glass-panel h3 {
  margin: 0 0 0.85rem;
  font-weight: 600;
}

.glass-panel h2 {
  font-size: 1.5rem;
}

.glass-panel p {
  margin: 0;
  line-height: 1.8;
  color: rgba(220, 232, 240, 0.62);
}

.works-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1rem;
  max-width: 960px;
  margin: 0 auto;
}

.work-card:hover {
  border-color: rgba(138, 180, 196, 0.18);
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-top: 1rem;
}

.tags span {
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  font-size: 0.6875rem;
  color: #7a98a8;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
}

.contact-panel {
  text-align: center;
}

.contact-links {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 1.5rem;
  margin-top: 1.15rem;
}

.contact-links a {
  color: #8ab4c4;
  text-decoration: none;
}

.footer {
  position: relative;
  z-index: 10;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.75rem;
  padding: 2rem;
  font-size: 0.75rem;
  letter-spacing: 0.1em;
  color: rgba(220, 232, 240, 0.32);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(3, 6, 12, 0.88);
}

.footer-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #4a8898;
}

@media (max-width: 860px) {
  .hero-inner {
    grid-template-columns: 1fr;
  }

  .hero-hud {
    flex-direction: row;
    flex-wrap: wrap;
  }

  .hud-card {
    flex: 1;
    min-width: 220px;
  }
}

@media (max-width: 640px) {
  .nav {
    padding: 0.85rem 1.15rem;
  }

  .nav-links {
    gap: 0.85rem;
  }

  .nav-links a:not(.nav-cta) {
    display: none;
  }

  .hero {
    padding: 5rem 1.15rem 3rem;
  }

  .portals,
  .panel-section {
    padding-left: 1.15rem;
    padding-right: 1.15rem;
  }
}
</style>
