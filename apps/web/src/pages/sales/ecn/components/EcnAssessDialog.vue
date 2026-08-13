<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'

import type { AssessPayload } from './ecn-assess-payload'
import type { EcnProductionImpact, EngineeringChange } from '@/types/sales.types'

/**
 * ECN-02 工程影响评估。
 *
 * 四项影响**整表提交**、且服务端要求四项齐全才允许送会签——因此这里固定四行，
 * 不做「加一行」。现实里最容易漏的恰恰是「已发货批次」：漏了它，
 * 问题件已经在客户手上，而变更单上一个字都没提。
 *
 * 金额留空表示「算不出钱」，与填 0（评估过且确实为零）在服务端是两个不同的值。
 */
const props = defineProps<{
  modelValue: boolean
  change: EngineeringChange | null
  busy: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: [payload: AssessPayload]
}>()

const SCOPES = [
  { key: 'WIP', label: '在制工单' },
  { key: 'PURCHASED', label: '已采购物料' },
  { key: 'FINISHED_STOCK', label: '已完工库存' },
  { key: 'SHIPPED', label: '已发货批次' },
]

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const rows = ref(SCOPES.map((scope) => ({ ...scope, quantity: '', amount: '', note: '' })))
const form = reactive({
  /**
   * 空串 = 尚未判定。不默认成「无影响」——默认值会被当成已经判过，
   * 而这一项判错的代价是车间照旧图把已投产的那批做完。
   */
  productionImpact: '' as EcnProductionImpact | '',
  routingUpdated: false,
  effectiveBatch: '',
  needRequote: false,
  needOrderReapproval: false,
})

// 每次打开都按当前单据重置：上一张单的评估留在框里，很容易被顺手再提交一遍
watch(visible, (open) => {
  if (!open) return
  rows.value = SCOPES.map((scope) => ({ ...scope, quantity: '', amount: '', note: '' }))
  Object.assign(form, {
    productionImpact: props.change?.productionImpact ?? '',
    routingUpdated: props.change?.routingUpdated ?? false,
    effectiveBatch: props.change?.effectiveBatch ?? '',
    needRequote: props.change?.needRequote ?? false,
    needOrderReapproval: props.change?.needOrderReapproval ?? false,
  })
})

/** 改图必须联动改工艺路线，未同步服务端会拒绝批准——这里提前提示。 */
const routingWarning = computed(() => props.change?.changeType === 'drawing' && !form.routingUpdated)

/** 中途改工序只能对指定批次版本生效。 */
const batchWarning = computed(
  () => props.change?.changeType === 'process' && form.effectiveBatch.trim() === '',
)

/** 未判定就不给提交——服务端也拦，但让人在框里就知道缺什么，比吃一个 422 强。 */
const unclassified = computed(() => form.productionImpact === '')

function confirm(): void {
  if (form.productionImpact === '') return
  emit('confirm', {
    productionImpact: form.productionImpact,
    impacts: rows.value.map((row) => ({
      scope: row.key,
      quantity: row.quantity || '—',
      // 空表示「算不出钱」；服务端据此落 null 而不是 0
      amountMinor: row.amount.trim() === '' ? null : toMinor(row.amount),
      note: row.note,
    })),
    routingUpdated: form.routingUpdated,
    effectiveBatch: form.effectiveBatch.trim() || null,
    needRequote: form.needRequote,
    needOrderReapproval: form.needOrderReapproval,
  })
}

/** 元 → 整数分。系统内金额一律整数分，界面收的是元。 */
function toMinor(yuan: string): string {
  const value = Number(yuan)
  return Number.isFinite(value) ? String(Math.round(value * 100)) : '0'
}
</script>

<template>
  <el-dialog v-model="visible" title="工程影响评估（ECN-02）" width="880px">
    <el-alert
      class="dialog-alert"
      type="info"
      :closable="false"
      show-icon
      title="四项影响必须评全、且判定对生产有无影响，才能送会签"
      description="金额留空表示「算不出钱」，与填 0（评估过且确实为零）在系统里是两个不同的值——后者会被当作已确认无损失。"
    />

    <el-table :data="rows" size="small" border>
      <el-table-column prop="label" label="影响范围" width="120" />
      <el-table-column label="数量 / 用量" min-width="180">
        <template #default="{ row }">
          <el-input v-model="row.quantity" size="small" placeholder="如 1200 件 / 620kg" />
        </template>
      </el-table-column>
      <el-table-column label="金额（元）" width="140">
        <template #default="{ row }">
          <el-input v-model="row.amount" size="small" placeholder="留空 = 算不出" />
        </template>
      </el-table-column>
      <el-table-column label="说明" min-width="240">
        <template #default="{ row }">
          <el-input v-model="row.note" size="small" placeholder="返工 / 报废 / 可继续使用…" />
        </template>
      </el-table-column>
    </el-table>

    <el-form class="assess-form" label-width="150px" size="small">
      <el-form-item label="对生产有无影响" required>
        <el-radio-group v-model="form.productionImpact">
          <el-radio value="none">无影响</el-radio>
          <el-radio value="impacted">有影响（需 PMC 清点已投产数量）</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item v-if="form.productionImpact === 'impacted'" label=" ">
        <span class="hint">
          清点口径：<b>只要生产（车床/CNC）动了就计入</b>受影响数量；尚未上机的料不计。
          送会签后系统会通知 PMC 清点，清点完并发起返工才允许结案。
        </span>
      </el-form-item>
      <el-form-item label="已同步改工艺路线">
        <el-switch v-model="form.routingUpdated" />
        <span v-if="routingWarning" class="warn">改图必须联动改工艺路线，否则不允许批准发布</span>
      </el-form-item>
      <el-form-item label="生效批次版本">
        <el-input v-model="form.effectiveBatch" placeholder="如 B26071502 起生效" />
        <span v-if="batchWarning" class="warn">中途改工序必须指定生效批次，否则不允许批准</span>
      </el-form-item>
      <el-form-item label="下游联动">
        <el-checkbox v-model="form.needRequote">需重新核价（QRC）</el-checkbox>
        <el-checkbox v-model="form.needOrderReapproval">需订单重审（ORC）</el-checkbox>
      </el-form-item>
    </el-form>

    <p class="note">
      系统只做标记与提醒，<b>不代建</b>报价变更与订单修改申请：重新核价要填成本变化、
      订单修改要填改什么，这些信息 ECN 里没有，代建只会产出一批空壳单据等人来补。
    </p>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="busy" :disabled="unclassified" @click="confirm">
        {{ unclassified ? '请先判定对生产有无影响' : '保存评估' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.dialog-alert {
  margin-bottom: 12px;
}

.assess-form {
  margin-top: 16px;
}

.hint {
  font-size: 12px;
  line-height: 1.8;
  color: var(--wfx-text-muted);
}

.warn {
  margin-left: 12px;
  font-size: 12px;
  color: var(--el-color-danger);
}

.note {
  margin: 8px 0 0;
  padding: 8px 10px;
  font-size: 12px;
  line-height: 1.8;
  color: var(--wfx-text-muted);
  background: var(--wfx-surface-alt);
  border-radius: 4px;
}
</style>
