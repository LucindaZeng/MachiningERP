<script setup lang="ts">
import { Picture, Refresh } from '@element-plus/icons-vue'

import type { CaptchaChallenge } from '@/types/auth.types'

defineProps<{
  modelValue: string
  challenge: CaptchaChallenge | null
  loading: boolean
}>()

const emit = defineEmits<{ 'update:modelValue': [string]; refresh: [] }>()
</script>

<template>
  <div class="captcha-field">
    <el-input
      :model-value="modelValue"
      maxlength="4"
      size="large"
      placeholder="图形验证码"
      :prefix-icon="Picture"
      @update:model-value="emit('update:modelValue', $event)"
      @keyup.enter="$emit('refresh')"
    />

    <button
      type="button"
      class="captcha-field__image"
      :title="'点击刷新验证码'"
      :disabled="loading"
      @click="emit('refresh')"
    >
      <img v-if="challenge" :src="challenge.imageUrl" alt="图形验证码" />
      <el-icon v-else class="captcha-field__placeholder"><Refresh /></el-icon>
    </button>
  </div>
</template>

<style scoped>
.captcha-field {
  display: grid;
  grid-template-columns: 1fr 128px;
  gap: 10px;
  align-items: center;
}

.captcha-field__image {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  padding: 0;
  overflow: hidden;
  cursor: pointer;
  background: var(--wfx-surface-alt);
  border: 1px solid var(--wfx-border);
  border-radius: 8px;
}

.captcha-field__image:hover {
  border-color: var(--el-color-primary-light-5);
}

.captcha-field__image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.captcha-field__placeholder {
  color: var(--wfx-text-muted);
}
</style>
