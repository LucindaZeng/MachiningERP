<script setup lang="ts">
import { ref } from 'vue'

import AccountRequestDialog from './components/AccountRequestDialog.vue'
import BrandPanel from './components/BrandPanel.vue'
import ForgotPasswordDialog from './components/ForgotPasswordDialog.vue'
import LoginForm from './components/LoginForm.vue'
import logoFull from '@/assets/brand/wanfuxin-logo-full.png'
import type { LoginAudience } from '@/types/auth.types'

const forgotVisible = ref(false)
const accountVisible = ref(false)
const forgotAudience = ref<LoginAudience>('internal')
const forgotAccount = ref('')

function openForgotPassword(payload: { audience: LoginAudience; account: string }): void {
  forgotAudience.value = payload.audience
  forgotAccount.value = payload.account
  forgotVisible.value = true
}
</script>

<template>
  <main class="login-page">
    <div class="login-page__card">
      <header class="login-page__header">
        <img :src="logoFull" alt="东莞市万富鑫智能装备有限公司" class="login-page__logo" />
      </header>

      <div class="login-page__main">
        <BrandPanel />

        <div class="login-page__form">
          <LoginForm
            @forgot-password="openForgotPassword"
            @request-account="accountVisible = true"
          />
        </div>
      </div>
    </div>

    <footer class="login-page__copyright">
      © 2026 东莞市万富鑫智能装备有限公司 · MachiningERP · 建议使用 Chrome / Edge 最新版本
    </footer>

    <ForgotPasswordDialog
      v-model="forgotVisible"
      :audience="forgotAudience"
      :account="forgotAccount"
    />

    <AccountRequestDialog v-model="accountVisible" />
  </main>
</template>

<style scoped>
.login-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 22px;
  min-height: 100vh;
  padding: 40px 20px;
  background:
    radial-gradient(90% 60% at 12% 8%, rgba(18, 63, 143, 0.55) 0%, transparent 60%),
    radial-gradient(70% 60% at 92% 92%, rgba(223, 145, 30, 0.2) 0%, transparent 60%),
    linear-gradient(150deg, #061c42 0%, #0b357b 55%, #061c42 100%);
}

.login-page__card {
  display: flex;
  flex-direction: column;
  width: min(1080px, 100%);
  overflow: hidden;
  background: var(--wfx-surface);
  border-radius: var(--wfx-radius-lg);
  box-shadow: var(--wfx-shadow-card);
}

.login-page__header {
  display: flex;
  align-items: center;
  padding: 26px 48px;
  background: #fff;
  border-bottom: 1px solid var(--wfx-border);
}

.login-page__logo {
  width: 560px;
  max-width: 100%;
  height: auto;
}

.login-page__main {
  display: flex;
  min-height: 520px;
}

.login-page__form {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  padding: 44px 56px;
}

.login-page__copyright {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  text-align: center;
}

@media (max-width: 960px) {
  .login-page__header {
    justify-content: center;
    padding: 22px 24px;
  }

  .login-page__logo {
    width: 420px;
  }

  .login-page__main {
    flex-direction: column;
    min-height: 0;
  }

  .login-page__form {
    padding: 30px 24px 38px;
  }
}
</style>
