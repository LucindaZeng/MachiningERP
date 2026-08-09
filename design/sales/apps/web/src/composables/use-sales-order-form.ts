import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { isBizError } from '@/api/biz-error'
import { fetchCustomers } from '@/api/sales/customer.api'
import { calculateHkPrice, createSalesOrder } from '@/api/sales/sales-order.api'
import { fetchStockOrders } from '@/api/sales/stock-order.api'
import type {
  ChargeMode,
  Customer,
  HkPricing,
  OrderLine,
  OrderType,
  StockOrder,
} from '@/types/sales.types'

export interface SalesOrderFormModel {
  customerCode: string
  orderType: OrderType
  chargeMode: ChargeMode
  productName: string
  drawingNo: string
  quantity: string
  originalUnitPrice: string
  currency: string
  taxRate: string
  deliveryDate: string
  quotationNo: string
  bomRequestNo: string
  itemCode: string
  customerPoNo: string
  costOwner: string
  freeReason: string
  estimatedCost: string
  /** 关联的备料订单单号（正式订单可领用备料） */
  stockOrderNo: string
  /** 新投产部分的单件生产成本 */
  produceUnitCost: string
  /** 客户订单原件附件名（模具 / 正式订单强制；样品订单有价格时强制） */
  poFile: string
  /** 一张单多项产品的明细行 */
  lines: OrderLine[]
}

function emptyLine(seq: number): OrderLine {
  return {
    seq,
    productName: '',
    drawingNo: '',
    itemCode: '',
    quantity: '',
    unitPrice: '',
    amount: '0.00',
    deliveryDate: '',
  }
}

export interface BlockingCheck {
  label: string
  passed: boolean
  hint: string
}

/** ORD-01 建单：四类订单规则、备料领用加权成本、HK 70% 试算与阻断校验集中在此。 */
export function useSalesOrderForm() {
  const router = useRouter()
  const formRef = ref<FormInstance>()
  const customers = ref<Customer[]>([])
  const stockOrders = ref<StockOrder[]>([])
  const submitting = ref(false)
  const errorMessage = ref('')
  const hk = ref<HkPricing | null>(null)

  const form = reactive<SalesOrderFormModel>({
    customerCode: '',
    orderType: 'formal',
    chargeMode: 'charged',
    productName: '',
    drawingNo: '',
    quantity: '',
    originalUnitPrice: '',
    currency: 'CNY',
    taxRate: '0.13',
    deliveryDate: '',
    quotationNo: '',
    bomRequestNo: '',
    itemCode: '',
    customerPoNo: '',
    costOwner: '',
    freeReason: '',
    estimatedCost: '',
    stockOrderNo: '',
    produceUnitCost: '',
    poFile: '',
    lines: [emptyLine(1)],
  })

  /** 明细行合计：数量与金额 */
  const totalQty = computed(() =>
    form.lines.reduce((sum, line) => sum + Number(line.quantity || '0'), 0),
  )

  const totalAmount = computed(() =>
    form.lines.reduce(
      (sum, line) => sum + Number(line.quantity || '0') * Number(line.unitPrice || '0'),
      0,
    ),
  )

  function addLine(): void {
    form.lines.push(emptyLine(form.lines.length + 1))
  }

  function removeLine(index: number): void {
    if (form.lines.length <= 1) {
      return
    }
    form.lines.splice(index, 1)
    form.lines.forEach((line, seq) => {
      line.seq = seq + 1
    })
  }

  /** 第一项产品同步到订单主字段：HK 试算、备料领用与校验沿用主字段口径 */
  watch(
    () => form.lines.map((line) => `${line.productName}|${line.drawingNo}|${line.itemCode}|${line.quantity}|${line.unitPrice}`).join(),
    () => {
      const first = form.lines[0]
      form.productName = first.productName
      form.drawingNo = first.drawingNo
      form.itemCode = first.itemCode ?? ''
      form.quantity = String(totalQty.value || '')
      form.originalUnitPrice = first.unitPrice
      form.lines.forEach((line) => {
        line.amount = (Number(line.quantity || '0') * Number(line.unitPrice || '0')).toFixed(2)
      })
    },
  )

  /** 交期：订单级交期回填到未单独指定交期的明细行 */
  watch(
    () => form.deliveryDate,
    (value) => {
      form.lines.forEach((line) => {
        if (!line.deliveryDate) {
          line.deliveryDate = value
        }
      })
    },
  )

  const selectedCustomer = computed(() =>
    customers.value.find((item) => item.code === form.customerCode),
  )

  const isFormal = computed(() => form.orderType === 'formal')
  const isStock = computed(() => form.orderType === 'stock')
  /** 样品订单不建 BOM：按客户来图编制临时工艺路线试做，转量产时才提 BOM 申请 */
  const isSample = computed(() => form.orderType === 'sample')
  const needFreeFields = computed(
    () => !isFormal.value && !isStock.value && form.chargeMode !== 'charged',
  )

  /** 同图号且仍有余量的备料订单 */
  const availableStock = computed(() =>
    stockOrders.value.filter(
      (item) =>
        item.status === 'stocked' &&
        Number(item.remainingQty) > 0 &&
        (!form.drawingNo || item.drawingNo === form.drawingNo),
    ),
  )

  const selectedStock = computed(() =>
    stockOrders.value.find((item) => item.docNo === form.stockOrderNo),
  )

  /** 备料领用与加权平均成本：(备料单价×领用数 + 新产单价×新产数) / 订单数量 */
  const stockUsage = computed(() => {
    const stock = selectedStock.value
    const quantity = Number(form.quantity || '0')
    if (!stock || !quantity) {
      return null
    }
    const usedQty = Math.min(quantity, Number(stock.remainingQty))
    const produceQty = quantity - usedQty
    const produceUnitCost = Number(form.produceUnitCost || '0')
    const blended =
      (Number(stock.unitCost) * usedQty + produceUnitCost * produceQty) / quantity
    return {
      stockOrderNo: stock.docNo,
      usedQty: String(usedQty),
      stockUnitCost: stock.unitCost,
      produceQty: String(produceQty),
      produceUnitCost: produceUnitCost.toFixed(2),
      blendedUnitCost: blended.toFixed(2),
    }
  })

  const rules: FormRules<SalesOrderFormModel> = {
    customerCode: [{ required: true, message: '请选择客户', trigger: 'change' }],
    productName: [{ required: true, message: '请输入产品名称', trigger: 'blur' }],
    drawingNo: [{ required: true, message: '请输入图号', trigger: 'blur' }],
    quantity: [{ required: true, message: '请输入数量', trigger: 'blur' }],
    deliveryDate: [
      { required: true, message: '客户交期为必填项', trigger: 'change' },
    ],
    customerPoNo: [
      {
        trigger: 'blur',
        validator: (_r, value: string, cb) =>
          isFormal.value && !value?.trim()
            ? cb(new Error('正式业务订单必须关联客户原始订单号'))
            : cb(),
      },
    ],
    quotationNo: [
      {
        trigger: 'blur',
        validator: (_r, value: string, cb) =>
          isFormal.value && !value?.trim()
            ? cb(new Error('正式业务订单必须关联已确认报价 / 核价单'))
            : cb(),
      },
    ],
    originalUnitPrice: [
      {
        trigger: 'blur',
        validator: (_r, value: string, cb) =>
          isFormal.value && !Number(value || '0')
            ? cb(new Error('正式业务订单价格不能为零（ORD_2003）'))
            : cb(),
      },
    ],
  }

  /** 需要上传客户订单原件：模具 / 正式订单一律要；样品订单只要有价格就要 */
  const needPoFile = computed(
    () =>
      isFormal.value ||
      form.orderType === 'mold' ||
      (isSample.value && Number(form.originalUnitPrice || '0') > 0),
  )

  /** 工程资料齐套：缺任一项都不允许下单 */
  const engineeringGaps = computed<string[]>(() => {
    const gaps: string[] = []
    if (isSample.value) {
      return gaps
    }
    if (!form.quotationNo.trim()) {
      gaps.push('已确认报价单')
    }
    if (!form.quotationNo.trim() || !form.itemCode.trim()) {
      gaps.push('对应的成本分析（核价单）')
    }
    if (!form.itemCode.trim()) {
      gaps.push(form.orderType === 'mold' ? '模具编号' : '品号')
    }
    if (isFormal.value && !form.bomRequestNo.trim()) {
      gaps.push('BOM 可下单确认')
    }
    if (isFormal.value && !form.drawingNo.trim()) {
      gaps.push('图纸与图号')
    }
    return gaps
  })

  /** 提交前的阻断清单：界面上逐条可见，未全绿不允许提交。 */
  const checks = computed<BlockingCheck[]>(() => {
    const base: BlockingCheck[] = [
      {
        label: '产品明细至少一行且数量、单价完整',
        passed: form.lines.every(
          (line) =>
            line.productName.trim() &&
            line.drawingNo.trim() &&
            Number(line.quantity || '0') > 0 &&
            (isStock.value || Number(line.unitPrice || '0') > 0 || !isFormal.value),
        ),
        hint: '一张订单可下多项产品；每一行必须有产品名称、图号与数量，正式订单还必须有非零单价',
      },
      {
        label: '工程资料齐套（报价 / 成本分析 / 品号 / BOM / 图纸）',
        passed: engineeringGaps.value.length === 0,
        hint:
          engineeringGaps.value.length === 0
            ? '该产品的报价单、成本分析、品号、BOM 与图纸均已齐套，可以下单'
            : `缺少：${engineeringGaps.value.join('、')}。缺任一项一律不能下单，请先补齐后再提交。`,
      },
      {
        label: '客户交期已填写',
        passed: Boolean(form.deliveryDate),
        hint: '客户交期为必填项，交期直接决定 PMC 排产与在手订单预警',
      },
      {
        label: needPoFile.value ? '客户订单原件已上传' : '本类型无需上传客户订单原件',
        passed: !needPoFile.value || Boolean(form.poFile),
        hint: '模具订单与正式业务订单必须上传客户订单原件；样品订单只要收费也必须上传，免费样品可豁免',
      },
      {
        label: '关联客户原始订单',
        passed: !isFormal.value || Boolean(form.customerPoNo.trim()),
        hint: '正式业务订单必须上传或关联客户 PO，缺失时财务审核会立即阻断退回',
      },
      {
        label: '关联已确认报价 / 核价',
        passed: !isFormal.value || Boolean(form.quotationNo.trim()),
        hint: '订单与报价差异超阈值需强制说明并重新核价',
      },
      {
        label: '正式订单强制收费且价格非零',
        passed:
          !isFormal.value || (form.chargeMode === 'charged' && Number(form.originalUnitPrice) > 0),
        hint: '正式业务订单不允许免费或零价绕过（ORD_2003 / ORD_2004）',
      },
      {
        label: '免费 / 部分收费四项要素完整',
        passed:
          !needFreeFields.value || Boolean(form.costOwner && form.estimatedCost && form.freeReason),
        hint: '模具 / 样品免费或部分收费必须填费用承担方、预计成本、原因并完成审批',
      },
      {
        label: 'HK 70% 价格一致性',
        passed: isPriceConsistent(),
        hint: '原始价 × 系数必须等于计算后价格，防止业务先手工乘 70% 造成重复折算',
      },
    ]

    if (isSample.value) {
      base.push({
        label: '样品订单免品号、免 BOM',
        passed: true,
        hint: '品号只发给正式订单的产品；样品按客户来图编制临时工艺路线试做，全程以「图号 + 样品单号」标识，转量产时才建品号与 BOM',
      })
    } else if (isStock.value) {
      base.push({
        label: '引用已量产产品的既有品号',
        passed: Boolean(form.itemCode.trim()),
        hint: '备料订单不新建品号，必须引用该图号已量产的品号；无品号说明该产品尚未正式量产，不允许备料',
      })
    } else {
      base.push({
        label: isFormal.value ? '品号与 BOM 已确认可下单' : '模具编号已建立',
        passed: Boolean(form.itemCode.trim()) && (!isFormal.value || Boolean(form.bomRequestNo.trim())),
        hint: isFormal.value
          ? '正式订单必须有工程建立的品号，并关联回传「BOM 可下单」的申请单号；程序可开工是另一状态，不可合并判定'
          : '模具订单建的是模具编号而不是品号，由 BOM 申请（模具用途）回传',
      })
    }

    if (isStock.value) {
      base.push({
        label: '备料订单预计成本与备料原因',
        passed: Boolean(form.estimatedCost && form.freeReason),
        hint: '备料订单无客户应收，必须填写预计成本与备料原因供财务审核占用资金',
      })
    }

    if (form.stockOrderNo) {
      base.push({
        label: '备料领用与加权成本已试算',
        passed: Boolean(stockUsage.value) && Number(form.produceUnitCost) > 0,
        hint: '领用备料时必须录入新投产部分的单件成本，系统按加权平均计入订单成本',
      })
    }

    return base
  })

  const canSubmit = computed(() => checks.value.every((item) => item.passed))

  function isPriceConsistent(): boolean {
    if (!hk.value) {
      return true
    }
    const expected = Number(hk.value.originalUnitPrice) * hk.value.factor
    return Math.abs(expected - Number(hk.value.finalUnitPrice)) < 0.005
  }

  async function refreshHkPrice(): Promise<void> {
    if (!form.customerCode || !form.originalUnitPrice) {
      hk.value = null
      return
    }
    hk.value = await calculateHkPrice({
      customerCode: form.customerCode,
      orderType: form.orderType,
      originalUnitPrice: form.originalUnitPrice,
      quantity: form.quantity || '0',
    })
  }

  function onOrderTypeChange(value: OrderType): void {
    form.orderType = value
    if (value === 'formal') {
      form.chargeMode = 'charged'
    } else if (value === 'stock') {
      form.chargeMode = 'internal'
      form.originalUnitPrice = '0'
      form.stockOrderNo = ''
    }
    void refreshHkPrice()
  }

  async function submit(): Promise<void> {
    const valid = await formRef.value?.validate().catch(() => false)
    if (!valid || !canSubmit.value) {
      showBlockedHint()
      return
    }

    submitting.value = true
    errorMessage.value = ''
    try {
      const order = await createSalesOrder({ ...form })
      ElMessage.success(`订单 ${order.docNo} 已提交业务经理审核，T0 已起算`)
      await router.push('/sales/orders')
    } catch (error) {
      errorMessage.value = isBizError(error) ? error.message : '提交失败，请稍后重试'
    } finally {
      submitting.value = false
    }
  }

  function showBlockedHint(): void {
    errorMessage.value = '存在未通过的阻断校验项，请按右侧清单补齐后再提交'
  }

  watch(
    () => [form.customerCode, form.originalUnitPrice, form.quantity],
    () => {
      void refreshHkPrice()
    },
  )

  onMounted(async () => {
    customers.value = await fetchCustomers()
    stockOrders.value = await fetchStockOrders()
  })

  /** 上传客户订单原件（原型阶段用文件名占位） */
  function pickPoFile(): void {
    form.poFile = `${form.customerPoNo || 'CUSTOMER-PO'}.pdf`
    ElMessage.success('客户订单原件已上传并归档到订单附件')
  }

  return {
    form,
    formRef,
    rules,
    totalQty,
    totalAmount,
    addLine,
    removeLine,
    needPoFile,
    engineeringGaps,
    pickPoFile,
    customers,
    stockOrders,
    availableStock,
    selectedStock,
    stockUsage,
    selectedCustomer,
    isFormal,
    isStock,
    isSample,
    needFreeFields,
    hk,
    checks,
    canSubmit,
    submitting,
    errorMessage,
    onOrderTypeChange,
    refreshHkPrice,
    submit,
  }
}
