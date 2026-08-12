/**
 * 跨部门会签（ECN-03）的参与方。
 *
 * ⚠️ 这五个部门的模块**都还没上线**。现阶段由工程岗代签，每条记录标 `proxied`，
 * 审计里一眼能看出「这不是 PMC 自己签的」。
 *
 * 为什么现在就把表建成最终形态、而不是等模块上线再说：会签记录是**批准的依据**，
 * 事后补不回来。等 PMC 上线才开始记，中间这段时间批准过的变更就永远说不清
 * 当时谁看过、有没有人提过异议。
 */
export const ECN_SIGNOFF_DEPARTMENTS = ['PMC', '采购', '生产', '品质', '财务'] as const

export type EcnSignoffDepartment = (typeof ECN_SIGNOFF_DEPARTMENTS)[number]

/** 代签说明，写进会签意见里——不写清楚，日后没人分得清哪些是真签的。 */
export const PROXY_SIGNOFF_NOTE = '该部门模块尚未上线，由工程岗代签'
