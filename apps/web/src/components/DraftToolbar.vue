<script setup lang="ts" generic="T extends object">
import { ArrowDown, Delete, DocumentAdd, FolderOpened } from '@element-plus/icons-vue'

import type { FormDraft } from '@/composables/use-form-draft'

defineProps<{
  drafts: FormDraft<T>[]
  lastSavedAt?: string
}>()

const emit = defineEmits<{
  save: []
  load: [FormDraft<T>]
  remove: [FormDraft<T>]
}>()
</script>

<template>
  <div class="draft-toolbar">
    <el-button :icon="DocumentAdd" @click="emit('save')">保存草稿</el-button>

    <el-dropdown trigger="click" :disabled="!drafts.length">
      <el-button :icon="FolderOpened" :disabled="!drafts.length">
        调用草稿（{{ drafts.length }}）<el-icon class="draft-toolbar__arrow"><ArrowDown /></el-icon>
      </el-button>

      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item v-for="draft in drafts" :key="draft.id">
            <div class="draft-item">
              <span class="draft-item__main" @click="emit('load', draft)">
                <b>{{ draft.name }}</b>
                <em>{{ draft.savedAt }}</em>
              </span>
              <el-button
                link
                type="danger"
                :icon="Delete"
                class="draft-item__remove"
                @click.stop="emit('remove', draft)"
              />
            </div>
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>

    <span v-if="lastSavedAt" class="draft-toolbar__hint">已于 {{ lastSavedAt }} 存草稿</span>
  </div>
</template>

<style scoped>
.draft-toolbar {
  display: flex;
  gap: 10px;
  align-items: center;
}

.draft-toolbar__arrow {
  margin-left: 4px;
}

.draft-toolbar__hint {
  font-size: 12px;
  color: var(--wfx-text-muted);
}

.draft-item {
  display: flex;
  gap: 16px;
  align-items: center;
  min-width: 240px;
}

.draft-item__main {
  display: flex;
  flex: 1;
  flex-direction: column;
  cursor: pointer;
}

.draft-item__main b {
  font-size: 13px;
  color: var(--wfx-text-strong);
}

.draft-item__main em {
  font-size: 11.5px;
  font-style: normal;
  color: var(--wfx-text-muted);
}

.draft-item__remove {
  flex: none;
}
</style>
