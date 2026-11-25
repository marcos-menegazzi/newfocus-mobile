<script setup lang="ts">
import { computed, ref } from 'vue'
import Segmented from './Segmented.vue'
import { abrirSeletor } from '../lib/picker'
import { PRESETS, presetFor, presetRange, type PresetKey } from '../lib/periodo'

const props = withDefaults(defineProps<{ presets?: { value: PresetKey; label: string }[] }>(), { presets: () => PRESETS })
const ini = defineModel<string>('ini', { required: true })
const fim = defineModel<string>('fim', { required: true })

// "Outro" mantém as datas atuais e só libera a edição manual.
const custom = ref(false)

const preset = computed<PresetKey>({
  get: () => (custom.value ? 'custom' : presetFor(ini.value, fim.value, props.presets)),
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
    <Segmented v-model="preset" :options="presets" label="Período" />
    <div class="grid grid-cols-2 gap-3 mt-3">
      <label class="block min-w-0">
        <span class="label">De</span>
        <input v-model="ini" type="date" class="input input-datetime" @click="abrirSeletor" />
      </label>
      <label class="block min-w-0">
        <span class="label">Até</span>
        <input v-model="fim" type="date" class="input input-datetime" :min="ini || undefined" @click="abrirSeletor" />
      </label>
    </div>
  </div>
</template>
