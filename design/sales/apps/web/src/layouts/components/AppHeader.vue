<script setup lang="ts">
import { Bell, Expand, Fold } from '@element-plus/icons-vue'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { findMenuTitle } from '../menu.config'
import { DEMO_ROLES } from '@/composables/use-permission'
import { useAuthStore } from '@/stores/auth.store'
import { useRoleStore } from '@/stores/role.store'

defineProps<{ collapsed: boolean; alertCount: number }>()
const emit = defineEmits<{ toggle: []; 'open-alerts': [] }>()

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const roleStore = useRoleStore()

const currentTitle = computed(() => findMenuTitle(route.path) || (route.meta.title as string) || '')

async function signOut(): Promise<void> {
  await authStore.logout()
  await router.push({ name: 'login' })
}
</script>

<template>
  <header class="app-header">
    <div class="app-header__left">
      <el-button text :icon="collapsed ? Expand : Fold" @click="emit('toggle')" />
      <el-breadcrumb separator="/">
        <el-breadcrumb-item>业务部</el-breadcrumb-item>
        <el-breadcrumb-item>{{ currentTitle }}</el-breadcrumb-item>
      </el-breadcrumb>
    </div>

    <div class="app-header__right">
      <el-badge :value="alertCount" :hidden="!alertCount" class="app-header__bell">
        <el-button text :icon="Bell" @click="emit('open-alerts')" />
      </el-badge>

      <el-select
        :model-value="roleStore.code"
        class="app-header__role"
        size="small"
        @change="roleStore.switchTo"
      >
        <template #prefix><span class="app-header__role-label">当前角色</span></template>
        <el-option v-for="item in DEMO_ROLES" :key="item.code" :value="item.code" :label="item.name">
          <div class="role-option">
            <span class="role-option__name">{{ item.name }}</span>
            <span class="role-option__hint">{{ item.hint }}</span>
          </div>
        </el-option>
      </el-select>

      <el-tooltip
        v-if="authStore.user?.userCode"
        :content="`唯一编码 ${authStore.user.userCode}（终身不变，单据与留痕关联此编码）· 登录用户名 ${authStore.user.account}`"
        placement="bottom"
      >
        <span class="app-header__user">
          {{ roleStore.current.name.split('·')[1]?.trim() ?? authStore.user?.displayName }}
          <em>{{ roleStore.current.department }} · {{ authStore.user.userCode }}</em>
        </span>
      </el-tooltip>

      <el-button link type="primary" @click="signOut">退出</el-button>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: space-between;
  height: 56px;
  padding: 0 20px 0 8px;
  background: #fff;
  border-bottom: 1px solid var(--wfx-border);
}

.app-header__left,
.app-header__right {
  display: flex;
  gap: 14px;
  align-items: center;
}

.app-header__user {
  font-size: 13px;
  color: var(--wfx-text);
}

.app-header__user em {
  margin-left: 6px;
  font-size: 12px;
  font-style: normal;
  color: var(--wfx-text-muted);
}

.app-header__bell {
  margin-right: 4px;
}

.app-header__role {
  width: 260px;
}

.app-header__role-label {
  font-size: 12px;
  color: var(--wfx-text-muted);
}

.role-option {
  display: flex;
  flex-direction: column;
  padding: 4px 0;
  line-height: 1.5;
}

.role-option__name {
  font-size: 13px;
  color: var(--wfx-text-strong);
}

.role-option__hint {
  font-size: 11.5px;
  color: var(--wfx-text-muted);
}
</style>
