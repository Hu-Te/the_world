<template>
  <div class="layout-default">
    <header class="layout-default__header">
      <div class="layout-default__bar">
        <NuxtLink to="/" class="layout-default__brand">
          <span class="layout-default__brand-dot" />
          {{ config.public.siteName }}
        </NuxtLink>

        <nav class="layout-default__nav">
          <NuxtLink to="/">首页</NuxtLink>
        </nav>
      </div>
    </header>

    <main class="layout-default__main">
      <slot />
    </main>

    <footer class="layout-default__footer">
      <p class="layout-default__footer-row">
        <span>© {{ year }} {{ config.public.siteName }}</span>
        <span class="layout-default__footer-dot" />
        <a
          :href="config.public.icpUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="layout-default__icp">
          {{ config.public.icp }}
        </a>
      </p>
    </footer>
  </div>
</template>

<script setup lang="ts">
const config = useRuntimeConfig()
const year = new Date().getFullYear()
</script>

<style scoped lang="scss">
.layout-default {
  @apply relative flex h-dvh max-h-dvh flex-col overflow-hidden;

  /* 透明浮层，不占版、不切断星空 */
  &__header {
    @apply pointer-events-none absolute inset-x-0 top-0 z-[4] px-4 py-3 sm:px-6;
    padding-top: calc(0.75rem + env(safe-area-inset-top, 0px));
    background: transparent;
    border: none;
  }

  &__bar {
    @apply pointer-events-auto mx-auto flex max-w-6xl items-center justify-between gap-4;
  }

  &__brand {
    @apply flex items-center gap-2.5 text-sm font-semibold tracking-[0.08em] text-slate-200/90 transition;
    text-shadow: 0 1px 12px rgba(0, 0, 0, 0.45);

    &:hover {
      @apply text-white;
    }
  }

  &__brand-dot {
    @apply inline-block size-1.5 rounded-full bg-cyan-soft;
    box-shadow: 0 0 8px rgba(110, 200, 232, 0.5);
  }

  &__nav {
    @apply flex items-center gap-5 font-mono text-[0.75rem] uppercase tracking-[0.14em] text-slate-400/80;

    a {
      @apply transition hover:text-cyan-soft;
      text-shadow: 0 1px 10px rgba(0, 0, 0, 0.4);
    }

    .router-link-active {
      @apply text-slate-200/90;
    }
  }

  &__main {
    @apply relative min-h-0 flex-1 overflow-hidden;
  }

  /* 浮在场景上，不单独占条、不切断背景 */
  &__footer {
    @apply pointer-events-none absolute inset-x-0 bottom-0 z-[3] px-4 py-2.5 text-center text-[0.65rem] tracking-wider text-slate-500/70 sm:px-6 sm:text-xs;
    padding-bottom: calc(0.625rem + env(safe-area-inset-bottom, 0px));
    background: transparent;
    border: none;
  }

  &__footer-row {
    @apply pointer-events-auto inline-flex flex-wrap items-center justify-center gap-2;
  }

  &__footer-dot {
    @apply size-1 rounded-full bg-cyan-mist/40;
  }

  &__icp {
    @apply transition hover:text-cyan-mist;
  }
}
</style>
