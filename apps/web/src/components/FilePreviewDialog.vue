<script setup lang="ts">
import { Download, Link } from '@element-plus/icons-vue'
import { computed } from 'vue'

import type { PreviewUrlView } from '@/api/file-preview.api'

/**
 * 通用文件预览对话框：iframe 挂 kkFileView 返回的地址，
 * 另给「新标签打开」与「下载」两条出路。
 *
 * 415（kkFileView 渲染不了这个扩展名）不是错误页，而是换成下载引导——
 * 用户要的是看到文件，格式不支持时下载同样解决问题。
 */
const props = defineProps<{
  modelValue: boolean
  loading: boolean
  preview: PreviewUrlView | null
  unsupported: boolean
  errorMessage: string
  title?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  close: []
  download: []
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const heading = computed(() => props.title ?? props.preview?.fileName ?? '文件预览')

function openInNewTab(): void {
  if (props.preview) {
    window.open(props.preview.previewUrl, '_blank', 'noopener')
  }
}
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="heading"
    width="900px"
    top="6vh"
    destroy-on-close
    @closed="emit('close')"
  >
    <div v-loading="loading" class="preview">
      <el-alert
        v-if="unsupported"
        type="warning"
        :closable="false"
        show-icon
        title="该文件类型不支持在线预览"
        :description="errorMessage || '请下载后用本地软件打开。'"
      />
      <el-alert
        v-else-if="errorMessage"
        type="error"
        :closable="false"
        show-icon
        title="预览地址获取失败"
        :description="errorMessage"
      />

      <iframe
        v-else-if="preview"
        class="preview__frame"
        :src="preview.previewUrl"
        :title="preview.fileName"
        referrerpolicy="no-referrer"
      />

      <el-empty v-else-if="!loading" :image-size="60" description="暂无可预览的文件" />

      <p v-if="preview && !unsupported" class="preview__hint">
        预览链接 {{ preview.expiresInSeconds }} 秒内有效，过期后请重新打开；
        水印「{{ preview.watermarkText }}」标识本次查看人，每次预览均已记入审计。
      </p>
    </div>

    <template #footer>
      <el-button :icon="Download" @click="emit('download')">下载</el-button>
      <el-button
        v-if="preview && !unsupported"
        :icon="Link"
        @click="openInNewTab"
      >
        新标签打开
      </el-button>
      <el-button type="primary" @click="visible = false">关闭</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.preview {
  min-height: 420px;
}

.preview__frame {
  width: 100%;
  height: 62vh;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  background: var(--wfx-surface-alt);
}

.preview__hint {
  margin: 10px 0 0;
  font-size: 12px;
  line-height: 1.7;
  color: var(--wfx-text-muted);
}
</style>
