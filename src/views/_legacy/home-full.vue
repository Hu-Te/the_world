<template>
  <div class="site">
    <div ref="worldRef" class="site-bg" aria-hidden="true" />
    <div class="site-overlay" aria-hidden="true" />

    <header class="nav">
      <a class="nav-brand" href="#">{{ SITE.name }}</a>
      <nav class="nav-links">
        <a v-for="item in SITE.nav" :key="item.href" :href="item.href">{{ item.label }}</a>
      </nav>
    </header>

    <section class="hero">
      <p class="hero-kicker">Personal Site</p>
      <h1 class="hero-title">{{ SITE.name }}</h1>
      <p class="hero-subtitle">{{ SITE.title }}</p>
      <p class="hero-tagline">{{ SITE.tagline }}</p>
      <div class="hero-actions">
        <RouterLink class="btn btn-primary" to="/world">进入世界</RouterLink>
        <a class="btn btn-ghost" href="#about">了解更多</a>
      </div>
    </section>

    <section id="about" class="section">
      <div class="section-inner">
        <h2 class="section-title">关于</h2>
        <p class="section-text">{{ SITE.description }}</p>
      </div>
    </section>

    <section id="works" class="section section-dark">
      <div class="section-inner">
        <h2 class="section-title">作品</h2>
        <div class="works-grid">
          <article v-for="work in SITE.works" :key="work.title" class="work-card">
            <h3>{{ work.title }}</h3>
            <p>{{ work.desc }}</p>
            <div class="tags">
              <span v-for="tag in work.tags" :key="tag">{{ tag }}</span>
            </div>
          </article>
        </div>
      </div>
    </section>

    <section id="contact" class="section">
      <div class="section-inner contact-inner">
        <h2 class="section-title">联系</h2>
        <p class="section-text">有合作或交流想法，欢迎联系。</p>
        <!--
        <div class="contact-links">
          <a :href="`mailto:${SITE.email}`">{{ SITE.email }}</a>
          <a :href="SITE.github" target="_blank" rel="noopener noreferrer">GitHub</a>
        </div>
        -->
        <RouterLink class="btn btn-primary" to="/world">探索 3D 大世界</RouterLink>
      </div>
    </section>

    <footer class="footer">
      <span>© {{ year }} {{ SITE.name }}</span>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { mountWorld, type WorldHandle } from '@/three'
import { SITE } from '@/config/site'

const worldRef = ref<HTMLDivElement>()
let worldHandle: WorldHandle | null = null
const year = new Date().getFullYear()

onMounted(() => {
  if (worldRef.value) {
    worldHandle = mountWorld(worldRef.value, {
      interactive: false,
      autoRotate: true,
    })
  }
})

onUnmounted(() => {
  worldHandle?.dispose()
  worldHandle = null
})
</script>

<style scoped>
.site {
  position: relative;
  min-height: 100vh;
  color: #f5f0e8;
}

.site-bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}

.site-bg :deep(canvas) {
  display: block;
  width: 100% !important;
  height: 100% !important;
}

.site-overlay {
  position: fixed;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background:
    linear-gradient(180deg, rgba(15, 20, 30, 0.55) 0%, rgba(15, 20, 30, 0.25) 40%, rgba(15, 20, 30, 0.85) 100%),
    radial-gradient(ellipse at 30% 20%, rgba(180, 140, 80, 0.08), transparent 50%);
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
  padding: 1.25rem 2rem;
  backdrop-filter: blur(10px);
  background: rgba(10, 14, 22, 0.35);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.nav-brand {
  font-size: 1.125rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  color: #f5f0e8;
  text-decoration: none;
}

.nav-links {
  display: flex;
  gap: 1.75rem;
}

.nav-links a {
  color: rgba(245, 240, 232, 0.75);
  text-decoration: none;
  font-size: 0.9rem;
  transition: color 0.2s;
}

.nav-links a:hover {
  color: #e8c878;
}

.hero {
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 100vh;
  padding: 6rem 2rem 4rem;
  max-width: 720px;
}

.hero-kicker {
  margin: 0 0 0.75rem;
  font-size: 0.75rem;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: #c9a962;
}

.hero-title {
  margin: 0;
  font-size: clamp(2.75rem, 8vw, 4.5rem);
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: 0.06em;
}

.hero-subtitle {
  margin: 1rem 0 0.5rem;
  font-size: clamp(1rem, 2.5vw, 1.25rem);
  color: rgba(245, 240, 232, 0.85);
}

.hero-tagline {
  margin: 0 0 2.5rem;
  font-size: 1rem;
  color: rgba(245, 240, 232, 0.6);
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.75rem 1.75rem;
  border-radius: 999px;
  font-size: 0.9375rem;
  text-decoration: none;
  transition: transform 0.2s, background 0.2s, border-color 0.2s;
}

.btn:hover {
  transform: translateY(-1px);
}

.btn-primary {
  background: linear-gradient(135deg, #c9a962, #a8843a);
  color: #1a1408;
  font-weight: 600;
  border: none;
}

.btn-primary:hover {
  background: linear-gradient(135deg, #d4b872, #b8924a);
}

.btn-ghost {
  color: #f5f0e8;
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: rgba(255, 255, 255, 0.06);
}

.btn-ghost:hover {
  border-color: rgba(201, 169, 98, 0.6);
  background: rgba(255, 255, 255, 0.1);
}

.section {
  position: relative;
  z-index: 10;
  padding: 5rem 2rem;
}

.section-dark {
  background: rgba(8, 12, 20, 0.72);
  backdrop-filter: blur(8px);
}

.section-inner {
  max-width: 960px;
  margin: 0 auto;
}

.section-title {
  margin: 0 0 1.5rem;
  font-size: 1.75rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: #e8c878;
}

.section-text {
  margin: 0;
  max-width: 640px;
  line-height: 1.85;
  color: rgba(245, 240, 232, 0.78);
  font-size: 1.05rem;
}

.works-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1.25rem;
}

.work-card {
  padding: 1.5rem;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  transition: border-color 0.2s, transform 0.2s;
}

.work-card:hover {
  border-color: rgba(201, 169, 98, 0.35);
  transform: translateY(-2px);
}

.work-card h3 {
  margin: 0 0 0.75rem;
  font-size: 1.125rem;
}

.work-card p {
  margin: 0 0 1rem;
  font-size: 0.9375rem;
  line-height: 1.7;
  color: rgba(245, 240, 232, 0.65);
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.tags span {
  padding: 0.2rem 0.65rem;
  border-radius: 999px;
  font-size: 0.75rem;
  background: rgba(201, 169, 98, 0.15);
  color: #d4b872;
}

.contact-inner {
  text-align: center;
}

.contact-inner .section-text {
  margin: 0 auto 1.5rem;
}

.contact-links {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.contact-links a {
  color: #e8c878;
  text-decoration: none;
  font-size: 1rem;
}

.contact-links a:hover {
  text-decoration: underline;
}

.footer {
  position: relative;
  z-index: 10;
  padding: 2rem;
  text-align: center;
  font-size: 0.8125rem;
  color: rgba(245, 240, 232, 0.4);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(8, 12, 20, 0.85);
}

@media (max-width: 640px) {
  .nav {
    padding: 1rem 1.25rem;
  }

  .nav-links {
    gap: 1rem;
  }

  .hero {
    padding: 5rem 1.25rem 3rem;
  }
}
</style>
