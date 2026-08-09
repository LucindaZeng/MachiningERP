/** org 模块唯一对外出口。 */

export { OrgModule } from './org.module'
export { DepartmentService } from './services/department.service'
export {
  DEPARTMENT_REPOSITORY,
  type DepartmentRecord,
  type DepartmentRepositoryPort,
} from './repositories/department.repository.port'
