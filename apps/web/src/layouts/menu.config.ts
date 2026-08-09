export interface MenuItem {
  path: string
  title: string
  /** 对应需求编号，鼠标悬停可查 */
  code?: string
}

export interface MenuGroup {
  title: string
  items: MenuItem[]
  disabled?: boolean
}

/** 业务部菜单：与 docs/product/business-department.md 的功能矩阵一一对应。 */
export const SALES_MENU: MenuGroup = {
  title: '业务部',
  items: [
    { path: '/sales', title: '业务工作台' },
    { path: '/sales/quotations', title: '报价管理', code: 'QTN-01/02/03（含成本核算、原材料价格表）' },
    { path: '/sales/orders', title: '订单管理', code: 'ORD-01~04' },
    { path: '/sales/tracking', title: '订单追踪', code: 'TRK-01~23' },
    { path: '/sales/customers', title: '客户信息管理', code: 'ENG-01' },
    { path: '/sales/bom-requests', title: 'BOM 申请', code: 'ENG-02 / ENG-05' },
    { path: '/sales/ecn', title: 'ECN 申请', code: 'ECN-01~05' },
    { path: '/sales/shipments', title: '出货管理', code: 'SHP-01~06' },
    { path: '/sales/returns', title: '退货管理', code: 'RMA-01~05' },
    { path: '/sales/statements', title: '对账单', code: 'STM-01~05' },
    { path: '/sales/invoices', title: '发票申请', code: 'INV-01~04' },
    { path: '/sales/customs', title: '报关资料', code: 'EXP-01~04' },
    { path: '/sales/analytics', title: '数据分析', code: 'BI' },
  ],
}

/** 其余部门按十部门蓝图预留，待各自里程碑开发。 */
export const PENDING_MENU: MenuGroup = {
  title: '其他部门（规划中）',
  disabled: true,
  items: [
    { path: '/engineering', title: '工程 / PLM' },
    { path: '/pmc', title: 'PMC 计划与架机' },
    { path: '/procurement', title: '采购 / 委外' },
    { path: '/production', title: '生产 MES' },
    { path: '/post-process', title: '后工序与组装' },
    { path: '/quality', title: '品质 QMS' },
    { path: '/warehouse', title: '仓储 WMS' },
    { path: '/finance', title: '财务与成本' },
    { path: '/admin', title: '行政考勤' },
  ],
}

export const MENU_GROUPS: MenuGroup[] = [SALES_MENU, PENDING_MENU]

export function findMenuTitle(path: string): string {
  const match = MENU_GROUPS.flatMap((group) => group.items).find((item) => item.path === path)
  return match?.title ?? ''
}
