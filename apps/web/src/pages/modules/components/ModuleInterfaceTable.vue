<script setup lang="ts">
import type { ModuleInterface } from '../module-catalog'

defineProps<{ rows: ModuleInterface[] }>()

const DIRECTION = {
  in: { label: '入', type: 'success' as const },
  out: { label: '出', type: 'warning' as const },
}
</script>

<template>
  <el-table :data="rows" style="width: 100%">
    <el-table-column label="方向" width="80" align="center">
      <template #default="{ row }">
        <el-tag :type="DIRECTION[row.direction as 'in' | 'out'].type" size="small" effect="plain">
          {{ DIRECTION[row.direction as 'in' | 'out'].label }}
        </el-tag>
      </template>
    </el-table-column>
    <el-table-column prop="party" label="对接部门" width="130" />
    <el-table-column prop="subject" label="交换的数据" min-width="320" />
  </el-table>
</template>
