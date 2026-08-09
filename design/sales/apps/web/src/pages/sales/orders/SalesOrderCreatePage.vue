<script setup lang="ts">
import { computed } from 'vue'
import { CircleCheck, CircleClose, Delete, Plus, UploadFilled } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'

import HkPriceBreakdown from './components/HkPriceBreakdown.vue'
import DraftToolbar from '@/components/DraftToolbar.vue'
import PageHeader from '@/components/PageHeader.vue'
import { CHARGE_MODE } from '@/components/status-dictionary'
import { useFormDraft } from '@/composables/use-form-draft'
import { usePermission } from '@/composables/use-permission'
import { useSalesOrderForm } from '@/composables/use-sales-order-form'

const { canViewHkPrice } = usePermission()

const router = useRouter()
const {
  form,
  formRef,
  rules,
  customers,
  availableStock,
  stockUsage,
  selectedCustomer,
  isFormal,
  isStock,
  isSample,
  totalQty,
  totalAmount,
  addLine,
  removeLine,
  needPoFile,
  engineeringGaps,
  pickPoFile,
  needFreeFields,
  hk,
  checks,
  canSubmit,
  submitting,
  errorMessage,
  onOrderTypeChange,
  submit,
} = useSalesOrderForm()

const itemCodePlaceholder = computed(() => {
  if (isSample.value) {
    return '样品无品号，以图号 + 样品单号标识'
  }
  if (isStock.value) {
    return '选择该图号已量产的品号，如 P-HS4471-A-01'
  }
  return isFormal.value ? '工程建立的品号，如 P-HS4471-A-01' : '模具编号，如 M-HS4471-01'
})

const bomPlaceholder = computed(() => {
  if (isSample.value) {
    return '样品不建 BOM，无需关联'
  }
  if (isStock.value) {
    return '沿用该品号已发布的 BOM，无需另申请'
  }
  return '工程回传「BOM 可下单」的申请单号'
})

const {
  drafts,
  lastSavedAt,
  save: saveDraft,
  load: loadDraft,
  remove: removeDraft,
} = useFormDraft('sales-order-create', form)

const CHARGE_OPTIONS = [
  { value: 'charged', label: CHARGE_MODE.charged },
  { value: 'free', label: CHARGE_MODE.free },
  { value: 'partial', label: CHARGE_MODE.partial },
  { value: 'deferred', label: CHARGE_MODE.deferred },
  { value: 'deposit', label: CHARGE_MODE.deposit },
  { value: 'internal', label: CHARGE_MODE.internal },
]

const APPROVAL_CHAIN = [
  { node: 'ORD-01 建单提交', owner: '业务员 · 罗晓琳', hint: 'T0 从提交那一刻起算' },
  { node: 'ORD-02 业务经理审核', owner: '周敏', hint: 'SLA 24 小时，超时升级至总经办' },
  { node: 'ORD-03 财务审核', owner: '财务 · 黄工', hint: '核价、原始订单、信用额度三项缺一即阻断' },
  { node: 'ORD-04 跨部门订单评审', owner: '工程 / PMC / 采购 / 生产 / 品质 / 仓库 / 委外 / 财务', hint: '业务发起，结论：接受 / 带条件接受 / 退回' },
]
</script>

<template>
  <div>
    <PageHeader
      title="新建业务订单"
      requirement-code="ORD-01"
      subtitle="订单类型与收费方式是两个独立字段：选模具 / 样品不等于自动免费，选正式业务订单则强制收费。免费也必须完整核算成本。"
    >
      <template #actions>
        <DraftToolbar
          :drafts="drafts"
          :last-saved-at="lastSavedAt"
          @save="saveDraft"
          @load="loadDraft"
          @remove="removeDraft"
        />
        <el-button @click="router.push('/sales/orders')">取消</el-button>
        <el-button type="primary" :loading="submitting" :disabled="!canSubmit" @click="submit">
          提交业务经理审核
        </el-button>
      </template>
    </PageHeader>

    <el-alert
      v-if="errorMessage"
      class="form-alert"
      type="error"
      :closable="false"
      show-icon
      :title="errorMessage"
    />

    <div class="create-grid">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="130px" class="create-form">
        <el-card shadow="never">
          <template #header><span class="card-title">一、客户与订单类型</span></template>

          <el-form-item label="客户" prop="customerCode">
            <el-select v-model="form.customerCode" placeholder="选择客户" filterable style="width: 100%">
              <el-option
                v-for="item in customers"
                :key="item.code"
                :label="`${item.code} · ${item.name}`"
                :value="item.code"
                :disabled="item.status !== 'active'"
              />
            </el-select>
            <p v-if="selectedCustomer" class="field-hint">
              付款条件 {{ selectedCustomer.paymentTerm }} · 结算币种 {{ selectedCustomer.currency }}
              <el-tag
                v-if="selectedCustomer.hkPricingEnabled && canViewHkPrice"
                size="small"
                type="warning"
                effect="dark"
              >
                香港代生产价格客户 ×0.7
              </el-tag>
            </p>
          </el-form-item>

          <el-form-item label="订单类型">
            <el-radio-group
              :model-value="form.orderType"
              @update:model-value="
                onOrderTypeChange($event as 'mold' | 'sample' | 'formal' | 'stock')
              "
            >
              <el-radio-button value="formal">正式业务订单</el-radio-button>
              <el-radio-button value="mold">模具订单</el-radio-button>
              <el-radio-button value="sample">样品订单</el-radio-button>
              <el-radio-button value="stock">备料订单</el-radio-button>
            </el-radio-group>
            <p v-if="isStock" class="field-hint">
              备料订单不向客户交货，完工全部入库即视为订单完成；后续正式订单可关联领用，直到备料用完。
            </p>
          </el-form-item>

          <el-form-item label="收费方式">
            <el-select
              v-model="form.chargeMode"
              style="width: 260px"
              :disabled="isFormal || isStock"
            >
              <el-option
                v-for="item in CHARGE_OPTIONS"
                :key="item.value"
                v-bind="item"
                :disabled="(isFormal && item.value !== 'charged') || (isStock && item.value !== 'internal')"
              />
            </el-select>
            <p class="field-hint">
              {{
                isFormal
                  ? '正式业务订单强制收费，系统以合同应收义务判断，不允许免费或零价绕过'
                  : isStock
                    ? '备料订单为内部备料，不产生客户应收，但全额核算生产成本'
                    : '模具 / 样品可收费、免费、部分收费、递延分摊或押金返还，均需按预计成本分级审批'
              }}
            </p>
          </el-form-item>
        </el-card>

        <el-alert
          v-if="engineeringGaps.length"
          class="gap-alert"
          type="error"
          :closable="false"
          show-icon
          :title="`工程资料不齐套，不能下单：缺少${engineeringGaps.join('、')}`"
          description="按下单前置校验，产品缺少报价单、成本分析、品号、BOM 或图纸中的任意一项，一律禁止提交订单。请先在报价管理完成报价与核价、在 BOM 申请取得品号与「BOM 可下单」确认后再下单；样品订单免品号与 BOM，不受此校验约束。"
        />

        <el-card shadow="never">
          <template #header><span class="card-title">二、产品与交期</span></template>

          <el-form-item label="产品明细">
            <div class="lines">
              <div class="lines__head">
                <span>一张订单可以下多项产品；品号由工程建立，样品行不填品号。</span>
                <el-button link type="primary" :icon="Plus" @click="addLine">增加一项产品</el-button>
              </div>

              <el-table :data="form.lines" size="small" border style="width: 100%">
                <el-table-column label="#" width="42" align="center">
                  <template #default="{ row }">{{ row.seq }}</template>
                </el-table-column>
                <el-table-column label="产品名称" min-width="160">
                  <template #default="{ row }">
                    <el-input v-model="row.productName" size="small" placeholder="如：连接器外壳" />
                  </template>
                </el-table-column>
                <el-table-column label="图号" width="118">
                  <template #default="{ row }">
                    <el-input v-model="row.drawingNo" size="small" placeholder="HS-4471-A" />
                  </template>
                </el-table-column>
                <el-table-column label="品号" width="132">
                  <template #default="{ row }">
                    <el-input
                      v-model="row.itemCode"
                      size="small"
                      :disabled="isSample"
                      :placeholder="isSample ? '样品无品号' : 'P-HS4471-A-01'"
                    />
                  </template>
                </el-table-column>
                <el-table-column label="数量" width="86">
                  <template #default="{ row }">
                    <el-input v-model="row.quantity" size="small" placeholder="件" />
                  </template>
                </el-table-column>
                <el-table-column :label="isStock ? '单件成本' : '原始单价'" width="96">
                  <template #default="{ row }">
                    <el-input v-model="row.unitPrice" size="small" />
                  </template>
                </el-table-column>
                <el-table-column label="金额" width="96" align="right">
                  <template #default="{ row }">{{ row.amount }}</template>
                </el-table-column>
                <el-table-column label="行交期" width="132">
                  <template #default="{ row }">
                    <el-date-picker
                      v-model="row.deliveryDate"
                      type="date"
                      size="small"
                      value-format="YYYY-MM-DD"
                      style="width: 100%"
                    />
                  </template>
                </el-table-column>
                <el-table-column label="" width="46" align="center">
                  <template #default="{ $index }">
                    <el-button
                      link
                      type="danger"
                      :icon="Delete"
                      :disabled="form.lines.length <= 1"
                      @click="removeLine($index)"
                    />
                  </template>
                </el-table-column>
              </el-table>

              <div class="lines__total">
                合计 {{ form.lines.length }} 项产品 · {{ totalQty }} 件 ·
                {{ totalAmount.toFixed(2) }} {{ form.currency }}
              </div>
            </div>
          </el-form-item>

          <el-row :gutter="16">
            <el-col :span="12">
              <el-form-item :label="isStock ? '期望完工日' : '客户交期'" prop="deliveryDate">
                <el-date-picker
                  v-model="form.deliveryDate"
                  type="date"
                  value-format="YYYY-MM-DD"
                  style="width: 100%"
                />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="客户原始订单号" prop="customerPoNo">
                <el-input v-model="form.customerPoNo" :placeholder="isFormal ? '必填' : '选填'" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="客户订单原件">
                <div class="po">
                  <el-button size="small" :icon="UploadFilled" @click="pickPoFile">上传原件</el-button>
                  <span v-if="form.poFile" class="po__file">{{ form.poFile }}</span>
                  <span v-else :class="needPoFile ? 'po__required' : 'po__optional'">
                    {{ needPoFile ? '本类型订单强制上传客户订单原件' : '免费样品可不上传' }}
                  </span>
                </div>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="关联报价 / 核价" prop="quotationNo">
                <el-input v-model="form.quotationNo" :placeholder="isFormal ? '必填' : '选填'" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item :label="isStock ? '引用品号' : '品号'">
                <el-input
                  v-model="form.itemCode"
                  :disabled="isSample"
                  :placeholder="itemCodePlaceholder"
                />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="关联 BOM 申请">
                <el-input
                  v-model="form.bomRequestNo"
                  :disabled="isSample || isStock"
                  :placeholder="bomPlaceholder"
                />
              </el-form-item>
            </el-col>
          </el-row>

          <el-alert
            v-if="isSample"
            class="inline-alert"
            type="info"
            :closable="false"
            show-icon
            title="样品既没有品号，也没有 BOM"
            description="品号（产品编码）只发给正式订单的产品。样品按客户来图编制临时工艺路线试做，不建品号、不建 BOM、不做程序可开工确认，全程以「图号 + 样品单号」标识；转量产时才由业务提交 BOM 申请建立品号，并回填本样品单号。"
          />

          <el-alert
            v-else-if="isStock"
            class="inline-alert"
            type="info"
            :closable="false"
            show-icon
            title="备料订单不新建品号"
            description="备料是为已量产产品提前投产，必须引用该图号既有的品号；若该产品尚未正式量产（无品号），不允许开备料订单。"
          />
        </el-card>

        <el-card v-if="isFormal" shadow="never">
          <template #header>
            <span class="card-title">三、备料领用（可选）</span>
          </template>

          <el-form-item label="关联备料订单">
            <el-select
              v-model="form.stockOrderNo"
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

          <el-form-item v-if="form.stockOrderNo" label="新产单件成本">
            <el-input v-model="form.produceUnitCost" placeholder="新投产部分的单件生产成本" />
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
                <em>订单数量 {{ form.quantity }} 件</em>
              </div>
            </div>
            <p class="stock-calc__formula">
              计算式：（{{ stockUsage.stockUnitCost }} × {{ stockUsage.usedQty }} +
              {{ stockUsage.produceUnitCost }} × {{ stockUsage.produceQty }}）÷ {{ form.quantity }}
              = {{ stockUsage.blendedUnitCost }} 元/件；备料余量领用后自动扣减，扣完即关闭该备料订单。
            </p>
          </div>
        </el-card>

        <el-card shadow="never">
          <template #header>
            <span class="card-title">{{ isFormal ? '四、价格' : '三、价格' }}</span>
          </template>

          <el-row :gutter="16">
            <el-col :span="8">
              <el-form-item label="原始输入单价" prop="originalUnitPrice">
                <el-input v-model="form.originalUnitPrice" placeholder="按客户确认价录入" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="币种">
                <el-select v-model="form.currency" style="width: 100%">
                  <el-option label="CNY" value="CNY" />
                  <el-option label="USD" value="USD" />
                  <el-option label="EUR" value="EUR" />
                  <el-option label="HKD" value="HKD" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="税率">
                <el-select v-model="form.taxRate" style="width: 100%">
                  <el-option label="13%（内销）" value="0.13" />
                  <el-option label="0%（出口）" value="0" />
                  <el-option label="6%" value="0.06" />
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>

          <HkPriceBreakdown
            v-if="hk"
            :hk="hk"
            :currency="form.currency"
            :quantity="form.quantity || '0'"
          />
          <el-empty v-else description="填写客户与原始单价后自动试算" :image-size="60" />
        </el-card>

        <el-card v-if="isStock" shadow="never">
          <template #header><span class="card-title">备料订单专项</span></template>
          <el-form-item label="预计生产成本">
            <el-input v-model="form.estimatedCost" placeholder="备料订单不产生客户应收，但全额核算成本" />
          </el-form-item>
          <el-form-item label="备料原因">
            <el-input
              v-model="form.freeReason"
              type="textarea"
              :rows="2"
              placeholder="如：客户滚动需求，提前备料压缩交期"
            />
          </el-form-item>
        </el-card>

        <el-card v-if="needFreeFields" shadow="never">
          <template #header>
            <span class="card-title">免费 / 部分收费专项（四项要素缺一不可）</span>
          </template>

          <el-form-item label="费用承担方">
            <el-input v-model="form.costOwner" placeholder="如：客户承担 60% / 公司承担 40%" />
          </el-form-item>
          <el-form-item label="预计成本">
            <el-input v-model="form.estimatedCost" placeholder="免费不等于无成本，仍需全额核算" />
          </el-form-item>
          <el-form-item label="免费 / 减免原因">
            <el-input
              v-model="form.freeReason"
              type="textarea"
              :rows="2"
              placeholder="如：量产订单达 5 万件后返还公司承担部分"
            />
          </el-form-item>
        </el-card>
      </el-form>

      <aside class="create-side">
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
      </aside>
    </div>
  </div>
</template>

<style scoped>
.lines__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--wfx-text-muted);
}

.lines {
  width: 100%;
}

.lines__total {
  margin-top: 8px;
  font-size: 12.5px;
  font-weight: 600;
  text-align: right;
  color: var(--wfx-navy);
}

.po {
  display: flex;
  gap: 10px;
  align-items: center;
}

.po__file {
  font-size: 12.5px;
  color: var(--el-color-success);
}

.po__required {
  font-size: 12px;
  color: var(--el-color-danger);
}

.po__optional {
  font-size: 12px;
  color: var(--wfx-text-muted);
}

.gap-alert {
  margin-bottom: 14px;
}

.inline-alert {
  margin-top: 4px;
}

.form-alert {
  margin-bottom: 16px;
}

.create-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 16px;
  align-items: start;
}

.create-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.create-side {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

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

@media (max-width: 1400px) {
  .create-grid {
    grid-template-columns: 1fr;
  }
}
</style>
