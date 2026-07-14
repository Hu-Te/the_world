# 工具站

浏览器端实用工具网站（Nuxt 3 + Three.js 氛围 + Tailwind）。

## 目录结构

```
├── assets/css/          # 全局样式
├── components/
│   ├── ui/              # 原子 UI
│   └── web3d/           # 首页氛围画布外壳
├── layouts/             # 布局
├── pages/               # 路由页面
├── public/              # 静态资源
├── server/              # Nuxt server 路由
├── stores/              # Pinia 扁平状态（按需）
├── types/               # 共享 TS 类型
├── utils/web3d/         # HomeHeroManager 等纯 TS
├── deploy/              # Nginx 与部署文档
├── scripts/             # nvm 启动、gulp 部署
└── nuxt.config.ts
```

## 本地开发

包管理器：**Yarn 1**（`packageManager: yarn@1.22.22`）。请勿混用 `npm install`。

```bash
nvm use        # Node 24
yarn
yarn dev       # http://localhost:3000
```

| 命令 | 说明 |
|------|------|
| `yarn lint` | ESLint |
| `yarn typecheck` | TypeScript 检查 |
| `yarn build` | 静态生成 → `.output/public` |
| `yarn deploy` | 上传生产环境 |

## SFC 约定

1. `<template>`  
2. `<script setup lang="ts">`  
3. `<style scoped lang="scss">`

## 架构红线

Three.js 实例不得进入 `ref` / `reactive` / Pinia；见 `.cursorrules`。

## 部署

产物目录：`.output/public`。服务器约定见 `deploy/README.md`。
