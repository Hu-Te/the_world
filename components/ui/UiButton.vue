<template>
  <button :type="type" :disabled="disabled" class="ui-button" :class="[`ui-button--${variant}`]">
    <slot />
  </button>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'primary' | 'ghost' | 'outline'
    type?: 'button' | 'submit' | 'reset'
    disabled?: boolean
  }>(),
  {
    variant: 'primary',
    type: 'button',
    disabled: false,
  },
)
</script>

<style scoped lang="scss">
.ui-button {
  @apply inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40;

  &--primary {
    @apply bg-gradient-to-br from-cyan-soft to-sky-600 text-ink-950 shadow-lg shadow-cyan-900/30 hover:brightness-110;
  }

  &--outline {
    @apply border border-white/15 bg-white/5 text-slate-200 hover:border-cyan-soft/40 hover:bg-white/10;
  }

  &--ghost {
    @apply text-slate-300 hover:bg-white/5 hover:text-white;
  }
}
</style>
