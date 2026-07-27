<template>
  <NuxtLayout>
    <!-- 允许页面 definePageMeta({ keepalive }) 生效（组态大屏切页不丢实例） -->
    <NuxtPage :keepalive="{ max: 8 }" />
  </NuxtLayout>

  <!-- 空闲后再挂精灵，避免与首页 Three 抢首屏带宽 -->
  <ClientOnly>
    <component :is="SpriteComp" v-if="spriteReady" track="auto" />
  </ClientOnly>
</template>

<script setup lang="ts">
const spriteReady = ref(false)
const SpriteComp = shallowRef<Component | null>(null)

onMounted(() => {
  const boot = async () => {
    const mod = await import('~/components/sprite/DeepSpaceSprite.vue')
    SpriteComp.value = mod.default
    spriteReady.value = true
  }
  const ric = (window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void }).requestIdleCallback
  if (typeof ric === 'function') {
    ric(() => void boot(), { timeout: 2800 })
  } else {
    window.setTimeout(() => void boot(), 1400)
  }
})
</script>
