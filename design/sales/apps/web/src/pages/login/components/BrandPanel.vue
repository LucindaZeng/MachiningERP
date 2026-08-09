<script setup lang="ts">
const highlights = [
  { title: '报价 · 订单 · 计划 · 采购', desc: '询价核价到合同评审全链路，节点耗时可量化' },
  { title: '一码到底 MES', desc: '扫码报工、工序防跳、跨工序返工与批次追溯' },
  { title: '工序级成本核算', desc: '每道工艺独立成本卡，标准与实际差异到订单毛利' },
  { title: '客户与供应商门户', desc: '在线报价、进度、ASN 与质量文件受控协同' },
]
</script>

<template>
  <aside class="brand-panel">
    <div class="brand-panel__glow" aria-hidden="true"></div>

    <div class="brand-panel__body">
      <h1 class="brand-panel__title">智能制造一体化管理平台</h1>
      <p class="brand-panel__subtitle">ERP · PLM · MRP · APS · MES · QMS · WMS · SRM · BI</p>

      <ul class="brand-panel__list">
        <li v-for="item in highlights" :key="item.title">
          <span class="brand-panel__bullet" aria-hidden="true"></span>
          <div>
            <p class="brand-panel__item-title">{{ item.title }}</p>
            <p class="brand-panel__item-desc">{{ item.desc }}</p>
          </div>
        </li>
      </ul>
    </div>

    <footer class="brand-panel__foot">
      <span>需求基线 V2.1</span>
      <span class="brand-panel__dot">·</span>
      <span>私有化部署</span>
      <span class="brand-panel__dot">·</span>
      <span>十部门权限隔离</span>
    </footer>
  </aside>
</template>

<style scoped>
.brand-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 28px;
  width: 46%;
  min-width: 400px;
  padding: 44px 44px 36px;
  overflow: hidden;
  color: #fff;
  background:
    radial-gradient(120% 90% at 100% 0%, rgba(223, 145, 30, 0.22) 0%, transparent 55%),
    linear-gradient(158deg, #0b357b 0%, #072451 58%, #0b357b 100%);
}

.brand-panel::before {
  position: absolute;
  inset: 0;
  content: '';
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.06) 1px, transparent 1px);
  background-size: 44px 44px;
  opacity: 0.6;
}

.brand-panel__glow {
  position: absolute;
  right: -90px;
  bottom: -120px;
  width: 320px;
  height: 320px;
  border: 26px solid rgba(223, 145, 30, 0.16);
  border-radius: 50%;
}

.brand-panel__body,
.brand-panel__foot {
  position: relative;
  z-index: 1;
}

.brand-panel__title {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  letter-spacing: 1px;
}

.brand-panel__subtitle {
  margin: 10px 0 28px;
  font-size: 13px;
  letter-spacing: 0.6px;
  color: var(--wfx-orange-soft);
}

.brand-panel__list {
  display: flex;
  flex-direction: column;
  gap: 18px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.brand-panel__list li {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.brand-panel__bullet {
  flex: none;
  width: 8px;
  height: 8px;
  margin-top: 7px;
  background: var(--wfx-orange);
  transform: rotate(45deg);
}

.brand-panel__item-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.brand-panel__item-desc {
  margin: 2px 0 0;
  font-size: 12.5px;
  color: rgba(255, 255, 255, 0.66);
}

.brand-panel__foot {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.55);
}

.brand-panel__dot {
  margin: 0 8px;
}

@media (max-width: 960px) {
  .brand-panel {
    display: none;
  }
}
</style>
