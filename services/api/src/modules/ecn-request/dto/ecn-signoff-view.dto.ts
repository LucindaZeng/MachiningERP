/** 会签记录。`proxied` 让「工程代签」在界面上无法被误认成部门自己签的。 */
export interface EcnSignoffView {
  department: string
  signedBy: string | null
  signedAt: string | null
  opinion: string | null
  proxied: boolean
}
