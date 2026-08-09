<script setup lang="ts">
import type { StockLink, StockOrder } from '@/types/sales.types'

defineProps<{
  /** 同图号且仍有余量的备料订单；为空时下拉禁用并给出提示 */
  availableStock: StockOrder[]
  /** 加权平均成本试算结果，未选备料单或未填数量时为 null */
  stockUsage: StockLink | null
  quantity: string
}>()

const stockOrderNo = defineModel<string>('stockOrderNo', { required: true })
const produceUnitCost = defineModel<string>('produceUnitCost', { required: true })
</script>

<template>
  <el-card shadow="never">
    <template #header>
      <span class="card-title">三、备料领用（可选）</span>
    </template>

    <el-form-item label="关联备料订单">
      <el-select
        v-model="stockOrderNo"
        placeholder="选择同图号且有余量的备料订单"
        clearable
        style="width: 100%"
        :disabled="!availableStock.length"
      >
        <el-option
          v-for="item in availableStock"
          :key="item.docNo"
          :label="`${item.docNo} · ${item.productName} · 余 ${item.remainingQty} 件 · 单件成本 ${item.unitCost}`"
          :value="item.docNo"
        />
      </el-select>
      <p class="field-hint">
        {{
          availableStock.length
            ? '领用备料的部分按备料订单的单件生产成本计价，剩余数量按新投产成本计价，系统自动加权平均。'
            : '当前图号没有可领用的备料库存；填写图号后系统会自动匹配。'
        }}
      </p>
    </el-form-item>

    <el-form-item v-if="stockOrderNo" label="新产单件成本">
      <el-input v-model="produceUnitCost" placeholder="新投产部分的单件生产成本" />
    </el-form-item>

    <div v-if="stockUsage" class="stock-calc">
      <div class="stock-calc__row">
        <div class="stock-calc__cell">
          <span>领用备料</span>
          <b>{{ stockUsage.usedQty }}</b>
          <em>件 × {{ stockUsage.stockUnitCost }} 元</em>
        </div>
        <span class="stock-calc__op">+</span>
        <div class="stock-calc__cell">
          <span>新投产</span>
          <b>{{ stockUsage.produceQty }}</b>
          <em>件 × {{ stockUsage.produceUnitCost }} 元</em>
        </div>
        <span class="stock-calc__op">=</span>
        <div class="stock-calc__cell is-final">
          <span>加权平均单件成本</span>
          <b>{{ stockUsage.blendedUnitCost }}</b>
          <em>订单数量 {{ quantity }} 件</em>
        </div>
      </div>
      <p class="stock-calc__formula">
        计算式：（{{ stockUsage.stockUnitCost }} × {{ stockUsage.usedQty }} +
        {{ stockUsage.produceUnitCost }} × {{ stockUsage.produceQty }}）÷ {{ quantity }}
        = {{ stockUsage.blendedUnitCost }} 元/件；备料余量领用后自动扣减，扣完即关闭该备料订单。
      </p>
    </div>
  </el-card>
</template>

<style scoped>
.card-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--wfx-text-strong);
}

.field-hint {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--wfx-text-muted);
}

.stock-calc {
  padding: 14px 16px;
  margin-top: 6px;
  background: #f2f9ef;
  border: 1px solid #d3e9c9;
  border-radius: var(--wfx-radius-md);
}

.stock-calc__row {
  display: flex;
  gap: 12px;
  align-items: center;
}

.stock-calc__cell {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  padding: 10px 14px;
  background: #fff;
  border: 1px solid var(--wfx-border);
  border-radius: 8px;
}

.stock-calc__cell span {
  font-size: 12px;
  color: var(--wfx-text-muted);
}

.stock-calc__cell b {
  font-size: 20px;
  color: var(--wfx-text-strong);
}

.stock-calc__cell em {
  font-size: 11.5px;
  font-style: normal;
  color: var(--wfx-text-muted);
}

.stock-calc__cell.is-final b {
  color: var(--el-color-success);
}

.stock-calc__op {
  font-size: 18px;
  font-weight: 700;
  color: var(--wfx-text-muted);
}

.stock-calc__formula {
  margin: 10px 0 0;
  font-size: 12px;
  line-height: 1.7;
  color: var(--wfx-text-muted);
}
</style>
