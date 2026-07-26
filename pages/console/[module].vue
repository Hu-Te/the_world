<template>
  <div class="console-mod">
    <header class="console-mod__head">
      <p class="console-mod__eyebrow">系统管理平台 · {{ meta.code }}</p>
      <h1 class="console-mod__title">{{ meta.name }}</h1>
      <p class="console-mod__lead">平台侧子系统占位。请从控制台进入已上线模块。</p>
    </header>
    <div class="console-mod__actions">
      <button type="button" class="console-mod__btn" @click="router.push('/console')">返回控制台</button>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })

const route = useRoute()
const router = useRouter()

const MODULE_META: Record<string, { code: string; name: string; redirect?: string }> = {
  fieldpulse: { code: 'FIELDPULSE', name: 'PLC 数据管控中心', redirect: '/console/fieldpulse' },
  finance: { code: 'FINANCE', name: '财务审计' },
  pack3d: { code: 'PACK3D', name: '包装设计' },
}

const slug = computed(() => String(route.params.module || ''))
const meta = computed(() => MODULE_META[slug.value] ?? { code: slug.value.toUpperCase(), name: '未知模块' })

onMounted(() => {
  const m = MODULE_META[slug.value]
  if (m?.redirect) {
    navigateTo(m.redirect)
    return
  }
  if (!m) navigateTo('/console')
})
</script>

<style scoped lang="scss">
.console-mod {
  min-height: 100vh;
  padding: 2.5rem 1.5rem;
  background: #030812;
  color: #e2e8f0;
}
.console-mod__eyebrow {
  margin: 0 0 0.45rem;
  font-family: ui-monospace, 'IBM Plex Mono', monospace;
  font-size: 0.65rem;
  letter-spacing: 0.18em;
  color: rgba(110, 200, 232, 0.85);
}
.console-mod__title {
  margin: 0;
  font-size: 1.5rem;
}
.console-mod__lead {
  margin: 0.7rem 0 0;
  color: #94a3b8;
}
.console-mod__btn {
  margin-top: 1.25rem;
  border-radius: 0.45rem;
  border: 1px solid rgba(110, 200, 232, 0.4);
  background: rgba(110, 200, 232, 0.12);
  padding: 0.65rem 1rem;
  color: #ecfeff;
  cursor: pointer;
}
</style>
