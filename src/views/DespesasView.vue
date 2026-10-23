<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import AppShell from '../components/AppShell.vue'
import ScreenHeader from '../components/ScreenHeader.vue'
import {
  lancarDespesa,
  listarContas,
  listarFuncionarios,
  listarOs,
  uploadImage,
  type Opt,
} from '../services/os'

const ordens = ref<Opt[]>([])
const contas = ref<Opt[]>([])
const disponiveis = ref<Opt[]>([])
const selecionados = ref<Opt[]>([])
const func = ref<Opt | null>(null)

const os = ref('')
const conta = ref('')
const data = ref('')
const valor = ref<number | null>(null)
const obs = ref('')
const foto = ref<string | null>(null)

const loading = ref(false)
const msg = ref('')

function dd(n: number): string {
  return String(n).padStart(2, '0')
}

function hoje(): string {
  const d = new Date()
  return `${d.getFullYear()}-${dd(d.getMonth() + 1)}-${dd(d.getDate())}`
}

onMounted(async () => {
  data.value = hoje()
  ;[ordens.value, contas.value] = await Promise.all([listarOs(), listarContas()])
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

async function capturar() {
  const photo = await Camera.getPhoto({ resultType: CameraResultType.Base64, source: CameraSource.Camera })
  foto.value = photo.base64String ?? null
}

async function escolher() {
  const photo = await Camera.getPhoto({ resultType: CameraResultType.Base64, source: CameraSource.Photos })
  foto.value = photo.base64String ?? null
}

async function apontar() {
  msg.value = ''
  if (!os.value || Number(os.value) < 1) return (msg.value = 'OS deve ser selecionada')
  if (!conta.value) return (msg.value = 'Conta Financeira deve ser informada')
  if (!data.value) return (msg.value = 'Data deve ser informada')
  if (!valor.value || valor.value < 1) return (msg.value = 'Valor deve ser informado')
  if (selecionados.value.length < 1) return (msg.value = 'Deve ser informado ao menos um funcionário')

  loading.value = true
  try {
    let image = ''
    if (foto.value) {
      image = await uploadImage(foto.value)
      if (!image) throw new Error('Não foi possível efetuar o upload da imagem')
    }
    const r = await lancarDespesa({
      os: os.value,
      conta: conta.value,
      data: data.value,
      valor: valor.value,
      obs: obs.value,
      funcionarios: selecionados.value.map((f) => f.codigo),
      image,
    })
    msg.value = r.msg
    if (r.ok) reset()
  } catch (e) {
    msg.value = e instanceof Error ? e.message : 'Erro ao lançar despesa'
  } finally {
    loading.value = false
  }
}

function reset() {
  os.value = ''
  conta.value = ''
  data.value = hoje()
  valor.value = null
  obs.value = ''
  foto.value = null
  selecionados.value = []
  disponiveis.value = []
  func.value = null
}
</script>

<template>
  <AppShell>
    <div class="p-6">
      <ScreenHeader title="Lançamento de Despesas" />

      <section class="bg-white rounded-card shadow-card p-5 mb-4">
        <label class="block mb-3">
          <span class="text-ink-600 text-xs font-medium">Ordem de Serviço</span>
          <select v-model="os" class="input" @change="onOsChange">
            <option value="">Selecione uma OS</option>
            <option v-for="o in ordens" :key="o.codigo" :value="o.codigo">{{ o.descricao }}</option>
          </select>
        </label>

        <label class="block mb-3">
          <span class="text-ink-600 text-xs font-medium">Conta Financeira</span>
          <select v-model="conta" class="input">
            <option value="">Selecione uma conta</option>
            <option v-for="c in contas" :key="c.codigo" :value="c.codigo">{{ c.descricao }}</option>
          </select>
        </label>

        <div class="grid grid-cols-2 gap-3 mb-3">
          <label class="block">
            <span class="text-ink-600 text-xs font-medium">Data</span>
            <input v-model="data" type="date" class="input" />
          </label>
          <label class="block">
            <span class="text-ink-600 text-xs font-medium">Valor</span>
            <input v-model.number="valor" type="number" min="0" step="0.01" class="input" placeholder="0,00" />
          </label>
        </div>

        <label class="block mb-3">
          <span class="text-ink-600 text-xs font-medium">Observações</span>
          <textarea v-model="obs" rows="4" class="input" />
        </label>

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

        <div class="flex gap-2 mb-3">
          <button type="button" class="btn-primary flex-1" @click="capturar">
            {{ foto ? 'Foto capturada' : 'Capturar Foto NF' }}
          </button>
          <button type="button" class="btn-primary flex-1" @click="escolher">Escolher Foto</button>
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
