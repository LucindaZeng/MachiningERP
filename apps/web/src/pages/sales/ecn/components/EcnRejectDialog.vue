<script setup lang="ts">
import { computed, ref, watch } from 'vue'

/**
 * 驳回工程变更。**中文理由必填**，且会随通知送到发起的业务员手上——
 * 只告诉人「没过」，换来的是同一张单换个说法再提一次。
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

watch(visible, (open) => {
  if (open) reason.value = ''
})

const valid = computed(() => reason.value.trim().length > 0)
</script>

<template>
  <el-dialog v-model="visible" title="驳回工程变更" width="540px">
    <el-form label-width="76px" size="small">
      <el-form-item label="驳回理由" required>
        <el-input
          v-model="reason"
          type="textarea"
          :rows="4"
          maxlength="500"
          show-word-limit
          placeholder="例如：影响面过大，本批次不改，等下一批次统一切换"
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button
        type="danger"
        :disabled="!valid"
        :loading="busy"
        @click="emit('confirm', reason.trim())"
      >
        确认驳回并通知业务员
      </el-button>
    </template>
  </el-dialog>
</template>
