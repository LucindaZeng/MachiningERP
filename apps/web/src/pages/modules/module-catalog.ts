/**
 * 九个部门的模块总览数据：功能清单、关键单据与跨部门数据接口。
 * 与 docs/product/ 下各部门需求文档一一对应，菜单路径见 layouts/menu.config.ts。
 */

export interface ModuleFunction {
  code: string
  title: string
  desc: string
}

export interface ModuleInterface {
  /** 与本模块直接交换数据的部门 */
  party: string
  /** 数据流向：入 = 上游给本模块，出 = 本模块给下游 */
  direction: 'in' | 'out'
  subject: string
}

export interface ModuleSpec {
  key: string
  path: string
  title: string
  code: string
  owner: string
  summary: string
  functions: ModuleFunction[]
  documents: string[]
  interfaces: ModuleInterface[]
}

const ENGINEERING: ModuleSpec = {
  key: 'engineering',
  path: '/engineering',
  title: '工程 / PLM',
  code: 'ENG',
  owner: '工程部',
  summary:
    '承接业务部的图纸与 BOM 申请，负责品号建立、工艺路线编排与工程变更评审。品号是产品在全系统的唯一身份——只有正式订单的产品才建品号，样品与备料不建。',
  functions: [
    { code: 'ENG-01', title: '品号建立与维护', desc: '正式订单产品建品号，样品与备料不建；品号一经启用不可改写，只能走 ECN。' },
    { code: 'ENG-02', title: 'BOM 建立与版本', desc: '接收业务部 BOM 申请与图纸，逐层展开材料与外购件，版本随 ECN 递增。' },
    { code: 'ENG-03', title: '工艺路线编排', desc: '定义 23 个环节中本产品实际经过的工序、标准工时与设备要求，供报价与排产共用。' },
    { code: 'ENG-04', title: '图纸与技术文件管理', desc: '图纸版本、受控发放范围与变更留痕，车间只能取到当前有效版本。' },
    { code: 'ENG-05', title: '工程资料齐套检查', desc: '向业务部下单环节提供齐套状态，缺件即返回阻断原因。' },
    { code: 'ENG-06', title: 'ECN 工程变更评审', desc: '改图、改材料、改表处走 ECN；评估在制品与库存影响后决定处置方式。' },
  ],
  documents: ['品号主档', 'BOM 主档', '工艺路线', 'ECN 变更单'],
  interfaces: [
    { party: '业务部', direction: 'in', subject: 'BOM 建立申请、报价图纸、ECN 申请' },
    { party: '业务部', direction: 'out', subject: '品号、工程资料齐套状态、ECN 评审结果' },
    { party: 'PMC 部', direction: 'out', subject: '工艺路线与标准工时，作为排产依据' },
    { party: '采购部', direction: 'out', subject: 'BOM 材料与外购件需求' },
  ],
}

const PMC: ModuleSpec = {
  key: 'pmc',
  path: '/pmc',
  title: 'PMC 计划与架机',
  code: 'PMC',
  owner: 'PMC 部',
  summary:
    '把订单拆成可执行的工单并排入设备，是交期承诺的唯一出口。业务部看到的交期风险预警、订单追踪的 23 环节进度，源头都在这里。',
  functions: [
    { code: 'PMC-01', title: '主生产计划', desc: '按订单交期、产能负荷与物料齐套滚动排程，输出周计划与日计划。' },
    { code: 'PMC-02', title: '工单下达与拆批', desc: '一张订单可拆多张工单，工单是车间报工与追踪的最小单位。' },
    { code: 'PMC-03', title: '设备架机排程', desc: '按机床能力与夹治具占用排机，识别瓶颈设备并给出改机顺序。' },
    { code: 'PMC-04', title: '物料齐套分析', desc: '开工前核对材料、外购件与刀夹具到位情况，未齐套不放行。' },
    { code: 'PMC-05', title: '交期承诺与风险预警', desc: '计算可承诺交期，交期风险实时回写业务部工作台。' },
    { code: 'PMC-06', title: '产能负荷看板', desc: '按设备组、按周展示负荷率，支撑加班、委外与推单决策。' },
  ],
  documents: ['主生产计划', '生产工单', '架机排程表', '齐套分析表'],
  interfaces: [
    { party: '业务部', direction: 'in', subject: '已评审订单、客户交期、订单修改申请' },
    { party: '业务部', direction: 'out', subject: '可承诺交期、交期风险、工单进度' },
    { party: '工程部', direction: 'in', subject: '工艺路线与标准工时' },
    { party: '生产部', direction: 'out', subject: '工单派工与设备排程' },
  ],
}

const PROCUREMENT: ModuleSpec = {
  key: 'procurement',
  path: '/procurement',
  title: '采购 / 委外',
  code: 'PUR',
  owner: '采购部',
  summary:
    '负责原材料、外购件与委外加工的请购、下单与到货跟催。原材料价格表是报价核价的基准数据，由本模块维护并同步给报价工程师。',
  functions: [
    { code: 'PUR-01', title: '请购与采购订单', desc: '由 BOM 需求与安全库存生成请购，审批后转采购订单。' },
    { code: 'PUR-02', title: '供应商管理与评鉴', desc: '合格供应商名录、准入资料与按交期 / 品质 / 价格的定期评分。' },
    { code: 'PUR-03', title: '原材料价格维护', desc: '维护棒料、板料与标准件的基准价与调价留痕，供报价核价直接引用。' },
    { code: 'PUR-04', title: '委外加工管理', desc: '热处理、表面处理等委外工序的发出、回厂与计价，工序状态回写订单追踪。' },
    { code: 'PUR-05', title: '到货跟催与逾期', desc: '按需求日跟催在途，逾期风险回写 PMC 齐套分析。' },
    { code: 'PUR-06', title: '采购对账与付款申请', desc: '到货、验收与发票三方核对后提付款申请。' },
  ],
  documents: ['请购单', '采购订单', '委外加工单', '原材料价格表'],
  interfaces: [
    { party: '工程部', direction: 'in', subject: 'BOM 材料与外购件需求' },
    { party: '业务部', direction: 'out', subject: '原材料基准价，供报价成本核算引用' },
    { party: 'PMC 部', direction: 'out', subject: '到货计划与在途状态' },
    { party: '仓储部', direction: 'out', subject: '到货通知与收货指令' },
  ],
}

const PRODUCTION: ModuleSpec = {
  key: 'production',
  path: '/production',
  title: '生产 MES',
  code: 'MES',
  owner: '生产部',
  summary:
    '车间执行层，一码到底：扫码报工、工序防错、跨工序返工与批次追溯。订单追踪里每个环节的「完成数 / 工单数」就是本模块的报工实绩。',
  functions: [
    { code: 'MES-01', title: '扫码报工', desc: '按工单 + 工序扫码报工，记录投入数、合格数、不良数与起止时间。' },
    { code: 'MES-02', title: '工序防错与流转控制', desc: '未完成上道工序不得报下道，防止跳序与漏检。' },
    { code: 'MES-03', title: '工时与设备稼动', desc: '按机台归集实际加工工时，作为工序级实际成本的来源。' },
    { code: 'MES-04', title: '不良与返工管理', desc: '不良登记、跨工序返工路径与返工工时单独归集。' },
    { code: 'MES-05', title: '批次追溯', desc: '从成品批次反查材料批次、机台、操作工与检验记录。' },
    { code: 'MES-06', title: '异常上报与停机', desc: '设备、物料、品质异常实时上报，触发订单追踪的红色角标。' },
  ],
  documents: ['生产工单', '报工记录', '不良与返工单', '批次追溯档案'],
  interfaces: [
    { party: 'PMC 部', direction: 'in', subject: '工单派工与设备排程' },
    { party: '业务部', direction: 'out', subject: '23 环节实时进度与异常，驱动订单追踪进度条' },
    { party: '财务部', direction: 'out', subject: '工序级实际工时与不良，支撑实际成本回溯' },
    { party: '品质部', direction: 'out', subject: '报工批次与不良数据' },
  ],
}

const POST_PROCESS: ModuleSpec = {
  key: 'post-process',
  path: '/post-process',
  title: '后工序与组装',
  code: 'PST',
  owner: '后工序部',
  summary:
    '承接机加工之后的打磨、镭雕、表面处理与组装环节，含委外表处的发出与回厂衔接，是出货前的最后一段产线。',
  functions: [
    { code: 'PST-01', title: '打磨与去毛刺', desc: '按工艺要求分级打磨，记录投入与合格数。' },
    { code: 'PST-02', title: '镭雕与丝印', desc: '客户 LOGO、料号与批次的镭雕丝印，含首件确认。' },
    { code: 'PST-03', title: '表面处理衔接', desc: '阳极、电镀、喷涂等委外表处的发出、回厂与外观检验。' },
    { code: 'PST-04', title: '组装与配套', desc: '多零件组装、配套齐套核对与组装工时归集。' },
    { code: 'PST-05', title: '包装与出货备货', desc: '按客户包装要求装箱，生成装箱清单交仓储。' },
  ],
  documents: ['后工序工单', '委外表处单', '装箱清单'],
  interfaces: [
    { party: '生产部', direction: 'in', subject: '机加工完工品与批次信息' },
    { party: '采购部', direction: 'in', subject: '委外表处的供应商与回厂计划' },
    { party: '仓储部', direction: 'out', subject: '包装完成品与装箱清单' },
    { party: '业务部', direction: 'out', subject: '后段环节进度，回写订单追踪' },
  ],
}

const QUALITY: ModuleSpec = {
  key: 'quality',
  path: '/quality',
  title: '品质 QMS',
  code: 'QMS',
  owner: '品质部',
  summary:
    '覆盖来料、首件、制程、出货四道检验与客诉处理。业务部数据分析里的退货质量分析与责任归属，数据源在这里。',
  functions: [
    { code: 'QMS-01', title: '来料检验 IQC', desc: '按抽样方案检验来料，不合格触发退货或特采流程。' },
    { code: 'QMS-02', title: '首件与制程检验', desc: '首件确认后方可批量投产，制程巡检按频次记录。' },
    { code: 'QMS-03', title: '出货检验 OQC', desc: '出货前全尺寸或抽检，生成检验报告随货。' },
    { code: 'QMS-04', title: '不合格品处置', desc: '返工、挑选、让步接收或报废，处置结论影响成本归集。' },
    { code: 'QMS-05', title: '客诉与 8D 处理', desc: '客诉受理、原因分析、纠正预防与结案，责任归属回写业务部。' },
    { code: 'QMS-06', title: '量具与校准管理', desc: '量具台账、校准计划与超期停用控制。' },
  ],
  documents: ['检验报告', '不合格品处置单', '8D 报告', '量具校准台账'],
  interfaces: [
    { party: '生产部', direction: 'in', subject: '报工批次与不良数据' },
    { party: '业务部', direction: 'in', subject: '客户退货申请与客诉' },
    { party: '业务部', direction: 'out', subject: '责任归属、损失金额与检验报告' },
    { party: '采购部', direction: 'out', subject: '来料不合格与供应商扣分' },
  ],
}

const WAREHOUSE: ModuleSpec = {
  key: 'warehouse',
  path: '/warehouse',
  title: '仓储 WMS',
  code: 'WMS',
  owner: '仓储部',
  summary:
    '管材料仓、半成品仓与成品仓的收发存。备料订单的入库与领用、领用时的加权平均成本，都由本模块与财务共同确定。',
  functions: [
    { code: 'WMS-01', title: '收货与上架', desc: '按采购订单收货、检验放行后上架，生成材料批次。' },
    { code: 'WMS-02', title: '领料与发料', desc: '按工单领料，领用备料时带出批次与加权平均单价。' },
    { code: 'WMS-03', title: '库存盘点与调整', desc: '循环盘点与年度盘点，差异需审批后调整。' },
    { code: 'WMS-04', title: '备料库存与库龄', desc: '备料入库、余量、库龄与呆滞判定，回写业务部备料分析。' },
    { code: 'WMS-05', title: '成品入库与出货备货', desc: '成品入库、按出货单拣货与复核。' },
    { code: 'WMS-06', title: '批次与条码管理', desc: '批次条码贯穿收发存，支撑一码到底的追溯。' },
  ],
  documents: ['收货单', '领料单', '盘点单', '出库单'],
  interfaces: [
    { party: '采购部', direction: 'in', subject: '到货通知与收货指令' },
    { party: '业务部', direction: 'out', subject: '备料余量、库龄与呆滞，加权平均领用单价' },
    { party: '生产部', direction: 'out', subject: '工单领料与材料批次' },
    { party: '财务部', direction: 'out', subject: '收发存台账，支撑存货核算' },
  ],
}

const FINANCE: ModuleSpec = {
  key: 'finance',
  path: '/finance',
  title: '财务与成本',
  code: 'FIN',
  owner: '财务部',
  summary:
    '负责工序级成本核算、应收应付与开票收款。业务部报价里的成本分析、历史报价的实际成本回溯，核算口径由本模块统一定义。',
  functions: [
    { code: 'FIN-01', title: '工序级成本核算', desc: '按工序归集材料、加工工时与工艺费用，形成单件实际成本。' },
    { code: 'FIN-02', title: '报价成本偏差分析', desc: '报价预估与实际成本逐工序比对，偏差超阈值触发核价参数修正。' },
    { code: 'FIN-03', title: '应收与账龄管理', desc: '按客户与账龄分档管理应收，逾期回写业务部工作台。' },
    { code: 'FIN-04', title: '开票与收款核销', desc: '受理业务部发票申请，开票后按收款逐笔核销。' },
    { code: 'FIN-05', title: '应付与付款', desc: '采购对账后安排付款，控制账期与资金计划。' },
    { code: 'FIN-06', title: '存货与在制品核算', desc: '材料、在制品与成品的月度结转与差异分析。' },
  ],
  documents: ['成本核算单', '销售发票', '收款核销单', '付款申请单'],
  interfaces: [
    { party: '业务部', direction: 'in', subject: '发票申请、对账单与订单金额' },
    { party: '业务部', direction: 'out', subject: '实际成本、毛利、逾期应收与开票状态' },
    { party: '生产部', direction: 'in', subject: '工序级实际工时与不良' },
    { party: '仓储部', direction: 'in', subject: '收发存台账' },
  ],
}

const ADMIN: ModuleSpec = {
  key: 'admin',
  path: '/admin',
  title: '行政考勤',
  code: 'HRA',
  owner: '行政人事部',
  summary:
    '管人员、考勤与账号权限。员工入职时生成终身不变的唯一编码，离职时释放登录用户名——唯一编码不释放、永不复用。',
  functions: [
    { code: 'HRA-01', title: '员工档案与唯一编码', desc: '入职即发唯一编码，终身不变、永不复用，全系统单据均关联此编码。' },
    { code: 'HRA-02', title: '账号申请与开通', desc: '受理登录账户申请，核实在职状态与部门后开通。' },
    { code: 'HRA-03', title: '离职与用户名释放', desc: '离职停用账号并释放登录用户名，可由他人重新登记；唯一编码不回收。' },
    { code: 'HRA-04', title: '角色与数据权限', desc: '按部门与岗位分配角色，控制香港价、成本核算等敏感权限。' },
    { code: 'HRA-05', title: '考勤与排班', desc: '排班、打卡、加班与请假，支撑生产工时核对。' },
    { code: 'HRA-06', title: '操作留痕与审计', desc: '关键操作全程留痕，按唯一编码可追溯到人。' },
  ],
  documents: ['员工档案', '账户申请单', '考勤记录', '操作审计日志'],
  interfaces: [
    { party: '全部门', direction: 'out', subject: '账号、角色与数据权限' },
    { party: '业务部', direction: 'out', subject: '唯一编码与用户名状态，登录及单据留痕依赖此数据' },
    { party: '生产部', direction: 'in', subject: '实际出勤与加班工时' },
    { party: '财务部', direction: 'out', subject: '考勤结果，支撑人工成本分摊' },
  ],
}

export const MODULE_SPECS: ModuleSpec[] = [
  ENGINEERING,
  PMC,
  PROCUREMENT,
  PRODUCTION,
  POST_PROCESS,
  QUALITY,
  WAREHOUSE,
  FINANCE,
  ADMIN,
]

export function findModuleSpec(key: string): ModuleSpec | undefined {
  return MODULE_SPECS.find((item) => item.key === key)
}
