<script setup lang="ts">
import { CHARGE_MODE, DOC_STATUS, ORDER_TYPE } from '@/components/status-dictionary'
import StatusTag from '@/components/StatusTag.vue'
import { usePermission } from '@/composables/use-permission'

import type { SalesOrder } from '@/types/sales.types'

/**
 * 香港 70% 是独立权限点：无权限者连「×0.7」标记都不能看到，
 * 与 HkPriceBreakdown 一样由组件自己读权限，避免父页逐层透传。
 */
const { canViewHkPrice } = usePermission()

defineProps<{
  rows: SalesOrder[]
  loading: boolean
}>()

const emit = defineEmits<{ detail: [SalesOrder] }>()

/** 整行点击与「详情」按钮都走同一个出口，父页据此打开抽屉 */
function openDetail(row: SalesOrder): void {
  emit('detail', row)
}
</script>

<template>
  <el-table v-loading="loading" :data="rows" style="width: 100%" @row-click="openDetail">
    <el-table-column type="expand">
      <template #default="{ row }">
        <div class="lines">
          <p class="lines__title">
            本单产品明细（共 {{ row.lines?.length ?? 1 }} 项）——一张订单可以下多项产品
          </p>
          <el-table :data="row.lines ?? []" size="small" border style="width: 100%">
            <el-table-column prop="seq" label="#" width="46" align="center" />
            <el-table-column prop="productName" label="产品" min-width="170" />
            <el-table-column prop="drawingNo" label="图号" width="130" />
            <el-table-column prop="itemCode" label="品号" width="150" />
            <el-table-column prop="quantity" label="数量" width="90" align="right" />
            <el-table-column prop="unitPrice" label="单价" width="100" align="right" />
            <el-table-column prop="amount" label="金额" width="110" align="right" />
            <el-table-column prop="deliveryDate" label="行交期" width="115" />
            <el-table-column prop="remark" label="备注" min-width="180" />
          </el-table>
          <el-empty v-if="!row.lines?.length" :image-size="50" description="本单为单产品订单" />
        </div>
      </template>
    </el-table-column>
    <el-table-column prop="docNo" label="订单号" width="170">
      <template #default="{ row }"><span class="doc-no">{{ row.docNo }}</span></template>
    </el-table-column>
    <el-table-column label="订单类型" width="120">
      <template #default="{ row }"><StatusTag :dict="ORDER_TYPE" :value="row.orderType" /></template>
    </el-table-column>
    <el-table-column label="收费方式" width="130">
      <template #default="{ row }">{{ CHARGE_MODE[row.chargeMode] }}</template>
    </el-table-column>
    <el-table-column prop="customerName" label="客户" min-width="150" show-overflow-tooltip />
    <el-table-column label="产品 / 品号" min-width="165" show-overflow-tooltip>
      <template #default="{ row }">
        <span class="product-name">{{ row.productName }}</span>
        <span v-if="row.itemCode" class="item-code">{{ row.itemCode }}</span>
        <span v-else class="no-code">无品号（{{ row.drawingNo }}）</span>
      </template>
    </el-table-column>
    <el-table-column prop="quantity" label="数量" width="80" align="right" />
    <el-table-column label="单价" width="130" align="right">
      <template #default="{ row }">
        <span>{{ row.unitPrice }} {{ row.currency }}</span>
        <el-tag
          v-if="row.hk.applied && canViewHkPrice"
          size="small"
          type="warning"
          effect="plain"
          class="hk-tag"
        >
          ×0.7
        </el-tag>
      </template>
    </el-table-column>
    <el-table-column label="金额" width="120" align="right">
      <template #default="{ row }">{{ row.amount }}</template>
    </el-table-column>
    <el-table-column label="备料领用" width="150">
      <template #default="{ row }">
        <template v-if="row.stockLink">
          <span class="stock-used">领用 {{ row.stockLink.usedQty }} 件</span>
          <span class="stock-cost">均本 {{ row.stockLink.blendedUnitCost }}</span>
        </template>
        <span v-else-if="row.orderType === 'stock'" class="stock-self">
          入库 {{ row.stockedQty ?? 0 }} / {{ row.quantity }}
        </span>
        <span v-else class="muted">—</span>
      </template>
    </el-table-column>
    <el-table-column prop="deliveryDate" label="客户交期" width="110" />
    <el-table-column label="状态" width="90">
      <template #default="{ row }"><StatusTag :dict="DOC_STATUS" :value="row.status" /></template>
    </el-table-column>
    <el-table-column label="操作" width="80">
      <template #default="{ row }">
        <el-button link type="primary" @click.stop="openDetail(row)">详情</el-button>
      </template>
    </el-table-column>
  </el-table>
</template>

<style scoped>
.lines {
  padding: 10px 16px 14px;
  background: var(--wfx-surface-alt);
}

.lines__title {
  margin: 0 0 8px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--wfx-text-strong);
}

.product-name {
  display: block;
  font-size: 13px;
  color: var(--wfx-text-strong);
}

.item-code {
  display: block;
  font-size: 11.5px;
  color: var(--el-color-success);
}

.no-code {
  display: block;
  font-size: 11.5px;
  color: var(--wfx-text-muted);
}

.doc-no {
  font-weight: 600;
  color: var(--wfx-navy);
}

.hk-tag {
  margin-left: 6px;
}

.muted {
  font-size: 12px;
  color: var(--wfx-text-muted);
}

.stock-used {
  display: block;
  font-size: 12.5px;
  color: var(--el-color-success);
}

.stock-cost,
.stock-self {
  display: block;
  font-size: 11.5px;
  color: var(--wfx-text-muted);
}

:deep(.el-table__row) {
  cursor: pointer;
}
</style>
