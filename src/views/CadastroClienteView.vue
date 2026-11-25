<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppShell from '../components/AppShell.vue'
import FieldError from '../components/FieldError.vue'
import Icon from '../components/Icon.vue'
import SelectField from '../components/SelectField.vue'
import Segmented from '../components/Segmented.vue'
import { query, run } from '../db/connection'
import { useAuthStore } from '../stores/auth'
import { consultarCnpj } from '../services/receitaWs'
import { removechar } from '../services/sync/helpers'
import estadosCidades from '../assets/estados_cidades.json'
import { useSairSemSalvar } from '../composables/useSairSemSalvar'
import { useToast } from '../composables/useToast'

interface Estado {
  sigla: string
  nome: string
  cidades: string[]
}

const estados = estadosCidades as Estado[]

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const { notify } = useToast()

const idcliente = computed(() => {
  const p = route.params.idcliente
  return Array.isArray(p) ? p[0] : p
})
const isEdit = computed(() => !!idcliente.value)

const form = reactive({
  razao: '',
  fantasia: '',
  simples: 'N',
  tippess: 'N',
  final: 'N',
  endereco: '',
  numero: '',
  cj: '',
  bairro: '',
  cep: '',
  estado: '',
  cidade: '',
  contato: '',
  ddd: '',
  tel1: '',
  fax: '',
  email: '',
  emailnfe: '',
  cnpj: '',
  inscricao: '',
  regiao: '',
  obs: '',
})
const inativo = ref(false)
const { marcarSalvo } = useSairSemSalvar(() => form)

const regioes = ref<{ regiao: string; descricao: string }[]>([])
const cidades = computed(() => estados.find((e) => e.sigla === form.estado)?.cidades ?? [])

const canSave = computed(() => {
  const u = auth.usuario
  if (!u) return false
  if (u.bloqcli === 'S') return false
  if (isEdit.value && u.altcli === 'S') return false
  return true
})

const SIM_NAO = [{ value: 'S', label: 'Sim' }, { value: 'N', label: 'Não' }]

const lookupLoading = ref(false)
const lookupMsg = ref('')
const documento = computed(() => form.cnpj.replace(/\D/g, ''))
const podeBuscarCnpj = computed(() => !lookupLoading.value && validaCNPJ(documento.value))

const FIELDS = [
  'fantasia', 'bairro', 'cep', 'cj', 'contato', 'ddd', 'email',
  'endereco', 'estado', 'fax', 'inscricao', 'numero', 'razao', 'tel1',
  'cnpj', 'emailnfe', 'simples', 'tippess', 'final', 'regiao',
] as const

onMounted(async () => {
  regioes.value = await query<{ regiao: string; descricao: string }>(
    'SELECT regiao, descricao FROM regiao',
  )
  if (!isEdit.value) return
  const rows = await query<Record<string, unknown>>('SELECT * FROM clifor WHERE clifor = ?', [idcliente.value])
  if (rows.length < 1) return
  const row = rows[0]
  for (const k of FIELDS) {
    const v = row[k]
    if (v != null) form[k] = k === 'cnpj' ? mascararDocumento(String(v).replace(/\D/g, '').slice(0, 14)) : String(v)
  }
  inativo.value = row.inativo === 'S'
  form.obs = row.obs == null ? '' : String(row.obs)
  form.cidade = removechar(String(row.cidade ?? '')).toUpperCase()
  marcarSalvo()
})

function validaCPF(cpf: string): boolean {
  if (/^(\d)\1{10}$/.test(cpf)) return false
  let v1 = 0
  let v2 = 0
  for (let i = 0; i < 9; i++) v1 += Number(cpf[i]) * (10 - i)
  v1 = (v1 * 10) % 11
  if (v1 === 10) v1 = 0
  if (v1 !== Number(cpf[9])) return false
  for (let i = 0; i < 10; i++) v2 += Number(cpf[i]) * (11 - i)
  v2 = (v2 * 10) % 11
  if (v2 === 10) v2 = 0
  return v2 === Number(cpf[10])
}

function validaCNPJ(cnpj: string): boolean {
  if (!/^\d{14}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false
  const calc = (n: number) => {
    const pesos = n === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    let v = 0
    for (let i = 0; i < n; i++) v += Number(cnpj[i]) * pesos[i]
    v %= 11
    return v < 2 ? 0 : 11 - v
  }
  return calc(12) === Number(cnpj[12]) && calc(13) === Number(cnpj[13])
}

function validaCpfCnpj(val: string): boolean {
  const digits = val.replace(/\D/g, '')
  if (digits.length === 11) return validaCPF(digits)
  if (digits.length === 14) return validaCNPJ(digits)
  return false
}

function mascararDocumento(digitos: string): string {
  if (digitos.length <= 11) {
    return digitos.replace(/^(\d{3})(?=\d)/, '$1.')
      .replace(/(\.\d{3})(?=\d)/, '$1.')
      .replace(/(\.\d{3}\.\d{3})(?=\d)/, '$1-')
  }
  return digitos.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})$/, '$1.$2.$3/$4-$5')
    .replace(/^(\d{2})(\d{3})(\d{3})(\d{1,3})$/, '$1.$2.$3/$4')
    .replace(/-$/, '')
}

function atualizarDocumento(event: Event) {
  const input = event.target as HTMLInputElement
  const posicao = input.selectionStart ?? input.value.length
  const antesDoCursor = input.value.slice(0, posicao).replace(/\D/g, '').length
  const digitos = input.value.replace(/\D/g, '').slice(0, 14)
  const mascara = mascararDocumento(digitos)
  if (digitos !== documento.value) lookupMsg.value = ''
  form.cnpj = mascara
  if (input.value !== mascara) {
    input.value = mascara
    let cursor = 0
    let lidos = 0
    while (cursor < mascara.length && lidos < antesDoCursor) {
      if (/\d/.test(mascara[cursor])) lidos += 1
      cursor += 1
    }
    input.setSelectionRange(cursor, cursor)
  }
}

async function buscarCnpj() {
  if (!podeBuscarCnpj.value) return
  lookupMsg.value = ''
  const cnpj = documento.value
  lookupLoading.value = true
  const mesmoDocumento = () => documento.value === cnpj
  try {
    const dados = await consultarCnpj(cnpj)
    if (mesmoDocumento()) Object.assign(form, dados)
  } catch (e) {
    if (mesmoDocumento()) lookupMsg.value = e instanceof Error ? e.message : 'Não foi possível consultar a ReceitaWS.'
  } finally {
    lookupLoading.value = false
  }
}

// Na ordem em que os campos aparecem na tela.
const OBRIGATORIOS = [
  ['cnpj', 'CNPJ ou CPF', 'Informe o CNPJ ou o CPF.'],
  ['razao', 'Razão social', 'Informe a razão social.'],
  ['fantasia', 'Nome fantasia', 'Informe o nome fantasia.'],
  ['endereco', 'Logradouro', 'Informe o logradouro.'],
  ['numero', 'Número', 'Informe o número.'],
  ['bairro', 'Bairro', 'Informe o bairro.'],
  ['cep', 'CEP', 'Informe o CEP.'],
  ['estado', 'Estado', 'Escolha o estado.'],
  ['cidade', 'Cidade', 'Escolha a cidade.'],
  ['tel1', 'Telefone', 'Informe o telefone.'],
  ['email', 'E-mail', 'Informe o e-mail.'],
  ['emailnfe', 'E-mail para NF-e', 'Informe o e-mail para NF-e.'],
] as const
type Campo = (typeof OBRIGATORIOS)[number][0]

const erros = reactive<Partial<Record<Campo, string>>>({})
const pendentes = computed(() => OBRIGATORIOS.filter(([c]) => erros[c]))
const resumoErros = ref<HTMLElement | null>(null)
const salvando = ref(false)

function erroDe(campo: Campo): string {
  const obrigatorio = OBRIGATORIOS.find(([c]) => c === campo)!
  if (!form[campo]) return obrigatorio[2]
  if (campo === 'cnpj' && !validaCpfCnpj(form.cnpj)) return 'CNPJ ou CPF inválido. Confira os números.'
  return ''
}

// Um campo marcado com erro se corrige assim que o valor fica válido.
watch(form, () => {
  for (const [c] of pendentes.value) if (!erroDe(c)) delete erros[c]
})

const attrs = (c: Campo) => ({
  id: c,
  'aria-invalid': erros[c] ? ('true' as const) : undefined,
  'aria-describedby': erros[c] ? `erro-${c}` : undefined,
  'aria-required': 'true' as const,
})

function irAoCampo(c: Campo) {
  const el = document.getElementById(c)
  el?.scrollIntoView?.({ block: 'center' })
  el?.focus({ preventScroll: true })
}

async function salvar() {
  if (salvando.value) return
  for (const [c] of OBRIGATORIOS) {
    const e = erroDe(c)
    if (e) erros[c] = e
    else delete erros[c]
  }
  if (pendentes.value.length) {
    await nextTick()
    if (pendentes.value.length === 1) irAoCampo(pendentes.value[0][0])
    else {
      resumoErros.value?.scrollIntoView?.({ block: 'center' })
      resumoErros.value?.focus({ preventScroll: true })
    }
    return
  }
  salvando.value = true
  try {
    await gravar()
  } catch (e) {
    notify(e instanceof Error ? e.message : 'Não foi possível salvar o cliente', 'error')
  } finally {
    salvando.value = false
  }
}

async function gravar() {
  const f = form
  const cnpj = f.cnpj.replace(/\D/g, '')

  const params = [
    f.bairro, f.cep, f.cidade, f.cj, f.contato, f.ddd, f.email, f.endereco,
    f.estado, f.fax, f.inscricao, f.numero, f.razao, f.tel1, cnpj, f.emailnfe,
    f.simples, f.tippess, f.obs,
  ]

  if (isEdit.value) {
    await run(
      `UPDATE clifor SET fantasia=?, bairro=?, cep=?, cidade=?, cj=?, contato=?, ddd=?, email=?, endereco=?, estado=?, fax=?, inscricao=?, numero=?, razao=?, tel1=?, cnpj=?, emailnfe=?, simples=?, tippess=?, obs=?, enviado='N', final=?, regiao=? WHERE clifor = ?`,
      [f.fantasia, ...params, f.final, f.regiao, idcliente.value],
    )
    marcarSalvo()
    notify('Cliente atualizado', 'success')
    return
  }

  await run(
    `INSERT INTO clifor (bairro, cep, cidade, cj, contato, ddd, email, endereco, estado, fax, inscricao, numero, razao, tel1, cnpj, emailnfe, simples, tippess, obs, fantasia, enviado, codigo, inativo, final, regiao) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'N', 0, 'N', ?, ?)`,
    [...params, f.fantasia, f.final, f.regiao],
  )
  marcarSalvo()
  notify('Cliente cadastrado', 'success')
  const rows = await query<{ clifor: number }>('SELECT MAX(clifor) AS clifor FROM clifor')
  await router.replace(`/clientes/${rows[0]?.clifor ?? 0}`)
}
</script>

<template>
  <AppShell :title="isEdit ? 'Editar cliente' : 'Novo cliente'" :subtitle="isEdit ? form.fantasia : undefined" back>
    <div class="page">
      <p v-if="!canSave" class="alert alert-warn">
        <Icon name="info" class="mt-px" />
        Seu usuário não tem permissão para {{ isEdit ? 'alterar' : 'cadastrar' }} clientes. Os dados estão só para consulta.
      </p>

      <div
        v-if="pendentes.length > 1"
        ref="resumoErros"
        class="alert alert-danger"
        role="alert"
        tabindex="-1"
        aria-labelledby="resumo-erros"
      >
        <Icon name="alert" class="mt-px" />
        <div>
          <h2 id="resumo-erros" class="font-semibold">Faltam {{ pendentes.length }} campos para salvar</h2>
          <ul class="mt-1.5 flex flex-wrap gap-x-4">
            <li v-for="[c, rotulo] in pendentes" :key="c">
              <button type="button" class="min-h-9 font-medium underline underline-offset-4" @click="irAoCampo(c)">{{ rotulo }}</button>
            </li>
          </ul>
        </div>
      </div>
      <p v-else-if="canSave" class="meta px-1">Campos com <span class="font-semibold text-danger-700">*</span> são obrigatórios.</p>

      <section class="panel p-4 space-y-4">
        <div>
          <h2 class="section-title">Documento</h2>
          <p class="meta mt-0.5">Com um CNPJ válido, busque os dados na Receita para preencher o cadastro.</p>
        </div>
        <div>
          <label class="label required" for="cnpj">CNPJ ou CPF</label>
          <div class="flex gap-2">
            <input v-bind="attrs('cnpj')" :value="form.cnpj" type="text" inputmode="numeric" autocomplete="off" class="input flex-1 min-w-0" placeholder="Somente números" @input="atualizarDocumento" />
            <button type="button" class="btn btn-tonal shrink-0" :disabled="!podeBuscarCnpj" :aria-busy="lookupLoading" @click="buscarCnpj">
              <Icon name="search" :size="18" />
              {{ lookupLoading ? 'Buscando…' : 'Buscar' }}
            </button>
          </div>
          <p v-if="lookupMsg" class="field-error" role="alert">
            <Icon name="alert" :size="16" class="mt-0.5" /> {{ lookupMsg }}
          </p>
          <FieldError id="erro-cnpj" :msg="erros.cnpj" />
        </div>
        <label class="block">
          <span class="label">Inscrição estadual</span>
          <input v-model="form.inscricao" type="text" class="input" />
        </label>
      </section>

      <section class="panel p-4 space-y-4">
        <h2 class="section-title">Informações do cliente</h2>
        <label class="block">
          <span class="label required">Razão social</span>
          <input v-bind="attrs('razao')" v-model="form.razao" type="text" autocomplete="organization" class="input" />
          <FieldError id="erro-razao" :msg="erros.razao" />
        </label>
        <label class="block">
          <span class="label required">Nome fantasia</span>
          <input v-bind="attrs('fantasia')" v-model="form.fantasia" type="text" autocomplete="off" class="input" />
          <FieldError id="erro-fantasia" :msg="erros.fantasia" />
        </label>
        <div class="grid grid-cols-1 min-[400px]:grid-cols-2 gap-4">
          <div>
            <span class="label">Simples Nacional</span>
            <Segmented v-model="form.simples" :options="SIM_NAO" label="Simples Nacional" />
          </div>
          <div>
            <span class="label">Pessoa física</span>
            <Segmented v-model="form.tippess" :options="SIM_NAO" label="Pessoa física" />
          </div>
          <div>
            <span class="label">Consumidor final</span>
            <Segmented v-model="form.final" :options="SIM_NAO" label="Consumidor final" />
          </div>
          <div>
            <span class="label">Inativo</span>
            <div class="input flex items-center text-ink-500 bg-ink-50">{{ inativo ? 'Sim' : 'Não' }}</div>
          </div>
        </div>
        <label class="block">
          <span class="label">Região</span>
          <SelectField v-model="form.regiao" :options="regioes.map((r) => ({ value: r.regiao, label: r.descricao }))" title="Selecionar região" placeholder="Selecione uma região" empty="Nenhuma região disponível" emptyHint="Sincronize para baixar as regiões." />
        </label>
        <label class="block">
          <span class="label">Observação</span>
          <textarea v-model="form.obs" rows="3" class="input" />
        </label>
      </section>

      <section class="panel p-4 space-y-4">
        <h2 class="section-title">Endereço</h2>
        <div class="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-3">
          <label class="block">
            <span class="label required">Logradouro</span>
            <input v-bind="attrs('endereco')" v-model="form.endereco" type="text" autocomplete="off" class="input" />
            <FieldError id="erro-endereco" :msg="erros.endereco" />
          </label>
          <label class="block">
            <span class="label required">Número</span>
            <input v-bind="attrs('numero')" v-model="form.numero" type="text" autocomplete="off" class="input" />
            <FieldError id="erro-numero" :msg="erros.numero" />
          </label>
        </div>
        <label class="block">
          <span class="label">Complemento</span>
          <input v-model="form.cj" type="text" class="input" />
        </label>
        <div class="grid grid-cols-[minmax(0,1fr)_8rem] gap-3">
          <label class="block">
            <span class="label required">Bairro</span>
            <input v-bind="attrs('bairro')" v-model="form.bairro" type="text" autocomplete="off" class="input" />
            <FieldError id="erro-bairro" :msg="erros.bairro" />
          </label>
          <label class="block">
            <span class="label required">CEP</span>
            <input v-bind="attrs('cep')" v-model="form.cep" type="text" inputmode="numeric" autocomplete="off" class="input" />
            <FieldError id="erro-cep" :msg="erros.cep" />
          </label>
        </div>
        <label class="block">
          <span class="label required">Estado</span>
          <SelectField v-bind="attrs('estado')" v-model="form.estado" :options="estados.map((e) => ({ value: e.sigla, label: e.nome, hint: e.sigla }))" title="Selecionar estado" placeholder="Selecione o estado" />
          <FieldError id="erro-estado" :msg="erros.estado" />
        </label>
        <label class="block">
          <span class="label required">Cidade</span>
          <SelectField v-bind="attrs('cidade')" v-model="form.cidade" :options="cidades.map((c) => ({ value: c, label: c }))" title="Selecionar cidade" :placeholder="form.estado ? 'Selecione a cidade' : 'Escolha o estado primeiro'" :disabled="!form.estado" />
          <FieldError id="erro-cidade" :msg="erros.cidade" />
        </label>
      </section>

      <section class="panel p-4 space-y-4">
        <h2 class="section-title">Contato</h2>
        <label class="block">
          <span class="label">Nome do contato</span>
          <input v-model="form.contato" type="text" class="input" />
        </label>
        <div class="grid grid-cols-[5rem_minmax(0,1fr)] gap-3">
          <label class="block">
            <span class="label">DDD</span>
            <input v-model="form.ddd" type="text" inputmode="numeric" maxlength="3" class="input" />
          </label>
          <label class="block">
            <span class="label required">Telefone</span>
            <input v-bind="attrs('tel1')" v-model="form.tel1" type="tel" autocomplete="off" class="input" />
            <FieldError id="erro-tel1" :msg="erros.tel1" />
          </label>
        </div>
        <label class="block">
          <span class="label">Celular</span>
          <input v-model="form.fax" type="tel" class="input" />
        </label>
        <label class="block">
          <span class="label required">E-mail</span>
          <input v-bind="attrs('email')" v-model="form.email" type="email" autocapitalize="off" autocomplete="off" class="input" />
          <FieldError id="erro-email" :msg="erros.email" />
        </label>
        <label class="block">
          <span class="label required">E-mail para NF-e</span>
          <input v-bind="attrs('emailnfe')" v-model="form.emailnfe" type="email" autocapitalize="off" autocomplete="off" class="input" />
          <FieldError id="erro-emailnfe" :msg="erros.emailnfe" />
        </label>
      </section>
    </div>

    <template v-if="canSave" #footer>
      <button type="button" class="btn btn-primary w-full" :disabled="salvando" :aria-busy="salvando" @click="salvar">
        {{ salvando ? 'Salvando…' : isEdit ? 'Salvar alterações' : 'Cadastrar cliente' }}
      </button>
    </template>
  </AppShell>
</template>
