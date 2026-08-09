<script setup lang="ts">
import { CircleCheck, CircleClose } from '@element-plus/icons-vue'

import type { BlockingCheck } from '@/composables/use-sales-order-form'

defineProps<{
  /** 阻断清单：顺序即展示顺序，未全绿则父页禁用提交按钮 */
  checks: BlockingCheck[]
}>()

/** 提交后的固定审批链（ORD-01 ~ ORD-04），与流程文档一一对应，属于静态说明而非取数结果 */
const APPROVAL_CHAIN = [
  { node: 'ORD-01 建单提交', owner: '业务员 · 罗晓琳', hint: 'T0 从提交那一刻起算' },
  { node: 'ORD-02 业务经理审核', owner: '周敏', hint: 'SLA 24 小时，超时升级至总经办' },
  { node: 'ORD-03 财务审核', owner: '财务 · 黄工', hint: '核价、原始订单、信用额度三项缺一即阻断' },
  { node: 'ORD-04 跨部门订单评审', owner: '工程 / PMC / 采购 / 生产 / 品质 / 仓库 / 委外 / 财务', hint: '业务发起，结论：接受 / 带条件接受 / 退回' },
]
</script>

<template>
  <el-card shadow="never">
    <template #header><span class="card-title">提交前阻断校验</span></template>

    <ul class="check-list">
      <li v-for="item in checks" :key="item.label" :class="{ 'is-fail': !item.passed }">
        <el-icon><component :is="item.passed ? CircleCheck : CircleClose" /></el-icon>
        <div>
          <p class="check-list__label">{{ item.label }}</p>
          <p class="check-list__hint">{{ item.hint }}</p>
        </div>
      </li>
    </ul>
  </el-card>

  <el-card shadow="never">
    <template #header><span class="card-title">提交后审批链</span></template>

    <ol class="chain">
      <li v-for="step in APPROVAL_CHAIN" :key="step.node">
        <p class="chain__node">{{ step.node }}</p>
        <p class="chain__owner">{{ step.owner }}</p>
        <p class="chain__hint">{{ step.hint }}</p>
      </li>
    </ol>

    <p class="chain__note">
      审核人不得直接改写送审内容；退回后业务修改重提会建立新的处理轮次，总历时从首次送审连续计算。
    </p>
  </el-card>
</template>

<style scoped>
.card-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--wfx-text-strong);
}

.check-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.check-list li {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 10px 0;
  color: var(--el-color-success);
  border-bottom: 1px dashed var(--wfx-border);
}

.check-list li:last-child {
  border-bottom: none;
}

.check-list li.is-fail {
  color: var(--el-color-danger);
}

.check-list__label {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--wfx-text-strong);
}

.check-list__hint {
  margin: 3px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--wfx-text-muted);
}

.chain {
  margin: 0;
  padding-left: 18px;
}

.chain li {
  margin-bottom: 12px;
}

.chain__node {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--wfx-text-strong);
}

.chain__owner,
.chain__hint {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--wfx-text-muted);
}

.chain__note {
  margin: 4px 0 0;
  padding: 8px 10px;
  font-size: 12px;
  line-height: 1.7;
  color: var(--wfx-text);
  background: var(--wfx-surface-alt);
  border-left: 3px solid var(--wfx-orange);
  border-radius: 4px;
}
</style>
