<template>
  <div class="layout-default">
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
