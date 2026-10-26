<script setup lang="ts">
import { computed, ref } from 'vue'
import Segmented from './Segmented.vue'
import { PRESETS, presetFor, presetRange, type PresetKey } from '../lib/periodo'

const ini = defineModel<string>('ini', { required: true })
const fim = defineModel<string>('fim', { required: true })

// "Outro" mantém as datas atuais e só libera a edição manual.
const custom = ref(false)

const preset = computed<PresetKey>({
  get: () => (custom.value ? 'custom' : presetFor(ini.value, fim.value)),
  set: (k) => {
    const r = presetRange(k)
    custom.value = !r
    if (r) [ini.value, fim.value] = r
  },
})
</script>

<template>
  <div>
    <span class="label">Período</span>
    <Segmented v-model="preset" :options="PRESETS" label="Período" />
    <div class="grid grid-cols-2 gap-3 mt-3">
      <label class="block">
        <span class="label">De</span>
        <input v-model="ini" type="date" class="input" />
      </label>
      <label class="block">
        <span class="label">Até</span>
        <input v-model="fim" type="date" class="input" />
      </label>
    </div>
  </div>
</template>
