<script setup lang="ts">
import { CircleCheckFilled } from '@element-plus/icons-vue'
import { watch } from 'vue'

import { usePasswordResetRequest } from '@/composables/use-password-reset-request'

import type { LoginAudience } from '@/types/auth.types'

const props = defineProps<{
  modelValue: boolean
  audience: LoginAudience
  account: string
}>()

const emit = defineEmits<{ 'update:modelValue': [boolean] }>()

const { form, formRef, rules, submitting, errorMessage, result, reset, submit } =
  usePasswordResetRequest()

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

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      reset(props.audience, props.account)
    }
  },
)

function close(): void {
  emit('update:modelValue', false)
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('zh-CN', { hour12: false })
}
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="result ? '申请已提交' : '忘记密码 · 申请重置'"
    width="520px"
    align-center
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-if="result" class="reset-result">
      <el-icon class="reset-result__icon"><CircleCheckFilled /></el-icon>
      <p class="reset-result__no">申请单号：{{ result.requestNo }}</p>
      <p class="reset-result__time">提交时间：{{ formatTime(result.submittedAt) }}</p>
      <el-alert type="success" :closable="false" show-icon :title="result.handlerHint" />
      <p class="reset-result__tip">
        管理员重置后会以初始密码通知本人，首次登录须立即修改密码；超过 4 小时未收到请致电信息部内线
        8060。
      </p>
    </div>

    <template v-else>
      <el-alert
        class="reset-form__intro"
        type="info"
        :closable="false"
        show-icon
        title="本系统密码由 IT 系统管理员统一重置"
        description="请填写以下信息提交申请，管理员核实身份后重置密码并通知本人，全过程写入审计日志。"
      />

      <el-alert
        v-if="errorMessage"
        class="reset-form__error"
        type="error"
        :closable="false"
        show-icon
        :title="errorMessage"
      />

      <el-form ref="formRef" :model="form" :rules="rules" label-width="96px">
        <el-form-item label="登录账号" prop="account">
          <el-input v-model="form.account" placeholder="需要重置的工号 / 登录账号" clearable />
        </el-form-item>

        <el-form-item label="本人姓名" prop="applicantName">
          <el-input v-model="form.applicantName" placeholder="与人事花名册一致" clearable />
        </el-form-item>

        <el-form-item :label="audience === 'portal' ? '所属单位' : '所属部门'" prop="department">
          <el-input
            v-if="audience === 'portal'"
            v-model="form.department"
            placeholder="公司全称"
            clearable
          />
          <el-select v-else v-model="form.department" placeholder="请选择部门" style="width: 100%">
            <el-option v-for="item in DEPARTMENTS" :key="item" :label="item" :value="item" />
          </el-select>
        </el-form-item>

        <el-form-item label="联系方式" prop="contact">
          <el-input v-model="form.contact" placeholder="手机号或企业邮箱，用于接收重置结果" clearable />
        </el-form-item>

        <el-form-item label="申请说明">
          <el-input
            v-model="form.reason"
            type="textarea"
            :rows="3"
            maxlength="200"
            show-word-limit
            placeholder="选填：如密码遗忘、账号锁定、离职交接等"
          />
        </el-form-item>
      </el-form>
    </template>

    <template #footer>
      <el-button v-if="result" type="primary" @click="close">我知道了</el-button>
      <template v-else>
        <el-button @click="close">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submit">提交申请</el-button>
      </template>
    </template>
  </el-dialog>
</template>

<style scoped>
.reset-form__intro,
.reset-form__error {
  margin-bottom: 18px;
}

.reset-result {
  text-align: center;
}

.reset-result__icon {
  font-size: 46px;
  color: var(--el-color-success);
}

.reset-result__no {
  margin: 12px 0 2px;
  font-size: 18px;
  font-weight: 700;
  color: var(--wfx-text-strong);
}

.reset-result__time {
  margin: 0 0 16px;
  font-size: 12px;
  color: var(--wfx-text-muted);
}

.reset-result__tip {
  margin: 14px 0 0;
  font-size: 12.5px;
  line-height: 1.8;
  text-align: left;
  color: var(--wfx-text-muted);
}
</style>
