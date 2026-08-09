import type { RouteRecordRaw } from 'vue-router'

/** 业务部路由：全部挂在 MainLayout 下，路径与 menu.config.ts 保持一致。 */
export const salesRoutes: RouteRecordRaw[] = [
  {
    path: '/sales',
    name: 'sales-dashboard',
    component: () => import('@/pages/sales/dashboard/SalesDashboardPage.vue'),
    meta: { title: '业务工作台' },
  },
  {
    path: '/sales/quotations',
    name: 'sales-quotations',
    component: () => import('@/pages/sales/quotations/QuotationsPage.vue'),
    meta: { title: '报价管理' },
  },
  {
    // 成本核算已并入报价管理页签，旧链接保留跳转
    path: '/sales/cost-analysis',
    redirect: '/sales/quotations?tab=cost',
  },
  {
    path: '/sales/orders',
    name: 'sales-orders',
    component: () => import('@/pages/sales/orders/SalesOrderListPage.vue'),
    meta: { title: '订单管理' },
  },
  {
    path: '/sales/orders/create',
    name: 'sales-order-create',
    component: () => import('@/pages/sales/orders/SalesOrderCreatePage.vue'),
    meta: { title: '新建业务订单' },
  },
  {
    path: '/sales/tracking',
    name: 'sales-tracking',
    component: () => import('@/pages/sales/tracking/OrderTrackingPage.vue'),
    meta: { title: '订单追踪' },
  },
  {
    path: '/sales/customers',
    name: 'sales-customers',
    component: () => import('@/pages/sales/customers/CustomerListPage.vue'),
    meta: { title: '客户信息管理' },
  },
  {
    path: '/sales/bom-requests',
    name: 'sales-bom-requests',
    component: () => import('@/pages/sales/bom/BomRequestPage.vue'),
    meta: { title: 'BOM 申请' },
  },
  {
    path: '/sales/ecn',
    name: 'sales-ecn',
    component: () => import('@/pages/sales/ecn/EcnRequestPage.vue'),
    meta: { title: 'ECN 申请' },
  },
  {
    path: '/sales/shipments',
    name: 'sales-shipments',
    component: () => import('@/pages/sales/shipments/ShipmentListPage.vue'),
    meta: { title: '出货管理' },
  },
  {
    path: '/sales/returns',
    name: 'sales-returns',
    component: () => import('@/pages/sales/returns/SalesReturnListPage.vue'),
    meta: { title: '退货管理' },
  },
  {
    path: '/sales/statements',
    name: 'sales-statements',
    component: () => import('@/pages/sales/statements/StatementPage.vue'),
    meta: { title: '对账单' },
  },
  {
    path: '/sales/invoices',
    name: 'sales-invoices',
    component: () => import('@/pages/sales/invoices/InvoiceRequestPage.vue'),
    meta: { title: '发票申请' },
  },
  {
    path: '/sales/customs',
    name: 'sales-customs',
    component: () => import('@/pages/sales/customs/CustomsDossierPage.vue'),
    meta: { title: '报关资料' },
  },
  {
    path: '/sales/analytics',
    name: 'sales-analytics',
    component: () => import('@/pages/sales/analytics/SalesAnalyticsPage.vue'),
    meta: { title: '数据分析' },
  },
]
