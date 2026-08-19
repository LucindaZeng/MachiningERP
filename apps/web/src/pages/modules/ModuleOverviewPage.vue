<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import ModuleInterfaceTable from './components/ModuleInterfaceTable.vue'
import { findModuleSpec } from './module-catalog'
import PageHeader from '@/components/PageHeader.vue'

const route = useRoute()

const spec = computed(() => findModuleSpec(String(route.meta.moduleKey ?? '')))
</script>

<template>
  <div v-if="spec">
    <PageHeader :title="spec.title" :requirement-code="spec.code" :subtitle="spec.summary">
      <template #actions>
        <el-tag type="info" effect="plain">主责部门：{{ spec.owner }}</el-tag>
      </template>
    </PageHeader>

    <el-card shadow="never" class="block">
      <template #header>
        <div class="block__head">
          <span class="block__title">功能清单</span>
          <span class="block__hint">共 {{ spec.functions.length }} 项，编号与部门需求文档一一对应</span>
        </div>
      </template>

      <el-table :data="spec.functions" style="width: 100%">
        <el-table-column prop="code" label="编号" width="110">
          <template #default="{ row }"><span class="code">{{ row.code }}</span></template>
        </el-table-column>
        <el-table-column prop="title" label="功能" width="190" />
        <el-table-column prop="desc" label="说明" min-width="420" />
      </el-table>
    </el-card>

    <div class="cols">
      <el-card shadow="never">
        <template #header><span class="block__title">关键单据</span></template>
        <ul class="docs">
          <li v-for="item in spec.documents" :key="item">{{ item }}</li>
        </ul>
      </el-card>

      <el-card shadow="never">
        <template #header>
          <div class="block__head">
            <span class="block__title">跨部门数据接口</span>
            <span class="block__hint">入 = 上游给本模块，出 = 本模块给下游</span>
          </div>
        </template>
        <ModuleInterfaceTable :rows="spec.interfaces" />
      </el-card>
    </div>
  </div>

  <el-empty v-else description="未找到该模块" />
</template>

<style scoped>
.block {
  margin-bottom: 16px;
}

.block__head {
  display: flex;
  gap: 12px;
  align-items: baseline;
  justify-content: space-between;
}

.block__title {
  font-size: 14.5px;
  font-weight: 600;
  color: var(--wfx-text-strong);
}

.block__hint {
  font-size: 12px;
  color: var(--wfx-text-muted);
}

.code {
  font-weight: 600;
  color: var(--wfx-navy);
}

.cols {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 16px;
}

.docs {
  padding: 0;
  margin: 0;
  list-style: none;
}

.docs li {
  padding: 9px 0 9px 16px;
  font-size: 13.5px;
  color: var(--wfx-text);
  border-bottom: 1px dashed var(--el-border-color-lighter);
}

.docs li:last-child {
  border-bottom: none;
}

.docs li::before {
  margin-left: -16px;
  color: var(--wfx-orange);
  content: '◆ ';
}

@media (max-width: 1400px) {
  .cols {
    grid-template-columns: 1fr;
  }
}
</style>
