<template>
  <div class="layout-tool">
    <div class="layout-tool__atmosphere" aria-hidden="true">
      <span class="layout-tool__orb layout-tool__orb--a" />
      <span class="layout-tool__orb layout-tool__orb--b" />
      <span class="layout-tool__grid" />
      <span class="layout-tool__scan" />
    </div>

    <header class="layout-tool__header">
      <div class="layout-tool__bar">
        <NuxtLink to="/" class="layout-tool__brand">
          <span class="layout-tool__brand-dot" />
          {{ config.public.siteName }}
        </NuxtLink>
        <nav class="layout-tool__nav">
          <IamHomeAuthEntry inline />
          <NuxtLink to="/">首页</NuxtLink>
        </nav>
      </div>
    </header>

    <main class="layout-tool__main">
      <slot />
    </main>

    <footer class="layout-tool__footer">
      <span>© {{ year }} {{ config.public.siteName }}</span>
      <span class="layout-tool__dot" />
      <a
        :href="config.public.icpUrl"
        target="_blank"
        rel="noopener noreferrer">
        {{ config.public.icp }}
      </a>
    </footer>
  </div>
</template>

<script setup lang="ts">
const config = useRuntimeConfig()
const year = new Date().getFullYear()
</script>

<style scoped lang="scss">
.layout-tool {
  position: relative;
  display: flex;
  min-height: 100dvh;
  flex-direction: column;
  overflow: hidden;
  color: #e2e8f0;
  background: #03060c;
}

.layout-tool__atmosphere {
  pointer-events: none;
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
}

.layout-tool__orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(64px);
  opacity: 0.55;
  animation: tool-orb 18s ease-in-out infinite;

  &--a {
    top: -12%;
    left: -8%;
    width: 42vw;
    height: 42vw;
    max-width: 520px;
    max-height: 520px;
    background: radial-gradient(circle, rgba(110, 200, 232, 0.28), transparent 68%);
  }

  &--b {
    right: -10%;
    bottom: -18%;
    width: 48vw;
    height: 48vw;
    max-width: 560px;
    max-height: 560px;
    background: radial-gradient(circle, rgba(34, 120, 150, 0.22), transparent 70%);
    animation-delay: -7s;
    animation-direction: reverse;
  }
}

.layout-tool__grid {
  position: absolute;
  inset: 0;
  opacity: 0.22;
  background-image:
    linear-gradient(rgba(110, 200, 232, 0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(110, 200, 232, 0.06) 1px, transparent 1px);
  background-size: 48px 48px;
  mask-image: radial-gradient(ellipse 80% 70% at 50% 30%, #000 20%, transparent 75%);
}

.layout-tool__scan {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    transparent 0%,
    rgba(110, 200, 232, 0.035) 48%,
    transparent 52%
  );
  background-size: 100% 220%;
  animation: tool-scan 9s linear infinite;
  opacity: 0.7;
}

.layout-tool__header {
  position: sticky;
  top: 0;
  z-index: 20;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  padding: 0.75rem 1rem;
  padding-top: calc(0.75rem + env(safe-area-inset-top, 0px));
  background: rgba(3, 8, 14, 0.72);
  backdrop-filter: blur(16px) saturate(1.2);
  animation: tool-in 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;

  @media (min-width: 640px) {
    padding-left: 1.5rem;
    padding-right: 1.5rem;
  }
}

.layout-tool__bar {
  display: flex;
  max-width: 80rem;
  margin: 0 auto;
  align-items: center;
  justify-content: space-between;
}

.layout-tool__brand {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  font-size: 0.9rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  color: #e2e8f0;
  text-decoration: none;
  transition: color 0.2s;

  &:hover {
    color: #a5f3fc;
  }
}

.layout-tool__brand-dot {
  width: 0.4rem;
  height: 0.4rem;
  border-radius: 999px;
  background: #6ec8e8;
  box-shadow: 0 0 10px rgba(110, 200, 232, 0.85);
  animation: tool-pulse 2.4s ease-in-out infinite;
}

.layout-tool__nav {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  font-family: ui-monospace, 'IBM Plex Mono', monospace;
  font-size: 0.72rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #94a3b8;

  a {
    color: inherit;
    text-decoration: none;
    transition: color 0.2s;

    &:hover {
      color: #6ec8e8;
    }
  }
}

:deep(.iam-entry) {
  position: static;
  inset: auto;
}

.layout-tool__main {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 80rem;
  flex: 1;
  margin: 0 auto;
  padding: 1.5rem 1rem 2rem;

  @media (min-width: 640px) {
    padding: 2rem 1.5rem 2.5rem;
  }
}

.layout-tool__footer {
  position: relative;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  padding: 0.75rem 1rem;
  padding-bottom: calc(0.75rem + env(safe-area-inset-bottom, 0px));
  font-size: 0.65rem;
  letter-spacing: 0.08em;
  color: #64748b;

  a {
    color: inherit;
    text-decoration: none;
    transition: color 0.2s;

    &:hover {
      color: #8ab4c4;
    }
  }
}

.layout-tool__dot {
  width: 0.25rem;
  height: 0.25rem;
  border-radius: 999px;
  background: rgba(138, 180, 196, 0.45);
}

@keyframes tool-orb {
  0%,
  100% {
    transform: translate(0, 0) scale(1);
  }
  50% {
    transform: translate(3%, 4%) scale(1.08);
  }
}

@keyframes tool-scan {
  0% {
    background-position: 0 -40%;
  }
  100% {
    background-position: 0 140%;
  }
}

@keyframes tool-pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.55;
    transform: scale(0.85);
  }
}

@keyframes tool-in {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .layout-tool__orb,
  .layout-tool__scan,
  .layout-tool__brand-dot,
  .layout-tool__header {
    animation: none;
  }
}
</style>
