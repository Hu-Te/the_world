
import { createRouter, createWebHistory } from 'vue-router'


const router = createRouter({
    history: createWebHistory(),
    routes: [
        {
            path: '/',
            component: () => import('@/views/home/index.vue'),
        },
        {
            path: '/game',
            component: () => import('@/views/game/index.vue'),
        },
        {
            path: '/world',
            component: () => import('@/views/world/index.vue'),
        },
        {
            path: '/draw',
            component: () => import('@/views/draw/index.vue'),
        },
        /** 旧版首页，布局重设计前备份 */
        {
            path: '/legacy/home',
            component: () => import('@/views/_legacy/home-full.vue'),
        },
    ],
    scrollBehavior() {
        return { top: 0, left: 0 }
    },
})

export default router