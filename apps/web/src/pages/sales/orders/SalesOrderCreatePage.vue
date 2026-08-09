<script setup lang="ts">
import { useRouter } from 'vue-router'

import DraftToolbar from '@/components/DraftToolbar.vue'
import PageHeader from '@/components/PageHeader.vue'
import { useFormDraft } from '@/composables/use-form-draft'
import { useSalesOrderForm } from '@/composables/use-sales-order-form'

import OrderCostFieldsCard from './components/OrderCostFieldsCard.vue'
import OrderCustomerCard from './components/OrderCustomerCard.vue'
import OrderPriceCard from './components/OrderPriceCard.vue'
import OrderProductCard from './components/OrderProductCard.vue'
import OrderStockUsageCard from './components/OrderStockUsageCard.vue'
import OrderSubmitChecklist from './components/OrderSubmitChecklist.vue'

const router = useRouter()

/** 页面只做编排：取数与规则全部落在 use-sales-order-form，模板片段落在 components/ */
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

const {
  drafts,
  lastSavedAt,
  save: saveDraft,
  load: loadDraft,
  remove: removeDraft,
} = useFormDraft('sales-order-create', form)
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
        <OrderCustomerCard
          v-model:customer-code="form.customerCode"
          v-model:charge-mode="form.chargeMode"
          :order-type="form.orderType"
          :customers="customers"
          :selected-customer="selectedCustomer"
          :is-formal="isFormal"
          :is-stock="isStock"
          @order-type-change="onOrderTypeChange"
        />

        <el-alert
          v-if="engineeringGaps.length"
          class="gap-alert"
          type="error"
          :closable="false"
          show-icon
          :title="`工程资料不齐套，不能下单：缺少${engineeringGaps.join('、')}`"
          description="按下单前置校验，产品缺少报价单、成本分析、品号、BOM 或图纸中的任意一项，一律禁止提交订单。请先在报价管理完成报价与核价、在 BOM 申请取得品号与「BOM 可下单」确认后再下单；样品订单免品号与 BOM，不受此校验约束。"
        />

        <OrderProductCard
          v-model:delivery-date="form.deliveryDate"
          v-model:customer-po-no="form.customerPoNo"
          v-model:quotation-no="form.quotationNo"
          v-model:item-code="form.itemCode"
          v-model:bom-request-no="form.bomRequestNo"
          :lines="form.lines"
          :total-qty="totalQty"
          :total-amount="totalAmount"
          :currency="form.currency"
          :po-file="form.poFile"
          :need-po-file="needPoFile"
          :is-formal="isFormal"
          :is-sample="isSample"
          :is-stock="isStock"
          @add-line="addLine"
          @remove-line="removeLine"
          @pick-po-file="pickPoFile"
        />

        <OrderStockUsageCard
          v-if="isFormal"
          v-model:stock-order-no="form.stockOrderNo"
          v-model:produce-unit-cost="form.produceUnitCost"
          :available-stock="availableStock"
          :stock-usage="stockUsage"
          :quantity="form.quantity"
        />

        <OrderPriceCard
          v-model:original-unit-price="form.originalUnitPrice"
          v-model:currency="form.currency"
          v-model:tax-rate="form.taxRate"
          :title="isFormal ? '四、价格' : '三、价格'"
          :hk="hk"
          :quantity="form.quantity"
        />

        <OrderCostFieldsCard
          v-model:cost-owner="form.costOwner"
          v-model:estimated-cost="form.estimatedCost"
          v-model:free-reason="form.freeReason"
          :is-stock="isStock"
          :need-free-fields="needFreeFields"
        />
      </el-form>

      <aside class="create-side">
        <OrderSubmitChecklist :checks="checks" />
      </aside>
    </div>
  </div>
</template>

<style scoped>
.gap-alert {
  margin-bottom: 14px;
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

@media (max-width: 1400px) {
  .create-grid {
    grid-template-columns: 1fr;
  }
}
</style>
