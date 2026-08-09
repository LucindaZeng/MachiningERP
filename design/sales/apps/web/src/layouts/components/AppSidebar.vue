<script setup lang="ts">
import { useRoute } from 'vue-router'

import { MENU_GROUPS } from '../menu.config'
import logoWhite from '@/assets/brand/wanfuxin-logo-stacked-white.png'

defineProps<{ collapsed: boolean }>()

const route = useRoute()
</script>

<template>
  <aside class="app-sidebar" :class="{ 'is-collapsed': collapsed }">
    <div class="app-sidebar__brand">
      <img :src="logoWhite" alt="东莞市万富鑫智能装备有限公司" />
    </div>

    <nav class="app-sidebar__nav">
      <template v-for="group in MENU_GROUPS" :key="group.title">
        <p v-if="!collapsed" class="app-sidebar__group">{{ group.title }}</p>

        <template v-for="item in group.items" :key="item.path">
          <span v-if="group.disabled" class="app-sidebar__item is-disabled" :title="item.title">
            <i class="app-sidebar__dot" aria-hidden="true"></i>
            <span v-if="!collapsed">{{ item.title }}</span>
          </span>

          <router-link
            v-else
            class="app-sidebar__item"
            :class="{ 'is-active': route.path === item.path }"
            :to="item.path"
            :title="item.code ? `${item.title}（${item.code}）` : item.title"
          >
            <i class="app-sidebar__dot" aria-hidden="true"></i>
            <span v-if="!collapsed">{{ item.title }}</span>
          </router-link>
        </template>
      </template>
    </nav>
  </aside>
</template>

<style scoped>
.app-sidebar {
  display: flex;
  flex: none;
  flex-direction: column;
  width: 252px;
  height: 100vh;
  overflow-y: auto;
  background: linear-gradient(180deg, #0b357b 0%, #072451 100%);
  transition: width 0.2s ease;
}

.app-sidebar.is-collapsed {
  width: 64px;
}

.app-sidebar__brand {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 22px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.app-sidebar__brand img {
  width: 100%;
  max-width: 228px;
  height: auto;
}

.is-collapsed .app-sidebar__brand img {
  width: 42px;
  max-width: none;
}

.app-sidebar__nav {
  padding: 12px 10px 24px;
}

.app-sidebar__group {
  margin: 14px 8px 6px;
  font-size: 11px;
  letter-spacing: 1px;
  color: rgba(255, 255, 255, 0.42);
}

.app-sidebar__item {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 9px 12px;
  margin-bottom: 2px;
  font-size: 13.5px;
  color: rgba(255, 255, 255, 0.8);
  border-radius: 8px;
  transition: background 0.15s ease;
}

.app-sidebar__item:hover {
  background: rgba(255, 255, 255, 0.08);
}

.app-sidebar__item.is-active {
  font-weight: 600;
  color: #fff;
  background: rgba(223, 145, 30, 0.9);
}

.app-sidebar__item.is-disabled {
  color: rgba(255, 255, 255, 0.32);
  cursor: not-allowed;
}

.app-sidebar__item.is-disabled:hover {
  background: transparent;
}

.app-sidebar__dot {
  flex: none;
  width: 6px;
  height: 6px;
  background: currentcolor;
  border-radius: 50%;
  opacity: 0.7;
}
</style>
