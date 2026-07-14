<template>
  <div class="layout-tool">
    <header class="layout-tool__header">
      <div class="layout-tool__bar">
        <NuxtLink to="/" class="layout-tool__brand">
          <span class="layout-tool__brand-dot" />
          {{ config.public.siteName }}
        </NuxtLink>
        <nav class="layout-tool__nav">
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
  @apply flex min-h-dvh flex-col bg-ink-950 text-slate-200;
  background-image:
    radial-gradient(ellipse 70% 50% at 20% 0%, rgba(110, 200, 232, 0.08), transparent 55%),
    radial-gradient(ellipse 60% 40% at 90% 100%, rgba(60, 120, 150, 0.06), transparent 50%);

  &__header {
    @apply sticky top-0 z-20 border-b border-white/5 px-4 py-3 sm:px-6;
    background: rgba(3, 8, 14, 0.85);
    backdrop-filter: blur(10px);
    padding-top: calc(0.75rem + env(safe-area-inset-top, 0px));
  }

  &__bar {
    @apply mx-auto flex max-w-7xl items-center justify-between;
  }

  &__brand {
    @apply flex items-center gap-2.5 text-sm font-semibold tracking-[0.08em] text-slate-200;
  }

  &__brand-dot {
    @apply size-1.5 rounded-full bg-cyan-soft;
  }

  &__nav {
    @apply font-mono text-[0.75rem] uppercase tracking-[0.14em] text-slate-400;

    a {
      @apply transition hover:text-cyan-soft;
    }
  }

  &__main {
    @apply mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8;
  }

  &__footer {
    @apply flex flex-wrap items-center justify-center gap-2 border-t border-white/5 px-4 py-3 text-[0.65rem] tracking-wider text-slate-500;
    padding-bottom: calc(0.75rem + env(safe-area-inset-bottom, 0px));
  }

  &__dot {
    @apply size-1 rounded-full bg-cyan-mist/40;
  }
}
</style>
