<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import AppShell from '../components/AppShell.vue'
import FuncionariosField from '../components/FuncionariosField.vue'
import Icon from '../components/Icon.vue'
import MoneyInput from '../components/MoneyInput.vue'
import SelectField from '../components/SelectField.vue'
import { abrirSeletor } from '../lib/picker'
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
const funcionarios = ref<Opt[]>([])
const selecionados = ref<Opt[]>([])
const carregandoFunc = ref(false)

const os = ref('')
const conta = ref('')
const data = ref('')
const valor = ref<number | null>(null)
const obs = ref('')
const foto = ref<string | null>(null)

const loading = ref(false)
const msg = ref('')
const sucesso = ref(false)

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
  funcionarios.value = []
  if (!os.value) return
  const alvo = os.value
  carregandoFunc.value = true
  try {
    const lista = await listarFuncionarios(alvo)
    if (os.value === alvo) funcionarios.value = lista
  } catch {
    sucesso.value = false
    msg.value = 'Não foi possível carregar os funcionários da OS. Verifique a internet e escolha a OS de novo.'
  } finally {
    if (os.value === alvo) carregandoFunc.value = false
  }
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
  sucesso.value = false
  if (!os.value || Number(os.value) < 1) return (msg.value = 'OS deve ser selecionada')
  if (!conta.value) return (msg.value = 'Conta Financeira deve ser informada')
  if (!data.value) return (msg.value = 'Data deve ser informada')
  if (!valor.value || valor.value <= 0) return (msg.value = 'Valor deve ser informado')
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
    sucesso.value = r.ok
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
  funcionarios.value = []
}
</script>

<template>
  <AppShell title="Lançar despesa">
    <div class="page">
      <section class="panel p-4 space-y-4">
        <label class="block">
          <span class="label">Ordem de serviço</span>
          <SelectField v-model="os" :options="ordens.map((o) => ({ value: o.codigo, label: o.descricao }))" title="Selecionar OS" placeholder="Selecione uma OS" empty="Nenhuma OS disponível" @change="onOsChange" />
        </label>
        <label class="block">
          <span class="label">Conta financeira</span>
          <SelectField v-model="conta" :options="contas.map((c) => ({ value: c.codigo, label: c.descricao }))" title="Selecionar conta financeira" placeholder="Selecione uma conta" empty="Nenhuma conta disponível" />
        </label>
        <div class="grid grid-cols-2 gap-3">
          <label class="block min-w-0">
            <span class="label">Data</span>
            <input v-model="data" type="date" class="input input-datetime min-w-0" @click="abrirSeletor" />
          </label>
          <label class="block min-w-0">
            <span class="label">Valor</span>
            <MoneyInput v-model="valor" class="min-w-0" />
          </label>
        </div>
        <FuncionariosField v-model="selecionados" :funcionarios="funcionarios" :disabled="!os" :loading="carregandoFunc" />
        <label class="block">
          <span class="label">Observações</span>
          <textarea v-model="obs" rows="3" class="input" />
        </label>
      </section>

      <section class="panel p-4">
        <h2 class="section-title">Foto da nota fiscal</h2>
        <div v-if="foto" class="mt-3 relative">
          <img :src="`data:image/jpg;base64,${foto}`" alt="Foto da nota fiscal" class="w-full max-h-64 object-contain rounded-xl bg-ink-50" />
          <button type="button" class="absolute top-2 right-2 icon-btn bg-ink-900/70 text-white" aria-label="Remover foto" @click="foto = null">
            <Icon name="x" />
          </button>
        </div>
        <div class="grid grid-cols-2 gap-2 mt-3">
          <button type="button" class="btn btn-secondary" @click="capturar"><Icon name="camera" /> Tirar foto</button>
          <button type="button" class="btn btn-secondary" @click="escolher"><Icon name="image" /> Da galeria</button>
        </div>
      </section>

      <p
        v-if="msg"
        class="flex items-start gap-2 rounded-xl px-3.5 py-3 text-sm"
        :class="sucesso ? 'bg-success-50 text-success-800' : 'bg-danger-100 text-danger-700'"
        role="alert"
      >
        <Icon :name="sucesso ? 'check-circle' : 'alert'" class="mt-px" />
        {{ msg }}
      </p>
    </div>

    <template #footer>
      <button class="btn btn-primary w-full" :disabled="loading" @click="apontar">
        {{ loading ? 'Enviando…' : 'Lançar despesa' }}
      </button>
    </template>
  </AppShell>
</template>
