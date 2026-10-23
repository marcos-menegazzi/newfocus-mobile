<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import AppShell from '../components/AppShell.vue'
import ScreenHeader from '../components/ScreenHeader.vue'
import {
  lancarDiario,
  listarFuncionarios,
  listarOs,
  uploadImage,
  type Apontamento,
  type Opt,
} from '../services/os'

interface ApontamentoItem extends Apontamento {
  id: number
}

const ordens = ref<Opt[]>([])
const disponiveis = ref<Opt[]>([])
const selecionados = ref<Opt[]>([])
const func = ref<Opt | null>(null)

const os = ref('')
const data = ref('')
const hora = ref('')
const apontamentos = ref<ApontamentoItem[]>([])
const obs = ref('')
const fotos = ref<string[]>([])

const loading = ref(false)
const msg = ref('')

onMounted(async () => {
  ordens.value = await listarOs()
})

async function onOsChange() {
  selecionados.value = []
  disponiveis.value = []
  func.value = null
  if (!os.value) return
  disponiveis.value = await listarFuncionarios(os.value)
  func.value = disponiveis.value[0] ?? null
}

function addFunc() {
  if (!func.value) return
  selecionados.value.push(func.value)
  disponiveis.value = disponiveis.value.filter((f) => f.codigo !== func.value!.codigo)
  func.value = null
}

function addAll() {
  selecionados.value.push(...disponiveis.value)
  disponiveis.value = []
  func.value = null
}

function removeFunc(f: Opt) {
  selecionados.value = selecionados.value.filter((x) => x.codigo !== f.codigo)
  disponiveis.value.push(f)
}

function addApontamento() {
  if (!data.value || !hora.value) return (msg.value = 'Informe Data e Hora.')
  if (apontamentos.value.some((a) => a.data === data.value && a.hora === hora.value)) {
    return (msg.value = 'Apontamento com mesma Data/Hora já realizado.')
  }
  apontamentos.value.push({ id: apontamentos.value.length + 1, data: data.value, hora: hora.value })
  msg.value = ''
}

function removeApontamento(a: ApontamentoItem) {
  apontamentos.value = apontamentos.value.filter((x) => x.id !== a.id)
}

function formatData(d: string): string {
  if (!d || d.length < 10) return ''
  return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`
}

async function capturar() {
  const photo = await Camera.getPhoto({ resultType: CameraResultType.Base64, source: CameraSource.Camera })
  if (photo.base64String) fotos.value.push(photo.base64String)
}

async function escolher() {
  const photo = await Camera.getPhoto({ resultType: CameraResultType.Base64, source: CameraSource.Photos })
  if (photo.base64String) fotos.value.push(photo.base64String)
}

function removerFoto(i: number) {
  fotos.value.splice(i, 1)
}

async function apontar() {
  msg.value = ''
  if (!os.value || Number(os.value) < 1) return (msg.value = 'OS deve ser selecionada')
  if (apontamentos.value.length < 1) return (msg.value = 'Deve ser efetuado apontamentos de Data/Hora')
  if (selecionados.value.length < 1) return (msg.value = 'Deve ser informado ao menos um funcionário')

  loading.value = true
  try {
    let enviadas: string[] = []
    if (fotos.value.length > 0) {
      enviadas = await Promise.all(fotos.value.map((f) => uploadImage(f)))
      if (enviadas.some((x) => !x)) throw new Error('Não foi possível efetuar o upload da imagem')
    }
    const r = await lancarDiario({
      os: os.value,
      obs: obs.value,
      funcionarios: selecionados.value.map((f) => f.codigo),
      apontamentos: apontamentos.value.map(({ data: d, hora: h }) => ({ data: d, hora: h })),
      fotos: enviadas,
    })
    msg.value = r.msg
    if (r.ok) reset()
  } catch (e) {
    msg.value = e instanceof Error ? e.message : 'Erro ao lançar diário'
  } finally {
    loading.value = false
  }
}

function reset() {
  os.value = ''
  data.value = ''
  hora.value = ''
  apontamentos.value = []
  obs.value = ''
  fotos.value = []
  selecionados.value = []
  disponiveis.value = []
  func.value = null
}
</script>

<template>
  <AppShell>
    <div class="p-6">
      <ScreenHeader title="Diário de Obra" />

      <section class="bg-white rounded-card shadow-card p-5 mb-4">
        <label class="block mb-3">
          <span class="text-ink-600 text-xs font-medium">Ordem de Serviço</span>
          <select v-model="os" class="input" @change="onOsChange">
            <option value="">Selecione uma OS</option>
            <option v-for="o in ordens" :key="o.codigo" :value="o.codigo">{{ o.descricao }}</option>
          </select>
        </label>

        <div class="grid grid-cols-2 gap-3 mb-3">
          <label class="block">
            <span class="text-ink-600 text-xs font-medium">Data</span>
            <input v-model="data" type="date" class="input" />
          </label>
          <label class="block">
            <span class="text-ink-600 text-xs font-medium">Hora</span>
            <div class="flex gap-2 mt-1">
              <input v-model="hora" type="time" class="input flex-1" />
              <button type="button" class="btn-primary shrink-0 px-4" @click="addApontamento">+</button>
            </div>
          </label>
        </div>

        <div v-if="apontamentos.length" class="overflow-x-auto mb-3">
          <table class="w-full text-left text-sm">
            <thead class="text-ink-400 text-xs uppercase">
              <tr>
                <th class="py-2 px-3">Data</th>
                <th class="py-2 px-3">Hora</th>
                <th class="py-2 px-3" />
              </tr>
            </thead>
            <tbody class="divide-y divide-ink-200">
              <tr v-for="a in apontamentos" :key="a.id">
                <td class="py-2 px-3">{{ formatData(a.data) }}</td>
                <td class="py-2 px-3">{{ a.hora }}</td>
                <td class="py-2 px-3 text-right">
                  <button type="button" class="text-red-500 text-sm font-semibold" @click="removeApontamento(a)">Remover</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <label class="block mb-3">
          <span class="text-ink-600 text-xs font-medium">Funcionários envolvidos</span>
          <div class="flex gap-2 mt-1">
            <select v-model="func" class="input flex-1">
              <option :value="null">Selecione...</option>
              <option v-for="f in disponiveis" :key="f.codigo" :value="f">{{ f.descricao }}</option>
            </select>
            <button type="button" class="btn-primary shrink-0 px-4" @click="addFunc">+</button>
            <button type="button" class="btn-primary shrink-0 px-4" @click="addAll">Todos</button>
          </div>
        </label>

        <ul v-if="selecionados.length" class="divide-y divide-ink-200 mb-3">
          <li v-for="f in selecionados" :key="f.codigo" class="flex items-center justify-between py-2">
            <span class="text-sm text-ink-900">{{ f.descricao }}</span>
            <button type="button" class="text-red-500 text-sm font-semibold" @click="removeFunc(f)">Remover</button>
          </li>
        </ul>

        <label class="block mb-3">
          <span class="text-ink-600 text-xs font-medium">Observações</span>
          <textarea v-model="obs" rows="4" class="input" />
        </label>

        <div class="flex gap-2 mb-3">
          <button type="button" class="btn-primary flex-1" @click="capturar">Capturar Foto</button>
          <button type="button" class="btn-primary flex-1" @click="escolher">Escolher Fotos</button>
        </div>

        <div v-if="fotos.length" class="flex gap-2 overflow-x-auto mb-3">
          <div v-for="(f, i) in fotos" :key="i" class="relative shrink-0">
            <img :src="`data:image/jpg;base64,${f}`" class="h-20 w-20 rounded-lg object-cover" />
            <button type="button" class="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 text-white text-xs" @click="removerFoto(i)">×</button>
          </div>
        </div>

        <p v-if="msg" class="text-sm mb-3" :class="msg === 'Lançamento efetuado com sucesso' ? 'text-green-600' : 'text-red-500'">
          {{ msg }}
        </p>

        <button class="btn-primary w-full" :disabled="loading" @click="apontar">
          {{ loading ? 'Enviando...' : 'Apontar' }}
        </button>
      </section>
    </div>
  </AppShell>
</template>
