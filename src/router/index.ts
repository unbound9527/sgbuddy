import { createRouter, createMemoryHistory } from 'vue-router'

const router = createRouter({
  history: createMemoryHistory('/'),
  routes: [
    {
      path: '/',
      redirect: '/data',
    },
    {
      path: '/gear',
      name: 'gear',
      component: () => import('@/views/GearCenter.vue'),
    },
    {
      path: '/growth-book',
      name: 'growth-book',
      component: () => import('@/views/GrowthBook.vue'),
    },
    {
      path: '/growth',
      name: 'growth',
      component: () => import('@/views/GrowthTracker.vue'),
    },
    {
      path: '/data',
      name: 'data',
      component: () => import('@/views/DataCenter.vue'),
    },
    {
      path: '/trade-leads',
      name: 'trade-leads',
      component: () => import('@/views/TradeClues.vue'),
    },
    {
      path: '/shop',
      name: 'shop',
      component: () => import('@/views/ShopManager.vue'),
    },
    {
      path: '/guides',
      name: 'guides',
      component: () => import('@/views/GameGuide.vue'),
    },
  ],
})

export default router
