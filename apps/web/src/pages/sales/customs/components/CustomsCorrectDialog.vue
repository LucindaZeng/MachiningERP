<script setup lang="ts">
import { computed, ref, watch } from 'vue'

/**
 * 申报后更正。**理由必填**——已申报资料是对海关的正式陈述，
 * 改了什么由服务端比对前后两版快照算出来，为什么改只有人能说。
 *
 * 刻意不做成 `ElMessageBox.prompt`：那个框太轻，配不上「重新申报」这个动作，
 * 也放不下下面那句「改了哪几份由系统自己算」——不说清楚，
 * 业务会以为要自己把改动列表敲进理由里。
 */
const props = defineProps<{ modelValue: boolean; busy: boolean }>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: [reason: string]
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const reason = ref('')

// 每次打开都清空：上一次的理由留在框里，很容易被顺手再提交一遍
watch(visible, (open) => {
  if (open) reason.value = ''
})

const valid = computed(() => reason.value.trim().length > 0)

function confirm(): void {
  if (!valid.value) return
  emit('confirm', reason.value.trim())
}
</script>

<template>
  <el-dialog v-model="visible" title="更正并重新申报" width="560px">
    <el-alert
      class="dialog-alert"
      type="warning"
      :closable="false"
      show-icon
      title="本次更正会产生新的申报版本"
      description="改动了哪几份文件、从第几版到第几版，由系统比对申报快照自动算出，无需手工列举。"
    />

    <el-form label-width="76px" size="small">
      <el-form-item label="更正理由" required>
        <el-input
          v-model="reason"
          type="textarea"
          :rows="4"
          maxlength="500"
          show-word-limit
          placeholder="例如：客户确认后调整净重与件数，随附商业发票与装箱单同步更新"
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :disabled="!valid" :loading="busy" @click="confirm">
        提交更正并重报
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.dialog-alert {
  margin-bottom: 14px;
}
</style>
