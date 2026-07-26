<template>
  <NuxtLayout>
    <!-- 允许页面 definePageMeta({ keepalive }) 生效（组态大屏切页不丢实例） -->
    <NuxtPage :keepalive="{ max: 8 }" />
  </NuxtLayout>
</template>
