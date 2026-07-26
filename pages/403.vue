<template>
  <div class="page-gate">
    <h1>403 无权限</h1>
    <p>当前账号无权访问该系统域页面。</p>
    <NuxtLink to="/">回首页</NuxtLink>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'tool' })
</script>

<style scoped lang="scss">
.page-gate {
  padding: 3rem 1rem;
  text-align: center;
  color: #cbd5e1;
}
a {
  color: #67e8f9;
}
</style>
