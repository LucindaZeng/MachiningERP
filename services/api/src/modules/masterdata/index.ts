/** masterdata 模块唯一对外出口（当前覆盖客户档案，后续扩物料/图纸/BOM/工艺路线）。 */

export { MasterdataModule } from './masterdata.module'

export { CustomerService } from './services/customer.service'
export type { CreateCustomerInput } from './services/customer-create-input'
export { toCreateCustomerData } from './services/customer-create.mapper'
export { CustomerUpdateService, type UpdateCustomerResult } from './services/customer-update.service'
export { CustomerChangeApprovalService } from './services/customer-change-approval.service'

export {
  checkCustomerCompleteness,
  type CompletenessResult,
  type CustomerCompletenessSnapshot,
} from './services/customer-completeness.rules'
export {
  validateCustomerProfile,
  MAX_DELIVERY_ADDRESSES,
  BPS_SCALE,
  type CustomerProfileInput,
  type ValidationIssue,
} from './services/customer-validation.rules'
export { toCustomerView, toCustomerViews, type Viewer } from './services/customer-visibility'
export {
  splitCustomerChanges,
  changesToPatch,
  describeChanges,
  type FieldChange,
} from './services/customer-change-diff'
export {
  SENSITIVE_CUSTOMER_FIELDS,
  isSensitiveField,
  labelOfSensitiveField,
} from './constants/customer-sensitive-fields'

export type { CustomerView } from './dto/customer-view.dto'
export {
  CUSTOMER_REPOSITORY,
  type CustomerRecord,
  type CustomerRepositoryPort,
} from './repositories/customer.repository.port'
export {
  CUSTOMER_CHANGE_REQUEST_REPOSITORY,
  type CustomerChangeRequestRecord,
  type CustomerChangeRequestRepositoryPort,
} from './repositories/customer-change-request.repository.port'
