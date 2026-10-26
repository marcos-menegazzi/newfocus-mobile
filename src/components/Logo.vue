<script setup lang="ts">
import mark from '../assets/logo-mark.png'
import full from '../assets/logo.png'

withDefaults(defineProps<{ variant?: 'mark' | 'full'; height?: number }>(), { variant: 'mark', height: 40 })
</script>

<template>
  <img
    :src="variant === 'full' ? full : mark"
    alt="NewFocus Sistemas"
    :style="{ height: `${height}px` }"
    class="w-auto shrink-0 select-none"
    draggable="false"
  />
</template>
