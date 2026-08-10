# apps/web —— 内部十部门前端

技术栈依据 [ADR-0003](../../docs/architecture/adr/0003-technology-stack.md)：Vue 3 + TypeScript + Vite + Pinia + Vue Router + Element Plus。
目录与单一职责规范依据 [开发文档](../../docs/development/development-guide.md)第 1、3 节。

当前已落地：**登录页（SEC 域）** 与 **业务部全模块界面**（工作台、报价管理含成本核算与原材料价格表、订单管理、客户信息、BOM 申请、ECN 申请、出货、退货、报关资料、数据分析）。
其余九个部门在侧栏中以「规划中」占位，待各自里程碑开发。业务部的功能、权限、预警与报表矩阵见
[docs/product/business-department.md](../../docs/product/business-department.md)。

## 启动

```bash
pnpm install
pnpm dev            # http://localhost:5173/login
pnpm build          # vue-tsc 类型检查 + 生产构建
```

后端 `services/api` 尚未开发，`.env.development` 中 `VITE_USE_MOCK=true` 时全部接口走前端 mock；
auth 模块上线后改为 `false`，请求经 Vite 代理转发到 `VITE_API_PROXY_TARGET`。

开发调试用的临时账号只写在 `src/api/mock/mock-accounts.ts`，**不在登录界面展示**；接后端时随 `src/api/mock/` 一并删除。

## 登录页设计要点

| 需求 | 实现 |
| --- | --- |
| 公司 LOGO | 卡片顶部整条白色标识区展示完整彩色 LOGO（横版含中英文全称，显示宽 560px、2 倍图 `wanfuxin-logo-full.png`），**保持 VI 原配色不做反白**；主色 `#0B357B`、辅色 `#DF911E` 已写入 `src/styles/tokens.css` 并覆盖 Element Plus 主题。`src/assets/brand/` 另存反白与纯标版本，供后续深色页头/打印场景取用 |
| 内外账号分域 | 「内部员工 / 客户·供应商门户」入口切换，`audience` 随登录请求提交，对应 ADR-0004 与 api-conventions 的 `audience` 隔离 |
| 图形验证码 | 连续 3 次密码错误后强制出现（`AUTH_1003`），一次性校验、120 秒过期、点击图片刷新；8 次后临时锁定（`AUTH_1005`） |
| 记住我 | 仅在 localStorage 保存账号与入口，**不保存密码与 token**；token 放 sessionStorage，关闭浏览器即失效 |
| 忘记密码 | 提交重置申请给 IT 系统管理员：账号、姓名、部门/单位、联系方式、申请说明；返回申请单号 `PRRyyyyMMddnnnn` 与受理提示，管理员在后台核实身份后重置 |
| 响应式 | ≥960px 左右分栏；<960px 品牌区收起为顶部条，适配车间平板与手机 |

## 业务部模块要点

| 页面 | 需求编号 | 界面上强制体现的规则 |
| --- | --- | --- |
| 业务工作台 | — | 待办队列、六项经营指标、五级预警（含触发值/阈值/责任人/升级人/建议动作）、审批 P90 与退回率 |
| 报价管理（含成本核算、原材料价格表页签） | QTN-01/02/03 · MKT | 报价单页签：版本与客户确认版本分列、毛利低于阈值提示会签、节点计时含首次查看与超期时长；成本核算页签：九项成本实时算毛利、供应商底价按字段权限锁定、行情快照过期拦截；原材料价格表页签：市场基准价与企业落地参考价、日/周/月涨跌与 30 日走势、实时性标识（实时/延时/日结/人工审批价）、一键生成价格快照，业务视图不含供应商身份与底价 |
| 客户信息管理 | ENG-01 | 业务字段与财务字段分区，税号银行脱敏；本人创建不可自审 |
| 订单管理（下单） | ORD-01~04 | 订单类型与收费方式独立；正式订单强制收费且零价阻断；提交前阻断清单 + 审批链预览 |
| BOM 申请 | ENG-02 / ENG-05 | 关联报价与客户原始资料校验；**「BOM 可下单」与「程序可开工」双状态分列**，程序未完成不得显示为全部工程完成；退回等待时间累计 |
| ECN 申请 | ECN-01~05 | 变更前后对照；四类影响范围评估；改图未同步工艺路线阻断发布；影响价格或交期自动触发重新核价与订单重审 |
| 出货管理 | SHP-01~06 | 需求/合格/包装/已发四数同屏比对；尾数四路径处理与数量平衡校验 |
| 退货管理 | RMA-01~05 | 责任归属与处置方式分列；退款/让步升级财务与总经办 |
| 报关资料 | EXP-01~04 | 申报要素齐套校验，缺项禁止生成；四份模板由 docgen 出并留版本 |
| 数据分析 | BI | 趋势 / Top 客户 / 三类订单结构 / 转化漏斗 / 报价与实际毛利差异；每张图带口径与来源单据，配表格视图。分类色经 dataviz 校验器验证 |

## 目录

```
src/
  api/            # 一模块一文件的接口封装 + mock（http.ts 只做传输）
  api/sales/      # 业务部接口；mock 数据在 api/mock/sales/
  components/     # 通用展示组件与状态字典（M0 后下沉 packages/ui）
  composables/    # 取数与表单逻辑（use-login-form / use-sales-order-form / ...）
  layouts/        # 主框架：侧栏菜单、顶栏、菜单配置
  pages/sales/    # 业务部页面，页面只做编排，展示拆到 components/
  stores/         # Pinia 会话状态
  styles/         # 品牌设计令牌与全局样式
  types/          # 认证与业务契约类型（M0 后迁至 packages/shared）
```

## 待办（接后端时）

1. `services/api` 的 auth 模块实现 `POST /auth/login`、`GET /auth/captcha`、`POST /auth/password-reset-requests`，响应包裹与错误码见 [接口规范](../../docs/api/api-conventions.md)。
2. 图形验证码改由后端出图并绑定会话，前端删除 `src/api/mock/`。
3. 密码重置申请落库并进入 alerts / 审计（谁申请、谁重置、耗时多久）。
4. 登录失败次数、锁定策略、密码强度与有效期由 identity 模块统一配置。
5. 公共组件下沉 `packages/ui`，认证契约类型下沉 `packages/shared`。
