<script setup lang="ts">
import { OfficeBuilding, User } from '@element-plus/icons-vue'

import type { LoginAudience } from '@/types/auth.types'

defineProps<{ modelValue: LoginAudience }>()
const emit = defineEmits<{ 'update:modelValue': [LoginAudience] }>()

const tabs: Array<{ value: LoginAudience; label: string; hint: string }> = [
  { value: 'internal', label: '内部员工', hint: '十部门工作台' },
  { value: 'portal', label: '客户 / 供应商门户', hint: '外部协同账号' },
]

const icons = { internal: User, portal: OfficeBuilding }
</script>

<template>
  <div class="audience-tabs" role="tablist">
    <button
      v-for="tab in tabs"
      :key="tab.value"
      type="button"
      role="tab"
      class="audience-tabs__item"
      :class="{ 'is-active': modelValue === tab.value }"
      :aria-selected="modelValue === tab.value"
      @click="emit('update:modelValue', tab.value)"
    >
      <el-icon class="audience-tabs__icon"><component :is="icons[tab.value]" /></el-icon>
      <span class="audience-tabs__label">{{ tab.label }}</span>
      <span class="audience-tabs__hint">{{ tab.hint }}</span>
    </button>
  </div>
</template>

<style scoped>
.audience-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 24px;
}

.audience-tabs__item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 12px 14px;
  cursor: pointer;
  background: var(--wfx-surface-alt);
  border: 1px solid var(--wfx-border);
  border-radius: var(--wfx-radius-md);
  transition: all 0.18s ease;
}

.audience-tabs__item:hover {
  border-color: var(--el-color-primary-light-5);
}

.audience-tabs__item.is-active {
  background: #fff;
  border-color: var(--wfx-navy);
  box-shadow: 0 0 0 3px rgba(11, 53, 123, 0.1);
}

.audience-tabs__icon {
  color: var(--wfx-text-muted);
  font-size: 16px;
}

.audience-tabs__item.is-active .audience-tabs__icon {
  color: var(--wfx-orange);
}

.audience-tabs__label {
  font-size: 14px;
  font-weight: 600;
  color: var(--wfx-text);
}

.audience-tabs__item.is-active .audience-tabs__label {
  color: var(--wfx-navy);
}

.audience-tabs__hint {
  font-size: 12px;
  color: var(--wfx-text-muted);
}
</style>
