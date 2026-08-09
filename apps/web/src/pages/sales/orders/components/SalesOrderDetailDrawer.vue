<script setup lang="ts">
import { computed } from 'vue'

import DocTimeline from '@/components/DocTimeline.vue'
import { CHARGE_MODE, ORDER_TYPE } from '@/components/status-dictionary'
import StatusTag from '@/components/StatusTag.vue'

import HkPriceBreakdown from './HkPriceBreakdown.vue'

import type { SalesOrder } from '@/types/sales.types'

const props = defineProps<{
  modelValue: boolean
  /** 未选中任何行时为 null，抽屉内容整体不渲染 */
  order: SalesOrder | null
}>()

const emit = defineEmits<{ 'update:modelValue': [boolean] }>()

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})
</script>

<template>
  <el-drawer v-model="visible" size="720px" :title="order?.docNo">
    <template v-if="order">
      <el-descriptions :column="2" border size="small">
        <el-descriptions-item label="客户">{{ order.customerName }}</el-descriptions-item>
        <el-descriptions-item label="客户原始订单">
          {{ order.customerPoNo ?? '—' }}
        </el-descriptions-item>
        <el-descriptions-item label="订单类型">
          <StatusTag :dict="ORDER_TYPE" :value="order.orderType" />
        </el-descriptions-item>
        <el-descriptions-item label="收费方式">
          {{ CHARGE_MODE[order.chargeMode] }}
        </el-descriptions-item>
        <el-descriptions-item label="产品">{{ order.productName }}</el-descriptions-item>
        <el-descriptions-item label="图号">{{ order.drawingNo }}</el-descriptions-item>
        <el-descriptions-item :label="order.orderType === 'mold' ? '模具编号' : '品号'">
          <span v-if="order.itemCode" class="item-code-inline">{{ order.itemCode }}</span>
          <span v-else class="no-code">
            样品订单无品号，仅以图号 + 样品单号标识（转量产时才由工程建立品号与 BOM）
          </span>
        </el-descriptions-item>
        <el-descriptions-item label="数量">{{ order.quantity }}</el-descriptions-item>
        <el-descriptions-item label="客户交期">{{ order.deliveryDate }}</el-descriptions-item>
        <el-descriptions-item label="关联报价">
          {{ order.quotationNo ?? '—' }}
        </el-descriptions-item>
        <el-descriptions-item label="税率">
          {{ (order.taxRate * 100).toFixed(0) }}%
        </el-descriptions-item>
        <el-descriptions-item v-if="order.costOwner" label="费用承担方" :span="2">
          {{ order.costOwner }}
        </el-descriptions-item>
        <el-descriptions-item v-if="order.freeReason" label="免费 / 减免原因" :span="2">
          {{ order.freeReason }}
        </el-descriptions-item>
        <el-descriptions-item v-if="order.estimatedCost" label="预计成本" :span="2">
          {{ order.estimatedCost }} {{ order.currency }}
          <span class="muted">（免费不等于无成本，仍全额核算）</span>
        </el-descriptions-item>
      </el-descriptions>

      <template v-if="order.stockLink">
        <h3 class="drawer-title">备料领用与加权平均成本</h3>
        <el-descriptions :column="3" border size="small">
          <el-descriptions-item label="关联备料订单">
            {{ order.stockLink.stockOrderNo }}
          </el-descriptions-item>
          <el-descriptions-item label="领用数量">
            {{ order.stockLink.usedQty }} 件 × {{ order.stockLink.stockUnitCost }} 元
          </el-descriptions-item>
          <el-descriptions-item label="新投产">
            {{ order.stockLink.produceQty }} 件 × {{ order.stockLink.produceUnitCost }} 元
          </el-descriptions-item>
          <el-descriptions-item label="加权平均单件成本" :span="3">
            <b class="blended">{{ order.stockLink.blendedUnitCost }} {{ order.currency }}</b>
            <span class="muted">
              （{{ order.stockLink.stockUnitCost }}×{{ order.stockLink.usedQty }} +
              {{ order.stockLink.produceUnitCost }}×{{ order.stockLink.produceQty }}）÷
              {{ order.quantity }}
            </span>
          </el-descriptions-item>
        </el-descriptions>
      </template>

      <el-alert
        v-if="order.orderType === 'stock'"
        class="drawer-alert"
        type="success"
        :closable="false"
        show-icon
        :title="`备料订单：已入库 ${order.stockedQty ?? 0} / ${order.quantity} 件`"
        description="备料订单不向客户交货，完工全部入库即视为订单完成；库存余量可被后续正式订单领用。"
      />

      <h3 class="drawer-title">价格计算</h3>
      <HkPriceBreakdown :hk="order.hk" :currency="order.currency" :quantity="order.quantity" />

      <el-alert
        v-if="order.reviewRounds > 1"
        class="drawer-alert"
        type="info"
        :closable="false"
        show-icon
        :title="`该订单经历 ${order.reviewRounds} 轮送审，历次耗时已累计计入总历时`"
      />

      <DocTimeline class="drawer-timeline" title="审批链与节点计时（T0 起）" :nodes="order.timeline" />
    </template>

    <!-- 具名插槽必须是 el-drawer 的直接子节点，条件判断只能写在插槽内部 -->
    <template #footer>
      <template v-if="order">
        <el-button>导出订单审核单</el-button>
        <el-button type="primary">发起跨部门评审</el-button>
      </template>
    </template>
  </el-drawer>
</template>

<style scoped>
.item-code-inline {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--el-color-success);
}

.no-code {
  display: block;
  font-size: 11.5px;
  color: var(--wfx-text-muted);
}

.muted {
  font-size: 12px;
  color: var(--wfx-text-muted);
}

.blended {
  margin-right: 8px;
  font-size: 15px;
  color: var(--el-color-success);
}

.drawer-title {
  margin: 22px 0 10px;
  font-size: 14px;
  color: var(--wfx-text-strong);
}

.drawer-alert,
.drawer-timeline {
  margin-top: 18px;
}
</style>
