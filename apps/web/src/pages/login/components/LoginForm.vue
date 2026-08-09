<script setup lang="ts">
import { Lock, User } from '@element-plus/icons-vue'
import { onMounted } from 'vue'

import { useLoginForm } from '@/composables/use-login-form'

import AudienceTabs from './AudienceTabs.vue'
import CaptchaField from './CaptchaField.vue'

import type { LoginAudience } from '@/types/auth.types'

const emit = defineEmits<{
  'forgot-password': [{ audience: LoginAudience; account: string }]
  'request-account': []
}>()

const {
  form,
  formRef,
  rules,
  submitting,
  captchaRequired,
  captchaChallenge,
  captchaLoading,
  errorMessage,
  refreshCaptcha,
  restoreRememberedAccount,
  switchAudience,
  submit,
} = useLoginForm()

onMounted(restoreRememberedAccount)
</script>

<template>
  <section class="login-form">
    <header class="login-form__head">
      <h2>用户登录</h2>
      <p>请使用公司统一分配的账号登录，操作全程留痕并计入审计日志。</p>
    </header>

    <AudienceTabs :model-value="form.audience" @update:model-value="switchAudience" />

    <el-alert
      v-if="errorMessage"
      class="login-form__alert"
      :title="errorMessage"
      type="error"
      show-icon
      :closable="false"
    />

    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-position="top"
      size="large"
      @keyup.enter="submit"
    >
      <el-form-item prop="account">
        <el-input
          v-model="form.account"
          :prefix-icon="User"
          placeholder="工号 / 登录账号"
          autocomplete="username"
          clearable
        />
      </el-form-item>

      <el-form-item prop="password">
        <el-input
          v-model="form.password"
          type="password"
          :prefix-icon="Lock"
          placeholder="登录密码"
          autocomplete="current-password"
          show-password
        />
      </el-form-item>

      <el-form-item v-if="captchaRequired" prop="captchaCode">
        <CaptchaField
          v-model="form.captchaCode"
          :challenge="captchaChallenge"
          :loading="captchaLoading"
          @refresh="refreshCaptcha"
        />
      </el-form-item>

      <div class="login-form__row">
        <el-checkbox v-model="form.remember">记住账号</el-checkbox>
        <span class="login-form__links">
          <el-link
            v-if="form.audience === 'internal'"
            type="primary"
            :underline="false"
            @click="emit('request-account')"
          >
            申请账户
          </el-link>
          <el-divider v-if="form.audience === 'internal'" direction="vertical" />
          <el-link
            type="primary"
            :underline="false"
            @click="emit('forgot-password', { audience: form.audience, account: form.account })"
          >
            忘记密码？
          </el-link>
        </span>
      </div>

      <el-button
        class="login-form__submit"
        type="primary"
        size="large"
        :loading="submitting"
        @click="submit"
      >
        {{ submitting ? '登录中…' : '登 录' }}
      </el-button>
    </el-form>
  </section>
</template>

<style scoped>
.login-form__links {
  display: flex;
  gap: 2px;
  align-items: center;
}

.login-form {
  width: 100%;
  max-width: 380px;
}

.login-form__head h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: var(--wfx-text-strong);
}

.login-form__head p {
  margin: 8px 0 26px;
  font-size: 13px;
  color: var(--wfx-text-muted);
}

.login-form__alert {
  margin-bottom: 16px;
}

.login-form__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 2px 0 22px;
}

.login-form__submit {
  width: 100%;
  height: 46px;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 4px;
  background: linear-gradient(120deg, #0b357b 0%, #123f8f 100%);
  border: none;
  box-shadow: 0 8px 18px rgba(11, 53, 123, 0.24);
}

.login-form__submit:hover {
  background: linear-gradient(120deg, #123f8f 0%, #1a51b3 100%);
}

:deep(.el-form-item) {
  margin-bottom: 18px;
}
</style>
