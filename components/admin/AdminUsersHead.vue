<template>
  <header class="admin-users__head admin-users__anim" style="--d: 0ms">
    <div class="admin-users__intro">
      <p class="admin-users__eyebrow">
        <span class="admin-users__live" aria-hidden="true" />
        管理后台 · 用户
      </p>
      <h1 class="admin-users__title">用户与额度</h1>
      <p class="admin-users__lead">
        仅平台超管可建号。每个用户独立租户；额度按使用天数，到期后无法登录管控系统。
      </p>
    </div>
    <div class="admin-users__actions">
      <button type="button" class="admin-btn admin-btn--primary" @click="emit('create')">
        创建用户
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
const emit = defineEmits<{ create: [] }>()
</script>
