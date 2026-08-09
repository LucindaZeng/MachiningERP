export { NumberingModule } from './numbering.module'
export { DocNumberService } from './services/doc-number.service'
export { DOC_TYPES, type DocType } from './constants/doc-types'
export {
  formatDocNumber,
  periodKeyFor,
  formatDateSegment,
  type DocNumberPattern,
} from './services/doc-number-format'
export {
  DOC_NUMBER_REPOSITORY,
  type DocNumberRepositoryPort,
  type DocNumberRuleRecord,
} from './repositories/doc-number.repository.port'
