<script setup lang="ts">
import type { TimelineNode } from '@/types/sales.types'

defineProps<{ nodes: TimelineNode[]; title?: string }>()

const STATE_META: Record<string, { color: string; label: string }> = {
  done: { color: '#67c23a', label: '已完成' },
  active: { color: '#0b357b', label: '进行中' },
  overdue: { color: '#f56c6c', label: '已超期' },
  pending: { color: '#c0c4cc', label: '未开始' },
}
</script>

<template>
  <section class="doc-timeline">
    <h3 v-if="title" class="doc-timeline__title">{{ title }}</h3>

    <el-timeline>
      <el-timeline-item
        v-for="node in nodes"
        :key="node.node"
        :color="STATE_META[node.state].color"
        :hollow="node.state === 'pending'"
      >
        <div class="doc-timeline__head">
          <span class="doc-timeline__node">{{ node.node }}</span>
          <span class="doc-timeline__state" :style="{ color: STATE_META[node.state].color }">
            {{ STATE_META[node.state].label }}
          </span>
        </div>

        <p class="doc-timeline__meta">
          责任人：{{ node.owner }}
          <template v-if="node.enteredAt"> · 进入：{{ node.enteredAt }}</template>
          <template v-if="node.firstViewedAt"> · 首次查看：{{ node.firstViewedAt }}</template>
          <template v-if="node.finishedAt"> · 完成：{{ node.finishedAt }}</template>
          <template v-if="node.dueAt"> · 应完成：{{ node.dueAt }}</template>
        </p>

        <p class="doc-timeline__meta">
          <template v-if="node.elapsedHours">节点历时 {{ node.elapsedHours }} 小时</template>
          <template v-if="node.overdueHours">
            <span class="doc-timeline__overdue">　超期 {{ node.overdueHours }} 小时</span>
          </template>
        </p>

        <p v-if="node.remark" class="doc-timeline__remark">{{ node.remark }}</p>
      </el-timeline-item>
    </el-timeline>
  </section>
</template>

<style scoped>
.doc-timeline__title {
  margin: 0 0 14px;
  font-size: 14px;
  font-weight: 700;
  color: var(--wfx-text-strong);
}

.doc-timeline__head {
  display: flex;
  gap: 10px;
  align-items: baseline;
}

.doc-timeline__node {
  font-size: 14px;
  font-weight: 600;
  color: var(--wfx-text-strong);
}

.doc-timeline__state {
  font-size: 12px;
}

.doc-timeline__meta {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--wfx-text-muted);
}

.doc-timeline__overdue {
  color: var(--el-color-danger);
}

.doc-timeline__remark {
  margin: 6px 0 0;
  padding: 6px 10px;
  font-size: 12.5px;
  color: var(--wfx-text);
  background: var(--wfx-surface-alt);
  border-left: 3px solid var(--wfx-orange);
  border-radius: 4px;
}
</style>
