<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import CostAnalysisPanel from './components/CostAnalysisPanel.vue'
import HistoricalQuotePanel from './components/HistoricalQuotePanel.vue'
import MaterialPricePanel from './components/MaterialPricePanel.vue'
import QuotationTable from './components/QuotationTable.vue'
import QuoteChangePanel from './components/QuoteChangePanel.vue'
import QuoteApplyDialog from './components/QuoteApplyDialog.vue'
import PageHeader from '@/components/PageHeader.vue'

const route = useRoute()
const router = useRouter()

const TABS = ['list', 'change', 'history', 'cost', 'material']

function tabFromQuery(value: unknown): string {
  return TABS.includes(String(value)) ? String(value) : 'list'
}

const activeTab = ref(tabFromQuery(route.query.tab))
const applyVisible = ref(false)

watch(activeTab, (value) => {
  void router.replace({ query: value === 'list' ? {} : { tab: value } })
})

// 报价列表里点「核价」会带 ?tab=cost 回到本页，需同步页签
watch(
  () => route.query.tab,
  (tab) => {
    activeTab.value = tabFromQuery(tab)
  },
)
</script>

<template>
  <div>
    <PageHeader
      title="报价管理"
      requirement-code="QTN-01 / 02 / 03"
      subtitle="报价申请（业务：图纸 + 数量）→ 报价工程师补齐资料与核价 → 报价审批 → 客户确认。报价单强制上传图纸，图纸同时分发给报价工程师报价与工程建 BOM；改价走报价单修改申请，由报价工程师改成本分析或驳回。"
    >
      <template #actions>
        <template v-if="activeTab === 'list'">
          <el-button @click="activeTab = 'change'">报价修改申请</el-button>
          <el-button type="primary" @click="applyVisible = true">新建报价申请</el-button>
        </template>
      </template>
    </PageHeader>

    <el-tabs v-model="activeTab" class="quotation-tabs">
      <el-tab-pane label="报价单" name="list">
        <QuotationTable v-if="activeTab === 'list'" />
      </el-tab-pane>
      <el-tab-pane label="报价修改申请" name="change">
        <QuoteChangePanel v-if="activeTab === 'change'" />
      </el-tab-pane>
      <el-tab-pane label="历史报价查询" name="history">
        <HistoricalQuotePanel v-if="activeTab === 'history'" />
      </el-tab-pane>
      <el-tab-pane label="成本核算（QTN-02）" name="cost">
        <CostAnalysisPanel v-if="activeTab === 'cost'" />
      </el-tab-pane>
      <el-tab-pane label="原材料价格表" name="material">
        <MaterialPricePanel v-if="activeTab === 'material'" />
      </el-tab-pane>
    </el-tabs>

    <QuoteApplyDialog v-model="applyVisible" />
  </div>
</template>

<style scoped>
.quotation-tabs :deep(.el-tabs__header) {
  margin-bottom: 16px;
}

.quotation-tabs :deep(.el-tabs__item) {
  font-size: 14px;
  font-weight: 600;
}
</style>
