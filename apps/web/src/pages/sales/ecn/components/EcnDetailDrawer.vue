<script setup lang="ts">
import { computed } from 'vue'


import DocTimeline from '@/components/DocTimeline.vue'
import { ECN_CHANGE_TYPE } from '@/components/status-dictionary'

import type { EngineeringChange } from '@/types/sales.types'


const props = defineProps<{
  modelValue: boolean
  change: EngineeringChange | null
  busy: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [boolean]
  'start-assessment': []
  'return-for-detail': []
  assess: []
  'submit-signoff': []
  signoff: []
  approve: []
  reject: []
  execute: []
  close: []
  'enter-qty': []
  'initiate-rework': []
}>()

/**
 * 底部按钮按状态给。**服务端状态机才是权威**——这里只是提前把做不了的藏起来，
 * 点下去后端还会再判一次（改图未同步工艺路线、四项影响没评全等）。
 */
const status = computed(() => props.change?.status ?? 'draft')

/** 判为「有影响」——后面的清点与返工两步都由它决定要不要出现。 */
const impacted = computed(() => props.change?.productionImpact === 'impacted')

/** 返工已发起：数量锁死，录入入口收起来，避免点进去吃一个 409。 */
const reworkStarted = computed(() => Boolean(props.change?.reworkInitiatedAt))

const affectedLines = computed(() => props.change?.affectedLines ?? [])

/**
 * 清点与返工只在**批准之后**才有意义：批准前变更还可能被驳回，
 * 这时候让 PMC 去清点等于让人白跑一趟车间。
 */
const productionStage = computed(() => ['approved', 'executing'].includes(status.value))

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})
</script>

<template>
  <el-drawer v-model="visible" size="700px" :title="change?.docNo">
    <template v-if="change">
      <el-alert
        v-if="change.changeType === 'drawing' && !change.routingUpdated"
        class="drawer-alert"
        type="error"
        :closable="false"
        show-icon
        title="改图未同步修改工艺路线，禁止发布新版本"
        description="按工程变更规则，图纸版本变更必须联动更新工艺路线与相关程序后才能批准发布。"
      />

      <div class="diff">
        <div class="diff__cell">
          <span>变更前</span>
          <p>{{ change.beforeValue }}</p>
        </div>
        <span class="diff__arrow">→</span>
        <div class="diff__cell is-after">
          <span>变更后</span>
          <p>{{ change.afterValue }}</p>
        </div>
      </div>

      <el-descriptions :column="2" border size="small" class="section">
        <el-descriptions-item label="客户">{{ change.customerName }}</el-descriptions-item>
        <el-descriptions-item label="关联订单">{{ change.orderNo ?? '—' }}</el-descriptions-item>
        <el-descriptions-item label="产品 / 图号">
          {{ change.productName }} · {{ change.drawingNo }}
        </el-descriptions-item>
        <el-descriptions-item label="变更类型">
          {{ ECN_CHANGE_TYPE[change.changeType] }}
        </el-descriptions-item>
        <el-descriptions-item label="变更来源">
          {{ change.origin === 'customer' ? '客户要求' : '内部发起' }}
        </el-descriptions-item>
        <el-descriptions-item label="生效批次">
          {{ change.effectiveBatch ?? '全部后续批次' }}
        </el-descriptions-item>
        <el-descriptions-item label="变更原因" :span="2">{{ change.reason }}</el-descriptions-item>
      </el-descriptions>

      <h3 class="drawer-title">影响范围评估</h3>
      <el-table :data="change.impacts" size="small" border>
        <el-table-column prop="scope" label="范围" width="110" />
        <el-table-column prop="quantity" label="数量" width="110" />
        <el-table-column prop="amount" label="金额" width="110" align="right" />
        <el-table-column prop="note" label="处置说明" min-width="240" />
      </el-table>

      <div class="consequence">
        <el-tag
          v-if="change.productionImpact"
          :type="impacted ? 'danger' : 'success'"
          effect="light"
        >
          {{ impacted ? '对生产有影响' : '对生产无影响' }}
        </el-tag>
        <el-tag v-else type="warning" effect="light">生产影响未判定</el-tag>
        <el-tag :type="change.needRequote ? 'warning' : 'info'" effect="light">
          {{ change.needRequote ? '触发重新核价' : '不影响价格' }}
        </el-tag>
        <el-tag :type="change.needOrderReapproval ? 'warning' : 'info'" effect="light">
          {{ change.needOrderReapproval ? '触发订单重新审批' : '订单无需重审' }}
        </el-tag>
        <el-tag :type="change.routingUpdated ? 'success' : 'danger'" effect="light">
          {{ change.routingUpdated ? '工艺路线已同步' : '工艺路线未同步' }}
        </el-tag>
      </div>

      <template v-if="impacted">
        <h3 class="drawer-title">
          受影响数量（PMC 清点）
          <span class="rule">口径：只要生产（车床/CNC）动了就计入，尚未上机的料不计</span>
        </h3>
        <el-table v-if="affectedLines.length" :data="affectedLines" size="small" border>
          <el-table-column prop="productName" label="产品" min-width="180" />
          <el-table-column prop="drawingNo" label="图号" width="130" />
          <el-table-column prop="affectedQty" label="已投产数量" width="110" align="right" />
          <el-table-column prop="note" label="备注" min-width="160" />
          <el-table-column prop="enteredBy" label="录入人" width="120" />
          <el-table-column prop="enteredAt" label="录入时间" width="140" />
        </el-table>
        <el-alert
          v-else
          type="info"
          :closable="false"
          show-icon
          title="尚未清点"
          description="判为「对生产有影响」的变更，必须先由 PMC 清点录入已投产数量并发起返工，才允许结案。"
        />
        <p v-if="change.reworkInitiatedAt" class="locked">
          返工已于 {{ change.reworkInitiatedAt }} 发起，受影响数量已锁死；如需调整请另开一张变更单。
        </p>
      </template>

      <DocTimeline class="drawer-timeline" title="变更处理节点计时" :nodes="change.timeline" />
    </template>

    <!-- Element Plus 具名插槽必须是 el-drawer 的直接子节点，不能再套一层 v-if 的 template -->
    <template #footer>
      <template v-if="change">
        <template v-if="status === 'submitted'">
          <el-button :loading="busy" @click="emit('start-assessment')">开始工程评估</el-button>
        </template>
        <template v-if="status === 'assessing'">
          <el-button :loading="busy" @click="emit('return-for-detail')">退回补充说明</el-button>
          <el-button :loading="busy" @click="emit('assess')">填写影响评估</el-button>
          <el-button type="primary" :loading="busy" @click="emit('submit-signoff')">
            送跨部门会签
          </el-button>
        </template>
        <template v-if="status === 'reviewing'">
          <el-button :loading="busy" @click="emit('signoff')">记录会签</el-button>
          <el-button type="danger" plain :loading="busy" @click="emit('reject')">驳回</el-button>
          <el-button type="primary" :loading="busy" @click="emit('approve')">批准发布</el-button>
        </template>
        <el-button v-if="status === 'approved'" type="primary" :loading="busy" @click="emit('execute')">
          转入执行
        </el-button>
        <!-- PMC 侧：清点与返工。批准之后才出现，返工发起后录入入口即收起 -->
        <template v-if="impacted && productionStage">
          <el-button v-if="!reworkStarted" :loading="busy" @click="emit('enter-qty')">
            录入受影响数量
          </el-button>
          <el-button
            v-if="!reworkStarted"
            type="warning"
            plain
            :loading="busy"
            :disabled="affectedLines.length === 0"
            @click="emit('initiate-rework')"
          >
            发起返工
          </el-button>
        </template>
        <el-button v-if="status === 'executing'" type="primary" :loading="busy" @click="emit('close')">
          结案
        </el-button>
      </template>
    </template>
  </el-drawer>
</template>

<style scoped>
.diff {
  display: flex;
  gap: 12px;
  align-items: center;
}

.diff__cell {
  flex: 1;
  padding: 12px 14px;
  background: var(--wfx-surface-alt);
  border: 1px solid var(--wfx-border);
  border-radius: var(--wfx-radius-md);
}

.diff__cell.is-after {
  background: #fff8ec;
  border-color: #f5d8a4;
}

.diff__cell span {
  font-size: 12px;
  color: var(--wfx-text-muted);
}

.diff__cell p {
  margin: 6px 0 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--wfx-text-strong);
}

.diff__arrow {
  font-size: 20px;
  color: var(--wfx-text-muted);
}

.section {
  margin-top: 18px;
}

.drawer-title {
  margin: 22px 0 10px;
  font-size: 14px;
  color: var(--wfx-text-strong);
}

.consequence {
  display: flex;
  gap: 10px;
  margin-top: 16px;
}

.rule {
  margin-left: 10px;
  font-size: 12px;
  font-weight: normal;
  color: var(--wfx-text-muted);
}

.locked {
  margin: 10px 0 0;
  font-size: 12px;
  color: var(--el-color-warning);
}

.drawer-alert,
.drawer-timeline {
  margin-top: 16px;
}
</style>
