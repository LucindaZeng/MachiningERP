<script setup lang="ts">
import { computed } from 'vue'

import { tagOf, type TagMeta } from './status-dictionary'

const props = defineProps<{
  dict: Record<string, TagMeta>
  value: string
  size?: 'small' | 'default' | 'large'
}>()

const meta = computed(() => tagOf(props.dict, props.value))
</script>

<template>
  <el-tag :type="meta.type" :size="size ?? 'small'" effect="light" disable-transitions>
    {{ meta.label }}
  </el-tag>
</template>
