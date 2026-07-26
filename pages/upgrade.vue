<template>
  <div class="page-gate">
    <h1>需要升级套餐</h1>
    <p>当前租户套餐未解锁该模块。请联系管理员分配 Pro / Enterprise。</p>
    <NuxtLink to="/">回首页</NuxtLink>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'tool' })
</script>

<style scoped>
.page-gate {
  padding: 3rem 1rem;
  text-align: center;
  color: #cbd5e1;
}
a {
  color: #67e8f9;
}
</style>
