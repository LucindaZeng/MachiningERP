<script setup lang="ts">
import { Download, Lock, Refresh } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { computed, ref } from 'vue'

import { useCostAnalysis } from '@/composables/use-cost-analysis'
import { usePermission } from '@/composables/use-permission'

import { exportCostAnalyses } from './quote-export'

const { canEditCosting, role } = usePermission()

const {
  all,
  options,
  current,
  currentKey,
  loading,
  quotedUnitPrice,
  totalCost,
  marginAmount,
  marginRate,
  belowTarget,
  select,
} = useCostAnalysis()

/** 多选合并导出：把选中的多份核价合并到同一张成本分析表 */
const mergeKeys = ref<string[]>([])

const mergeList = computed(() => all.value.filter((item) => mergeKeys.value.includes(item.quotationNo)))

function refreshSnapshot(): void {
  ElMessage.success('已刷新行情并生成新的价格快照（快照含行情源、时间、币种、汇率与公式）')
}

function exportCurrent(): void {
  if (current.value) {
    exportCostAnalyses([current.value], false)
  }
}

function exportMerged(): void {
  if (mergeList.value.length) {
    exportCostAnalyses(mergeList.value, mergeList.value.length > 1)
  }
}

function saveVersion(): void {
  if (!canEditCosting.value) {
    ElMessage.error('成本核算只有报价工程师可以做，当前角色无 quote.costing.edit 权限')
    return
  }
  ElMessage.success('已保存核价版本，并回写关联报价单的成本分析单号')
}
</script>

<template>
  <div v-loading="loading">
    <el-alert
      v-if="!canEditCosting"
      class="perm-alert"
      type="warning"
      :closable="false"
      show-icon
      title="只读：成本核算只有报价工程师可以做"
      :description="`当前角色「${role.name}」没有 quote.costing.edit 权限，成本项与报价单价均不可编辑，也不能保存核价版本。业务如需调整价格，请走「报价单修改申请」由报价工程师处理。可在右上角切换角色查看报价工程师视图。`"
    />

    <div class="panel-toolbar">
      <span class="panel-toolbar__label">核价对象</span>
      <el-select
        :model-value="currentKey"
        style="width: 340px"
        placeholder="选择报价单"
        @update:model-value="select"
      >
        <el-option v-for="item in options" :key="item.value" v-bind="item" />
      </el-select>
      <span class="panel-toolbar__hint">
        业务牵头，采购、工程、财务协同；快照过期或毛利低于阈值时不得直接送审
      </span>
      <el-select
        v-model="mergeKeys"
        multiple
        collapse-tags
        collapse-tags-tooltip
        placeholder="选择多份核价单合并导出"
        style="width: 300px"
      >
        <el-option v-for="item in options" :key="item.value" v-bind="item" />
      </el-select>
      <el-button :disabled="!mergeKeys.length" @click="exportMerged">
        合并导出所选（{{ mergeKeys.length }}）
      </el-button>
      <el-button :icon="Download" @click="exportCurrent">导出本表 Excel</el-button>
      <el-button type="primary" :disabled="!canEditCosting" @click="saveVersion">
        保存核价版本
      </el-button>
    </div>

    <template v-if="current">
      <div class="cost-grid">
        <el-card shadow="never">
          <template #header>
            <div class="card-head">
              <span>成本测算表 · {{ current.productName }}（{{ current.quantity }} 件）</span>
              <span class="card-head__hint">金额口径：元 / 件，字符串定点数</span>
            </div>
          </template>

          <el-table :data="current.lines" size="small" border style="width: 100%">
            <el-table-column prop="label" label="成本项" width="120" />
            <el-table-column label="单位成本" width="140">
              <template #default="{ row }">
                <el-input v-model="row.amount" size="small" :disabled="row.restricted || !canEditCosting">
                  <template #suffix>{{ current?.currency }}</template>
                </el-input>
              </template>
            </el-table-column>
            <el-table-column label="说明" min-width="260">
              <template #default="{ row }">
                <span>{{ row.note }}</span>
                <el-tag v-if="row.restricted" size="small" type="info" effect="plain" class="lock">
                  <el-icon><Lock /></el-icon> 供应商底价按字段权限隐藏
                </el-tag>
              </template>
            </el-table-column>
          </el-table>

          <div class="summary">
            <div class="summary__item">
              <span>单位成本合计</span>
              <b>{{ totalCost.toFixed(2) }}</b>
            </div>
            <div class="summary__item">
              <span>报价单价</span>
              <el-input
                v-model="quotedUnitPrice"
                size="small"
                style="width: 120px"
                :disabled="!canEditCosting"
              />
            </div>
            <div class="summary__item">
              <span>单位毛利</span>
              <b>{{ marginAmount.toFixed(2) }}</b>
            </div>
            <div class="summary__item">
              <span>毛利率</span>
              <b :class="{ 'is-low': belowTarget }">{{ (marginRate * 100).toFixed(1) }}%</b>
              <em>目标 {{ (current.targetMarginRate * 100).toFixed(0) }}%</em>
            </div>
          </div>

          <el-alert
            v-if="belowTarget"
            class="summary__alert"
            type="error"
            :closable="false"
            show-icon
            title="毛利率低于目标阈值，送审将强制走会签"
            description="按控制矩阵：低毛利 / 负毛利报价需业务、工程、PMC、财务会签后由总经办批准。"
          />
        </el-card>

        <div class="cost-side">
          <el-card shadow="never">
            <template #header>
              <div class="card-head">
                <span>金属行情快照</span>
                <el-button link type="primary" :icon="Refresh" @click="refreshSnapshot">
                  刷新行情
                </el-button>
              </div>
            </template>

            <el-descriptions :column="1" size="small" border>
              <el-descriptions-item label="品种">{{ current.snapshot.metal }}</el-descriptions-item>
              <el-descriptions-item label="行情源">{{ current.snapshot.source }}</el-descriptions-item>
              <el-descriptions-item label="行情时间">
                {{ current.snapshot.quotedAt }}
              </el-descriptions-item>
              <el-descriptions-item label="价格">
                {{ current.snapshot.price }} {{ current.snapshot.unit }}
              </el-descriptions-item>
              <el-descriptions-item label="币种 / 汇率">
                {{ current.snapshot.currency }} · {{ current.snapshot.exchangeRate }}
              </el-descriptions-item>
            </el-descriptions>

            <el-alert
              v-if="current.snapshot.expired"
              class="snapshot-alert"
              type="warning"
              :closable="false"
              show-icon
              title="快照已过期（有效期 7 天）"
              description="过期快照不得用于送审核价，请刷新行情后重新试算；价格变动超 3% 需重新核价。"
            />
          </el-card>

          <el-card shadow="never">
            <template #header>
              <div class="card-head">
                <span>相似产品与历史成交</span>
                <span class="card-head__hint">按材质、工艺、客户、图纸特征检索</span>
              </div>
            </template>

            <el-table :data="current.similar" size="small" style="width: 100%">
              <el-table-column prop="drawingNo" label="图号" width="100" />
              <el-table-column prop="customerName" label="客户" min-width="130" show-overflow-tooltip />
              <el-table-column prop="quotedPrice" label="报价" width="80" />
              <el-table-column prop="actualCost" label="实际成本" width="90" />
              <el-table-column label="毛利率" width="80">
                <template #default="{ row }">{{ (row.marginRate * 100).toFixed(1) }}%</template>
              </el-table-column>
              <el-table-column prop="quotedAt" label="报价日期" width="100" />
            </el-table>
          </el-card>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.perm-alert {
  margin-bottom: 14px;
}

.panel-toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 16px;
}

.panel-toolbar__label {
  font-size: 13px;
  font-weight: 600;
  color: var(--wfx-text-strong);
}

.panel-toolbar__hint {
  margin-left: auto;
  font-size: 12px;
  color: var(--wfx-text-muted);
}

.cost-grid {
  display: grid;
  grid-template-columns: 1.15fr 1fr;
  gap: 16px;
  align-items: start;
}

.cost-side {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 14px;
  font-weight: 700;
  color: var(--wfx-text-strong);
}

.card-head__hint {
  font-size: 12px;
  font-weight: 400;
  color: var(--wfx-text-muted);
}

.lock {
  margin-left: 8px;
}

.summary {
  display: flex;
  gap: 32px;
  align-items: center;
  padding: 16px 4px 4px;
}

.summary__item {
  display: flex;
  gap: 8px;
  align-items: baseline;
  font-size: 13px;
  color: var(--wfx-text-muted);
}

.summary__item b {
  font-size: 20px;
  color: var(--wfx-navy);
}

.summary__item b.is-low {
  color: var(--el-color-danger);
}

.summary__item em {
  font-size: 12px;
  font-style: normal;
}

.summary__alert,
.snapshot-alert {
  margin-top: 14px;
}

@media (max-width: 1400px) {
  .panel-toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 16px;
}

.panel-toolbar__label {
  font-size: 13px;
  font-weight: 600;
  color: var(--wfx-text-strong);
}

.panel-toolbar__hint {
  margin-left: auto;
  font-size: 12px;
  color: var(--wfx-text-muted);
}

.cost-grid {
    grid-template-columns: 1fr;
  }
}
</style>
