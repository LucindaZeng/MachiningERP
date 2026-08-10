import type { PrismaClient } from '@prisma/client'

/**
 * 公司基础资料，逐行取自 `example/基础资料工艺车间仓库ByCoder.xls`。
 *
 * 业务规格「主数据引用」要求业务部模块直接引用这批基础资料、不另建平行表：
 * 成本分析的可加减工艺列、订单追踪的节点、报价的工艺组合匹配都从这里取值。
 * **本文件由 xls 逐行转录，改工艺请改源表再重新生成，不要在这里手工加行。**
 */
export const PROCESS_DEFINITIONS = [
  { code: '10', name: 'CNC', nature: 'IN_HOUSE', productionUnit: '一部车间', department: '生产一部', sequence: 1 },
  { code: '11', name: '车床', nature: 'IN_HOUSE', productionUnit: '车床车间', department: '车床部', sequence: 2 },
  { code: '12', name: '切料', nature: 'IN_HOUSE', productionUnit: '仓库车间', department: '仓库', sequence: 3 },
  { code: '13', name: '清洗', nature: 'IN_HOUSE', productionUnit: '后工序车间', department: '后工序', sequence: 4 },
  { code: '14', name: '去毛刺', nature: 'IN_HOUSE', productionUnit: '后工序车间', department: '后工序', sequence: 5 },
  { code: '15', name: '振磨', nature: 'IN_HOUSE', productionUnit: '后工序车间', department: '后工序', sequence: 6 },
  { code: '16', name: '包装', nature: 'IN_HOUSE', productionUnit: '后工序车间', department: '后工序', sequence: 7 },
  { code: '17', name: '镭雕', nature: 'IN_HOUSE', productionUnit: '后工序车间', department: '后工序', sequence: 8 },
  { code: '18', name: '钝化', nature: 'IN_HOUSE', productionUnit: '后工序车间', department: '后工序', sequence: 9 },
  { code: '19', name: '丝印', nature: 'IN_HOUSE', productionUnit: '后工序车间', department: '后工序', sequence: 10 },
  { code: '20', name: '组装', nature: 'IN_HOUSE', productionUnit: '后工序车间', department: '后工序', sequence: 11 },
  { code: '21', name: '电镀', nature: 'OUTSOURCED', productionUnit: '委外表处', department: '外协课', sequence: 12 },
  { code: '22', name: '电泳', nature: 'OUTSOURCED', productionUnit: '委外表处', department: '外协课', sequence: 13 },
  { code: '23', name: '喷粉', nature: 'OUTSOURCED', productionUnit: '委外表处', department: '外协课', sequence: 14 },
  { code: '24', name: '喷砂', nature: 'OUTSOURCED', productionUnit: '委外表处', department: '外协课', sequence: 15 },
  { code: '25', name: '阳极氧化', nature: 'OUTSOURCED', productionUnit: '委外表处', department: '外协课', sequence: 16 },
  { code: '26', name: '喷油', nature: 'OUTSOURCED', productionUnit: '委外表处', department: '外协课', sequence: 17 },
  { code: '27', name: '折弯', nature: 'OUTSOURCED', productionUnit: '委外加工', department: '外协课', sequence: 18 },
  { code: '28', name: '激光', nature: 'OUTSOURCED', productionUnit: '委外加工', department: '外协课', sequence: 19 },
  { code: '29', name: '冲压', nature: 'OUTSOURCED', productionUnit: '委外加工', department: '外协课', sequence: 20 },
  { code: '30', name: '线割', nature: 'OUTSOURCED', productionUnit: '委外加工', department: '外协课', sequence: 21 },
  { code: '31', name: '焊接', nature: 'OUTSOURCED', productionUnit: '委外加工', department: '外协课', sequence: 22 },
  { code: '32', name: '锻造', nature: 'OUTSOURCED', productionUnit: '委外加工', department: '外协课', sequence: 23 },
  { code: '33', name: '磨床', nature: 'OUTSOURCED', productionUnit: '委外加工', department: '外协课', sequence: 24 },
  { code: '34', name: '仓库', nature: 'IN_HOUSE', productionUnit: '仓库车间', department: '仓库', sequence: 25 },
  { code: '35', name: '去应力', nature: 'IN_HOUSE', productionUnit: '后工序车间', department: '后工序', sequence: 26 },
  { code: '36', name: '拉丝', nature: 'IN_HOUSE', productionUnit: '后工序车间', department: '后工序', sequence: 27 },
  { code: '37', name: '滚花', nature: 'OUTSOURCED', productionUnit: '委外加工', department: '外协课', sequence: 28 },
  { code: '38', name: '淬火', nature: 'OUTSOURCED', productionUnit: '委外表处', department: '外协课', sequence: 29 },
  { code: '39', name: '装牙套', nature: 'IN_HOUSE', productionUnit: '后工序车间', department: '后工序', sequence: 30 },
  { code: '40', name: '校形', nature: 'IN_HOUSE', productionUnit: '后工序车间', department: '后工序', sequence: 31 },
  { code: '41', name: '搓牙', nature: 'OUTSOURCED', productionUnit: '委外加工', department: '外协课', sequence: 32 },
  { code: '42', name: '喷砂、阳极氧', nature: 'OUTSOURCED', productionUnit: '委外表处', department: '外协课', sequence: 33 },
  { code: '43', name: '喷砂、电泳', nature: 'OUTSOURCED', productionUnit: '委外表处', department: '外协课', sequence: 34 },
  { code: '44', name: '碱洗喷砂阳极', nature: 'OUTSOURCED', productionUnit: '委外表处', department: '外协课', sequence: 35 },
  { code: '45', name: '镀皮膜、烘干', nature: 'OUTSOURCED', productionUnit: '委外表处', department: '外协课', sequence: 36 },
  { code: '46', name: '镀皮膜、喷粉', nature: 'OUTSOURCED', productionUnit: '委外表处', department: '外协课', sequence: 37 },
  { code: '47', name: 'PVD', nature: 'OUTSOURCED', productionUnit: '委外表处', department: '外协课', sequence: 38 },
  { code: '48', name: '压铆', nature: 'IN_HOUSE', productionUnit: '后工序车间', department: '后工序', sequence: 39 },
  { code: '49', name: '落料', nature: 'IN_HOUSE', productionUnit: '后工序车间', department: '后工序', sequence: 40 },
  { code: '50', name: '背胶', nature: 'OUTSOURCED', productionUnit: '委外加工', department: '外协课', sequence: 41 },
  { code: '51', name: '清洗钝化', nature: 'IN_HOUSE', productionUnit: '后工序车间', department: '后工序', sequence: 42 },
  { code: '52', name: '抛光', nature: 'IN_HOUSE', productionUnit: '后工序车间', department: '后工序', sequence: 43 },
  { code: '53', name: '喷砂PVD', nature: 'OUTSOURCED', productionUnit: '委外表处', department: '外协课', sequence: 44 },
  { code: '54', name: '做防护', nature: 'IN_HOUSE', productionUnit: '后工序车间', department: '后工序', sequence: 45 },
  { code: '55', name: '渗氮', nature: 'OUTSOURCED', productionUnit: '委外加工', department: '外协课', sequence: 46 },
  { code: '56', name: '浸渗', nature: 'OUTSOURCED', productionUnit: '委外加工', department: '外协课', sequence: 47 },
  { code: '57', name: '水密测试', nature: 'IN_HOUSE', productionUnit: '后工序车间', department: '后工序', sequence: 48 },
  { code: '58', name: '真空热处理', nature: 'OUTSOURCED', productionUnit: '委外表处', department: '外协课', sequence: 49 },
  { code: '59', name: '填油', nature: 'OUTSOURCED', productionUnit: '委外加工', department: '外协课', sequence: 50 },
  { code: '60', name: '抛丸喷粉', nature: 'OUTSOURCED', productionUnit: '委外表处', department: '外协课', sequence: 51 },
  { code: '61', name: '疏水氧化', nature: 'OUTSOURCED', productionUnit: '委外表处', department: '外协课', sequence: 52 },
  { code: '62', name: '打磨（外发）', nature: 'OUTSOURCED', productionUnit: '委外表处', department: '外协课', sequence: 53 },
  { code: '63', name: '研磨', nature: 'IN_HOUSE', productionUnit: '后工序车间', department: '后工序', sequence: 54 },
  { code: '64', name: '达克罗', nature: 'OUTSOURCED', productionUnit: '委外表处', department: '外协课', sequence: 55 },
  { code: '65', name: '高光', nature: 'OUTSOURCED', productionUnit: '委外加工', department: '外协课', sequence: 56 },
  { code: '66', name: '点胶', nature: 'IN_HOUSE', productionUnit: '后工序车间', department: '后工序', sequence: 57 },
  { code: '67', name: '调质', nature: 'OUTSOURCED', productionUnit: '委外加工', department: '外协课', sequence: 58 },
  { code: '68', name: '退表面处理', nature: 'OUTSOURCED', productionUnit: '委外表处', department: '外协课', sequence: 59 },
  { code: '69', name: '二氧', nature: 'OUTSOURCED', productionUnit: '委外表处', department: '外协课', sequence: 60 },
  { code: '70', name: '铁氟龙', nature: 'OUTSOURCED', productionUnit: '委外表处', department: '外协课', sequence: 61 },
  { code: '71', name: '钝化封闭', nature: 'IN_HOUSE', productionUnit: '后工序车间', department: '后工序', sequence: 62 },
  { code: '72', name: '真空镀膜', nature: 'OUTSOURCED', productionUnit: '委外表处', department: '外协课', sequence: 63 },
] as const

/** 仓库表。备料完工入成品仓 100，样品入样品仓 400。 */
export const WAREHOUSE_DEFINITIONS = [
  { code: '100', name: '成品仓', category: '10 工艺仓库', lrpIncluded: true, stockType: '存货', remark: '用于存放出货产口' },
  { code: '101', name: '配件仓', category: '10 工艺仓库', lrpIncluded: true, stockType: '存货', remark: '用于存放待组装产品' },
  { code: '102', name: '不良仓', category: '10 工艺仓库', lrpIncluded: false, stockType: '存货', remark: '用于存放不良品,待返工,待退货,待判定' },
  { code: '103', name: '销毁仓', category: '10 工艺仓库', lrpIncluded: false, stockType: '非存货仓', remark: '用于存放需要统一销毁产品' },
  { code: '104', name: '报废仓', category: '10 工艺仓库', lrpIncluded: false, stockType: '存货', remark: '用于存放已判定不良待销毁和废料' },
  { code: '105', name: '工序仓', category: '10 工艺仓库', lrpIncluded: false, stockType: '存货', remark: '用于存放未走完工艺路线的工序半成品' },
  { code: '106', name: '呆滞仓', category: '10 工艺仓库', lrpIncluded: true, stockType: '存货', remark: '用于存放长久没有用到的物料' },
  { code: '200', name: '原料仓', category: '20 采购仓库', lrpIncluded: true, stockType: '存货', remark: '用于存放采购原料如铜铝钢等' },
  { code: '201', name: '五金仓', category: '20 采购仓库', lrpIncluded: true, stockType: '存货', remark: '用于存货采购配件，如五金配件、紧固件、冲压半成品、激光割半成品和塑胶件等' },
  { code: '202', name: '包材仓', category: '20 采购仓库', lrpIncluded: true, stockType: '存货', remark: '用于存放产品上使用的各类包材不含标签' },
  { code: '203', name: '消耗仓', category: '20 采购仓库', lrpIncluded: false, stockType: '存货', remark: '用于存货非生产物料等其它物品,不含化学品' },
  { code: '204', name: '化学仓', category: '20 采购仓库', lrpIncluded: false, stockType: '', remark: '用于存货液体类,气体类等化学品物料' },
  { code: '300', name: '新刀具仓', category: '30.借出仓库', lrpIncluded: false, stockType: '存货', remark: '用于存放全新的刀具、刀柄等相关工具' },
  { code: '307', name: '旧刀具仓', category: '30.借出仓库', lrpIncluded: false, stockType: '存货', remark: '用于存放使用过的刀具、刀柄等相关工具' },
  { code: '302', name: '一部领用仓', category: '30.借出仓库', lrpIncluded: false, stockType: '存货', remark: '用于登记一部车间领用的刀具、刀柄、夹治具等需要归还的工具' },
  { code: '303', name: '二部领用仓', category: '30.借出仓库', lrpIncluded: false, stockType: '存货', remark: '用于登记二部车间领用的刀具、刀柄、夹治具等需要归还的工具' },
  { code: '304', name: '自动化组领用仓', category: '30.借出仓库', lrpIncluded: false, stockType: '存货', remark: '用于登记自动化组车间领用的刀具、刀柄、夹治具等需要归还的工具' },
  { code: '305', name: '车床领用仓', category: '30.借出仓库', lrpIncluded: false, stockType: '存货', remark: '用于登记车床车间领用的刀具、刀柄、夹治具等需要归还的工具' },
  { code: '306', name: '后工序领用仓', category: '30.借出仓库', lrpIncluded: false, stockType: '存货', remark: '用于登记后工序车间领用的刀具、电钻等需要归还的工具' },
  { code: '301', name: '用具仓', category: '30.借出仓库', lrpIncluded: false, stockType: '存货', remark: '用于存货模具,检具,夹具,治具' },
  { code: '400', name: '样品仓', category: '40.样品仓库', lrpIncluded: false, stockType: '存货', remark: '用于存放出货样品' },
] as const

/** 车间表，追踪节点的责任车间由此对应。 */
export const WORKSHOP_DEFINITIONS = [
  { code: '10', name: '生产一部', unitName: '一部车间', remark: 'CNC' },
  { code: '11', name: '生产二部', unitName: '二部车间', remark: 'CNC' },
  { code: '12', name: '车床', unitName: '车床车间', remark: '车' },
  { code: '13', name: '自动化组', unitName: '一部车间', remark: 'CNC' },
  { code: '14', name: '后工序', unitName: '后序车间', remark: '清洗和钝化' },
  { code: '15', name: '仓库', unitName: '仓库车间', remark: '用于工艺外发和工艺收货（不是最后工序）' },
] as const

export async function seedBaseData(prisma: PrismaClient): Promise<void> {
  for (const item of PROCESS_DEFINITIONS) {
    await prisma.processDefinition.upsert({
      where: { code: item.code },
      create: { ...item },
      update: { name: item.name, nature: item.nature, productionUnit: item.productionUnit, department: item.department, sequence: item.sequence },
    })
  }

  for (const item of WAREHOUSE_DEFINITIONS) {
    await prisma.warehouseDefinition.upsert({
      where: { code: item.code },
      create: { ...item },
      update: { name: item.name, category: item.category, lrpIncluded: item.lrpIncluded },
    })
  }

  for (const item of WORKSHOP_DEFINITIONS) {
    await prisma.workshopDefinition.upsert({
      where: { code: item.code },
      create: { ...item },
      update: { name: item.name, unitName: item.unitName },
    })
  }
}
