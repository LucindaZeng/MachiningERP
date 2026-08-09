<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
  /** 需求编号，如 ORD-01、QTN-02，便于对照 Word 基线 */
  requirementCode?: string
}>()
</script>

<template>
  <header class="page-header">
    <div>
      <h1 class="page-header__title">
        {{ title }}
        <el-tag v-if="requirementCode" size="small" type="info" effect="plain">
          {{ requirementCode }}
        </el-tag>
      </h1>
      <p v-if="subtitle" class="page-header__subtitle">{{ subtitle }}</p>
    </div>

    <div class="page-header__actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<style scoped>
.page-header {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 18px;
}

.page-header__title {
  display: flex;
  gap: 10px;
  align-items: center;
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: var(--wfx-text-strong);
}

.page-header__subtitle {
  max-width: 900px;
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--wfx-text-muted);
}

.page-header__actions {
  display: flex;
  flex: none;
  gap: 10px;
}
</style>
