<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import AppShell from '../components/AppShell.vue'
import FieldError from '../components/FieldError.vue'
import FuncionariosField from '../components/FuncionariosField.vue'
import Icon from '../components/Icon.vue'
import MoneyInput from '../components/MoneyInput.vue'
import SelectField from '../components/SelectField.vue'
import { abrirSeletor } from '../lib/picker'
import { useSairSemSalvar } from '../composables/useSairSemSalvar'
import { useToast } from '../composables/useToast'
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
const tentou = ref(false)
const { notify } = useToast()
const { marcarSalvo } = useSairSemSalvar(() => [os.value, conta.value, valor.value, obs.value, foto.value, selecionados.value])

// Só depois da primeira tentativa, e some assim que o campo é preenchido.
const erros = computed(() => {
  if (!tentou.value) return {} as Record<string, string>
  const e: Record<string, string> = {}
  if (!os.value || Number(os.value) < 1) e.os = 'Escolha a ordem de serviço.'
  if (!conta.value) e.conta = 'Escolha a conta financeira.'
  if (!data.value) e.data = 'Informe a data.'
  if (!valor.value || valor.value <= 0) e.valor = 'Informe o valor.'
  // Sem OS o campo de funcionários nem abre: o erro que importa é o da OS.
  if (os.value && selecionados.value.length < 1) e.funcionarios = 'Adicione ao menos um funcionário.'
  return e
})

function dd(n: number): string {
  return String(n).padStart(2, '0')
}

function hoje(): string {
  const d = new Date()
  return `${d.getFullYear()}-${dd(d.getMonth() + 1)}-${dd(d.getDate())}`
}

onMounted(async () => {
  data.value = hoje()
  try {
    ;[ordens.value, contas.value] = await Promise.all([listarOs(), listarContas()])
  } catch {
    msg.value = 'Não foi possível carregar as OS. As despesas são lançadas online: verifique a internet e abra a tela de novo.'
  }
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
    msg.value = 'Não foi possível carregar os funcionários da OS. Verifique a internet e escolha a OS de novo.'
  } finally {
    if (os.value === alvo) carregandoFunc.value = false
  }
}

async function capturar() {
  await fotografar(CameraSource.Camera)
}

async function escolher() {
  await fotografar(CameraSource.Photos)
}

async function fotografar(source: CameraSource) {
  try {
    const photo = await Camera.getPhoto({ resultType: CameraResultType.Base64, source })
    foto.value = photo.base64String ?? foto.value
  } catch {
    // Câmera ou galeria fechada sem escolher foto.
  }
}

async function apontar() {
  msg.value = ''
  tentou.value = true
  if (Object.keys(erros.value).length) {
    await nextTick()
    const campo = document.querySelector<HTMLElement>('[aria-invalid="true"], [data-invalido]')
    campo?.scrollIntoView?.({ block: 'center' })
    campo?.focus({ preventScroll: true })
    return
  }
  // A validação acima garante o valor.
  const total = valor.value ?? 0

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
      valor: total,
      obs: obs.value,
      funcionarios: selecionados.value.map((f) => f.codigo),
      image,
    })
    if (!r.ok) throw new Error(r.msg || 'O servidor não aceitou a despesa.')
    notify(r.msg || 'Despesa lançada', 'success')
    reset()
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
  tentou.value = false
  marcarSalvo()
  window.scrollTo({ top: 0 })
}
</script>

<template>
  <AppShell title="Lançar despesa">
    <div class="page">
      <section class="panel p-4 space-y-4">
        <label class="block">
          <span class="label required">Ordem de serviço</span>
          <SelectField :aria-invalid="!!erros.os" aria-describedby="erro-os" v-model="os" :options="ordens.map((o) => ({ value: o.codigo, label: o.descricao }))" title="Selecionar OS" placeholder="Selecione uma OS" empty="Nenhuma OS disponível" @change="onOsChange" />
          <FieldError id="erro-os" :msg="erros.os" />
        </label>
        <label class="block">
          <span class="label required">Conta financeira</span>
          <SelectField :aria-invalid="!!erros.conta" aria-describedby="erro-conta" v-model="conta" :options="contas.map((c) => ({ value: c.codigo, label: c.descricao }))" title="Selecionar conta financeira" placeholder="Selecione uma conta" empty="Nenhuma conta disponível" />
          <FieldError id="erro-conta" :msg="erros.conta" />
        </label>
        <div class="grid grid-cols-2 gap-3">
          <label class="block min-w-0">
            <span class="label required">Data</span>
            <input v-model="data" type="date" class="input input-datetime min-w-0" :aria-invalid="!!erros.data" aria-describedby="erro-data" @click="abrirSeletor" />
            <FieldError id="erro-data" :msg="erros.data" />
          </label>
          <label class="block min-w-0">
            <span class="label required">Valor</span>
            <MoneyInput v-model="valor" class="min-w-0" :aria-invalid="!!erros.valor" aria-describedby="erro-valor" />
            <FieldError id="erro-valor" :msg="erros.valor" />
          </label>
        </div>
        <div :data-invalido="erros.funcionarios ? '' : undefined" tabindex="-1" class="outline-none">
          <FuncionariosField v-model="selecionados" :funcionarios="funcionarios" :disabled="!os" :loading="carregandoFunc" />
          <FieldError :msg="erros.funcionarios" />
        </div>
        <label class="block">
          <span class="label">Observações</span>
          <textarea v-model="obs" rows="3" class="input" />
        </label>
      </section>

      <section class="panel p-4">
        <h2 class="section-title">Foto da nota fiscal</h2>
        <div v-if="foto" class="mt-3 relative">
          <img :src="`data:image/jpg;base64,${foto}`" alt="Foto da nota fiscal" class="w-full max-h-64 object-contain rounded-xl bg-ink-50" />
          <button type="button" class="absolute top-2 right-2 icon-btn bg-ink-900/80 text-white active:bg-ink-900" aria-label="Remover foto" @click="foto = null">
            <Icon name="x" />
          </button>
        </div>
        <div class="grid grid-cols-2 gap-2 mt-3">
          <button type="button" class="btn btn-secondary" @click="capturar"><Icon name="camera" /> Tirar foto</button>
          <button type="button" class="btn btn-secondary" @click="escolher"><Icon name="image" /> Da galeria</button>
        </div>
      </section>

      <p v-if="msg" class="alert alert-danger" role="alert">
        <Icon name="alert" class="mt-px" />
        {{ msg }}
      </p>
    </div>

    <template #footer>
      <button type="button" class="btn btn-primary w-full" :disabled="loading" :aria-busy="loading" @click="apontar">
        {{ loading ? 'Enviando…' : 'Lançar despesa' }}
      </button>
    </template>
  </AppShell>
</template>
