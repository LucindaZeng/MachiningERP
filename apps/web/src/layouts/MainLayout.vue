<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import AppHeader from './components/AppHeader.vue'
import AppSidebar from './components/AppSidebar.vue'

const collapsed = ref(false)
const router = useRouter()

/** 顶栏预警数量：接后端后改为 GET /alerts?level=… 的未关闭条数 */
const alertCount = ref(6)

function openAlerts(): void {
  void router.push('/sales')
}
</script>

<template>
  <div class="main-layout">
    <AppSidebar :collapsed="collapsed" />

    <div class="main-layout__body">
      <AppHeader
        :collapsed="collapsed"
        :alert-count="alertCount"
        @toggle="collapsed = !collapsed"
        @open-alerts="openAlerts"
      />

      <main class="main-layout__content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<style scoped>
.main-layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

.main-layout__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.main-layout__content {
  flex: 1;
  padding: 20px 24px 32px;
  overflow-y: auto;
  background: var(--wfx-surface-alt);
}
</style>
