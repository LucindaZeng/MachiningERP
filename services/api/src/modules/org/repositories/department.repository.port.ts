export interface DepartmentRecord {
  id: string
  code: string
  name: string
  shortName: string | null
  parentId: string | null
  sortOrder: number
  isActive: boolean
}

export interface DepartmentRepositoryPort {
  listActive(): Promise<DepartmentRecord[]>
  findByCode(code: string): Promise<DepartmentRecord | null>
  findByName(name: string): Promise<DepartmentRecord | null>
}

export const DEPARTMENT_REPOSITORY = Symbol('DEPARTMENT_REPOSITORY')
