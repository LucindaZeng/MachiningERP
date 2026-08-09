/** 部门对外表示。controller 只认本 DTO，不接触仓储层类型（development-guide 3.4）。 */
export interface DepartmentDto {
  id: string
  code: string
  name: string
  shortName: string | null
  parentId: string | null
  sortOrder: number
}
