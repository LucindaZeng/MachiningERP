import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    /** 免登录访问 */
    public?: boolean
    /** 浏览器标题 */
    title?: string
    /** 部门模块总览页的模块标识，对应 pages/modules/module-catalog.ts */
    moduleKey?: string
  }
}
