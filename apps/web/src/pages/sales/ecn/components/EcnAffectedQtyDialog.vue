<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { AffectedQtyPayload } from './ecn-affected-qty-payload'
import type { EngineeringChange } from '@/types/sales.types'

/**
 * PMC 清点已投产数量（业务规格第 6 章新增规则）。
 *
 * 计数口径只有一条，写在弹窗顶上而不是藏进帮助里：
 * **只要生产（车床/CNC）动了，就计入受影响数量；尚未上机的料不计。**
 * MES 未上线，这一步是人工清点后录入，因此谁录的、何时录的都要留痕。
 *
 * 允许多行是因为一张 ECN 常常牵动同族的几个件号（外壳与压盖同图改），
 * 而返工是按件号拆工单的——合成一个总数，车间无从拆。
 */
const props = defineProps<{
  modelValue: boolean
  change: EngineeringChange | null
  busy: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: [payload: AffectedQtyPayload]
}>()

interface Row {
  productName: string
  drawingNo: string
  affectedQty: string
  note: string
}

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const rows = ref<Row[]>([])

/**
 * 打开时带出已录的行；一条都没有就用本单的产品/图号起一行——
 * 绝大多数变更只牵动它自己，让人从空表开始只是多两次输入。
 */
watch(visible, (open) => {
  if (!open) return
  const saved = props.change?.affectedLines ?? []
  rows.value = saved.length
    ? saved.map((line) => ({
        productName: line.productName,
        drawingNo: line.drawingNo,
        affectedQty: line.affectedQty,
        note: line.note ?? '',
      }))
    : [
        {
          productName: props.change?.productName ?? '',
          drawingNo: props.change?.drawingNo ?? '',
          affectedQty: '',
          note: '',
        },
      ]
})

/** 数量必须是非负定点数——与服务端 DTO 上那条正则同一个口径。 */
const QTY_PATTERN = /^\d+(\.\d{1,6})?$/

const invalid = computed(() =>
  rows.value.some(
    (row) =>
      row.productName.trim() === '' ||
      row.drawingNo.trim() === '' ||
      !QTY_PATTERN.test(row.affectedQty.trim()),
  ),
)

/** 展示用合计。落到 Number 只为看一眼总量，提交出去的仍是每行的定点字符串。 */
const total = computed(() =>
  rows.value.reduce(
    (sum, row) => sum + (QTY_PATTERN.test(row.affectedQty.trim()) ? Number(row.affectedQty) : 0),
    0,
  ),
)

function addRow(): void {
  rows.value.push({ productName: '', drawingNo: '', affectedQty: '', note: '' })
}

function removeRow(index: number): void {
  rows.value.splice(index, 1)
}

function confirm(): void {
  if (invalid.value || rows.value.length === 0) return
  emit('confirm', {
    lines: rows.value.map((row) => ({
      productName: row.productName.trim(),
      drawingNo: row.drawingNo.trim(),
      affectedQty: row.affectedQty.trim(),
      note: row.note.trim() || null,
    })),
  })
}
</script>

<template>
  <el-dialog v-model="visible" title="录入受影响数量（PMC 清点）" width="860px">
    <el-alert
      class="dialog-alert"
      type="warning"
      :closable="false"
      show-icon
      title="计数口径：只要生产（车床/CNC）动了，就计入受影响数量"
      description="尚未上机的料不计入——它按新图做即可，不构成返工。返工一经发起，这里的数量即锁死，届时如需调整只能另开一张变更单。"
    />

    <el-table :data="rows" size="small" border>
      <el-table-column label="产品名称" min-width="200">
        <template #default="{ row }">
          <el-input v-model="row.productName" size="small" placeholder="如 连接器外壳 CNC 件" />
        </template>
      </el-table-column>
      <el-table-column label="图号" width="160">
        <template #default="{ row }">
          <el-input v-model="row.drawingNo" size="small" placeholder="如 HS-4471-A" />
        </template>
      </el-table-column>
      <el-table-column label="已投产数量" width="150">
        <template #default="{ row }">
          <el-input v-model="row.affectedQty" size="small" placeholder="如 320" />
        </template>
      </el-table-column>
      <el-table-column label="备注" min-width="200">
        <template #default="{ row }">
          <el-input v-model="row.note" size="small" placeholder="如 车床已开粗" />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="70" align="center">
        <template #default="{ $index }">
          <el-button link type="danger" :disabled="rows.length <= 1" @click="removeRow($index)">
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="toolbar">
      <el-button size="small" @click="addRow">增加一行</el-button>
      <span class="total">合计已投产：{{ total }}</span>
    </div>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="busy" :disabled="invalid" @click="confirm">
        {{ invalid ? '产品、图号必填，数量须为非负数' : '保存清点结果' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.dialog-alert {
  margin-bottom: 12px;
}

.toolbar {
  display: flex;
  gap: 14px;
  align-items: center;
  margin-top: 12px;
}

.total {
  font-size: 13px;
  color: var(--wfx-text-strong);
}
</style>
