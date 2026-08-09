import type { SalesOrderFormModel } from './form-model'
import type { FormRules } from 'element-plus'

/**
 * Element Plus 表单规则。
 * 正式订单的三条硬校验（客户 PO / 报价 / 非零价）只在正式类型下生效，
 * 所以这里收一个 getter 而不是布尔快照——否则用户切换订单类型后规则会停在旧口径上。
 */
export function createSalesOrderRules(isFormal: () => boolean): FormRules<SalesOrderFormModel> {
  return {
    customerCode: [{ required: true, message: '请选择客户', trigger: 'change' }],
    productName: [{ required: true, message: '请输入产品名称', trigger: 'blur' }],
    drawingNo: [{ required: true, message: '请输入图号', trigger: 'blur' }],
    quantity: [{ required: true, message: '请输入数量', trigger: 'blur' }],
    deliveryDate: [{ required: true, message: '客户交期为必填项', trigger: 'change' }],
    customerPoNo: [
      {
        trigger: 'blur',
        validator: (_r, value: string, cb) =>
          isFormal() && !value?.trim() ? cb(new Error('正式业务订单必须关联客户原始订单号')) : cb(),
      },
    ],
    quotationNo: [
      {
        trigger: 'blur',
        validator: (_r, value: string, cb) =>
          isFormal() && !value?.trim()
            ? cb(new Error('正式业务订单必须关联已确认报价 / 核价单'))
            : cb(),
      },
    ],
    originalUnitPrice: [
      {
        trigger: 'blur',
        validator: (_r, value: string, cb) =>
          isFormal() && !Number(value || '0')
            ? cb(new Error('正式业务订单价格不能为零（ORD_2003）'))
            : cb(),
      },
    ],
  }
}
