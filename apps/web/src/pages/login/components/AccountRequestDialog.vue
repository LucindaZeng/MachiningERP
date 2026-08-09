<script setup lang="ts">
import { CircleCheckFilled, CircleCloseFilled, Loading } from '@element-plus/icons-vue'
import { computed, watch } from 'vue'

import { useAccountRequest } from '@/composables/use-account-request'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [boolean] }>()

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const {
  form,
  formRef,
  rules,
  submitting,
  checking,
  errorMessage,
  availability,
  accountReady,
  passwordScore,
  canSubmit,
  result,
  checkAccount,
  useSuggestion,
  submit,
  reset,
} = useAccountRequest()

const DEPARTMENTS = [
  '总经办',
  '业务部',
  '工程部',
  'PMC 部',
  '采购部',
  '生产部',
  '后工序部',
  '品质部',
  '仓储部',
  '财务部',
  '行政人事部',
  '信息部',
]

const STRENGTH = ['很弱', '弱', '一般', '较强', '强']

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      reset()
    }
  },
)
</script>

<template>
  <el-dialog v-model="visible" title="申请账户" width="620px" :close-on-click-modal="false">
    <template v-if="result">
      <div class="done">
        <el-icon class="done__icon"><CircleCheckFilled /></el-icon>
        <p class="done__title">申请已提交，等待信息部开通</p>
        <el-descriptions :column="1" border size="small" class="done__info">
          <el-descriptions-item label="申请单号">{{ result.requestNo }}</el-descriptions-item>
          <el-descriptions-item label="登录用户名">
            <b class="done__account">{{ result.account }}</b>
            <span class="muted">（仅用于登录；离职后释放，可由他人再次登记）</span>
          </el-descriptions-item>
          <el-descriptions-item label="唯一编码">
            <b class="done__code">{{ result.userCode }}</b>
            <span class="muted">（本次注册单独生成，终身不变、永不复用；单据与留痕关联此编码）</span>
          </el-descriptions-item>
          <el-descriptions-item v-if="result.reusedFrom" label="用户名来源">
            <el-tag size="small" type="warning" effect="plain">曾由离职员工使用，已释放</el-tag>
            <span class="muted">　原使用人：{{ result.reusedFrom }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="受理说明">{{ result.handlerHint }}</el-descriptions-item>
        </el-descriptions>
      </div>
    </template>

    <template v-else>
      <el-alert
        class="tip"
        type="info"
        :closable="false"
        show-icon
        title="用户名只用于登录；唯一编码由系统在注册时单独生成"
        description="用户名不是唯一编码，只做登录用途，在职期间不可重复；员工离职后用户名会被释放，可由他人再次登记。唯一编码在每次注册时单独生成，终身不变、永不复用——所有单据、审批与留痕关联的都是唯一编码，因此用户名换人不会影响任何历史数据。请如实填写员工姓名与所属部门，信息部核实后开通，角色与数据范围由部门负责人确认。"
      />

      <el-form ref="formRef" :model="form" :rules="rules" label-width="96px" class="form">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="员工姓名" prop="employeeName">
              <el-input v-model="form.employeeName" placeholder="与身份证 / 工牌一致" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="所属部门" prop="department">
              <el-select v-model="form.department" placeholder="选择部门" style="width: 100%">
                <el-option v-for="item in DEPARTMENTS" :key="item" :label="item" :value="item" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="登录用户名" prop="account">
          <div class="account">
            <el-input
              v-model="form.account"
              placeholder="4–20 位，字母开头，可含小写字母 / 数字 / 点 / 下划线"
              @blur="checkAccount"
            >
              <template #suffix>
                <el-icon v-if="checking" class="is-loading"><Loading /></el-icon>
                <el-icon v-else-if="accountReady" class="ok"><CircleCheckFilled /></el-icon>
                <el-icon v-else-if="availability" class="bad"><CircleCloseFilled /></el-icon>
              </template>
            </el-input>
            <el-button :loading="checking" @click="checkAccount">检查可用性</el-button>
          </div>

          <p v-if="accountReady && availability?.released" class="hint warn">
            {{ availability?.reason }}
          </p>
          <p v-else-if="accountReady" class="hint ok">
            用户名「{{ availability?.account }}」可用，提交后将被锁定；唯一编码在提交时由系统另行生成
          </p>
          <p v-else-if="availability" class="hint bad">
            {{ availability.reason }}
            <template v-if="availability.suggestions.length">
              　可用建议：
              <el-link
                v-for="item in availability.suggestions"
                :key="item"
                type="primary"
                :underline="false"
                class="hint__suggest"
                @click="useSuggestion(item)"
              >
                {{ item }}
              </el-link>
            </template>
          </p>
          <p v-else class="hint">
            用户名只用于登录，在职期间不可重复；离职后释放，可由他人再次登记。唯一编码由系统在注册时单独生成，不是用户名
          </p>
        </el-form-item>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="密码" prop="password">
              <el-input v-model="form.password" type="password" show-password placeholder="至少 8 位" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="确认密码" prop="confirmPassword">
              <el-input
                v-model="form.confirmPassword"
                type="password"
                show-password
                placeholder="再次输入密码"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="密码强度">
          <div class="strength">
            <span
              v-for="index in 4"
              :key="index"
              class="strength__bar"
              :class="{ 'is-on': passwordScore >= index }"
            />
            <em>{{ STRENGTH[passwordScore] }}</em>
            <span class="muted">建议同时包含大小写字母、数字与符号</span>
          </div>
        </el-form-item>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="联系方式">
              <el-input v-model="form.contact" placeholder="手机号 / 企业微信，便于 IT 核实" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="申请说明">
              <el-input v-model="form.reason" placeholder="如：新入职、转岗、原账号停用" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>

      <el-alert v-if="errorMessage" type="error" :closable="false" show-icon :title="errorMessage" />
    </template>

    <template #footer>
      <template v-if="result">
        <el-button type="primary" @click="visible = false">知道了</el-button>
      </template>
      <template v-else>
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" :disabled="!canSubmit" @click="submit">
          提交申请
        </el-button>
      </template>
    </template>
  </el-dialog>
</template>

<style scoped>
.tip {
  margin-bottom: 16px;
}

.account {
  display: flex;
  gap: 10px;
  width: 100%;
}

.hint {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--wfx-text-muted);
}

.hint.ok,
.ok {
  color: var(--el-color-success);
}

.hint.bad,
.bad {
  color: var(--el-color-danger);
}

.hint.warn {
  color: var(--el-color-warning);
}

.hint__suggest {
  margin-right: 10px;
}

.strength {
  display: flex;
  gap: 6px;
  align-items: center;
}

.strength__bar {
  width: 46px;
  height: 6px;
  background: var(--el-border-color);
  border-radius: 3px;
}

.strength__bar.is-on {
  background: var(--el-color-success);
}

.strength em {
  margin-left: 6px;
  font-size: 12.5px;
  font-style: normal;
  color: var(--wfx-text);
}

.muted {
  font-size: 12px;
  color: var(--wfx-text-muted);
}

.done {
  padding: 8px 4px;
  text-align: center;
}

.done__icon {
  font-size: 44px;
  color: var(--el-color-success);
}

.done__title {
  margin: 10px 0 16px;
  font-size: 15px;
  font-weight: 600;
  color: var(--wfx-text-strong);
}

.done__info {
  text-align: left;
}

.done__account {
  color: var(--wfx-navy);
}

.done__code {
  color: var(--el-color-success);
  letter-spacing: 0.5px;
}
</style>
