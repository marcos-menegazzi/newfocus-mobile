<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppShell from '../components/AppShell.vue'
import Icon from '../components/Icon.vue'
import SelectField from '../components/SelectField.vue'
import Segmented from '../components/Segmented.vue'
import { query, run } from '../db/connection'
import { useAuthStore } from '../stores/auth'
import { removechar } from '../services/sync/helpers'
import estadosCidades from '../assets/estados_cidades.json'
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
    if (v != null) form[k] = String(v)
  }
  form.obs = row.obs == null ? '' : String(row.obs)
  form.cidade = removechar(String(row.cidade ?? '')).toUpperCase()
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
  if (/^(\d)\1{13}$/.test(cnpj)) return false
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

async function buscarCnpj() {
  lookupMsg.value = ''
  const cnpj = form.cnpj.replace(/\D/g, '')
  if (!validaCNPJ(cnpj)) {
    lookupMsg.value = 'CNPJ inválido'
    return
  }
  lookupLoading.value = true
  try {
    const res = await fetch(`https://receitaws.com.br/v1/cnpj/${cnpj}`)
    const r = await res.json()
    if (r.status === 'ERROR') {
      lookupMsg.value = 'CNPJ não localizado'
      return
    }
    form.razao = r.razao_social || r.nome || ''
    form.fantasia = r.fantasia || ''
    form.endereco = r.logradouro || ''
    form.numero = r.numero || ''
    form.cj = r.complemento || ''
    form.bairro = r.bairro || ''
    form.cep = r.cep || ''
    form.estado = r.uf || ''
    form.cidade = removechar(String(r.municipio ?? '')).toUpperCase()
    const tel = (r.telefone || '').replace(/\D/g, '')
    form.ddd = tel.slice(0, 2)
    form.tel1 = tel.slice(2)
    form.email = r.email || ''
    form.emailnfe = r.email || ''
    form.simples = r.simples && r.simples.optante ? 'S' : 'N'
    form.tippess = 'N'
  } catch {
    lookupMsg.value = 'Não foi possível buscar o CNPJ. Verifique sua conexão.'
  } finally {
    lookupLoading.value = false
  }
}

async function salvar() {
  const f = form
  if (!f.razao) return notify('Informe a Razão Social')
  if (!f.fantasia) return notify('Informe a Fantasia')
  if (!f.bairro) return notify('Informe o Bairro')
  if (!f.cep) return notify('Informe o CEP')
  if (!f.cidade) return notify('Informe a Cidade')
  if (!f.email) return notify('Informe o Email')
  if (!f.endereco) return notify('Informe o Endereço')
  if (!f.estado) return notify('Informe o Estado')
  if (!f.numero) return notify('Informe o Número')
  if (!f.tel1) return notify('Informe o Telefone')
  if (!f.cnpj) return notify('Informe o CNPJ/CPF')
  if (!f.emailnfe) return notify('Informe o Email NF-e')

  const cnpj = f.cnpj.replace(/\D/g, '')
  if (!validaCpfCnpj(cnpj)) return notify('CPF/CNPJ inválido, favor verificar.')

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
    notify('Cliente atualizado', 'success')
    return
  }

  await run(
    `INSERT INTO clifor (bairro, cep, cidade, cj, contato, ddd, email, endereco, estado, fax, inscricao, numero, razao, tel1, cnpj, emailnfe, simples, tippess, obs, fantasia, enviado, codigo, inativo, final, regiao) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'N', 0, 'N', ?, ?)`,
    [...params, f.fantasia, f.final, f.regiao],
  )
  notify('Cliente cadastrado', 'success')
  const rows = await query<{ clifor: number }>('SELECT MAX(clifor) AS clifor FROM clifor')
  await router.replace(`/clientes/${rows[0]?.clifor ?? 0}`)
}
</script>

<template>
  <AppShell :title="isEdit ? 'Editar cliente' : 'Novo cliente'" :subtitle="isEdit ? form.fantasia : undefined" back>
    <div class="page">
      <p v-if="!canSave" class="flex items-start gap-2 rounded-xl bg-sun-100 text-sun-800 px-3.5 py-3 text-sm">
        <Icon name="info" class="mt-px" />
        Seu usuário não tem permissão para {{ isEdit ? 'alterar' : 'cadastrar' }} clientes. Os dados estão só para consulta.
      </p>

      <section class="panel p-4 space-y-4">
        <div>
          <h2 class="section-title">Documento</h2>
          <p class="meta mt-0.5">Com um CNPJ válido, busque os dados na Receita para preencher o cadastro.</p>
        </div>
        <div>
          <label class="label" for="cnpj">CNPJ ou CPF</label>
          <div class="flex gap-2">
            <input id="cnpj" v-model="form.cnpj" type="text" inputmode="numeric" class="input flex-1" placeholder="Somente números" />
            <button type="button" class="btn btn-tonal shrink-0" :disabled="lookupLoading" @click="buscarCnpj">
              <Icon name="search" :size="18" />
              {{ lookupLoading ? 'Buscando…' : 'Buscar' }}
            </button>
          </div>
          <p v-if="lookupMsg" class="text-danger-700 text-sm mt-1.5 flex items-center gap-1.5" role="alert">
            <Icon name="alert" :size="16" /> {{ lookupMsg }}
          </p>
        </div>
        <label class="block">
          <span class="label">Inscrição estadual</span>
          <input v-model="form.inscricao" type="text" class="input" />
        </label>
      </section>

      <section class="panel p-4 space-y-4">
        <h2 class="section-title">Informações do cliente</h2>
        <label class="block">
          <span class="label">Razão social</span>
          <input v-model="form.razao" type="text" class="input" />
        </label>
        <label class="block">
          <span class="label">Nome fantasia</span>
          <input v-model="form.fantasia" type="text" class="input" />
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
            <div class="input flex items-center text-ink-500 bg-ink-50">Não</div>
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
        <div class="grid grid-cols-[1fr_6.5rem] gap-3">
          <label class="block">
            <span class="label">Logradouro</span>
            <input v-model="form.endereco" type="text" class="input" />
          </label>
          <label class="block">
            <span class="label">Número</span>
            <input v-model="form.numero" type="text" class="input" />
          </label>
        </div>
        <label class="block">
          <span class="label">Complemento</span>
          <input v-model="form.cj" type="text" class="input" />
        </label>
        <div class="grid grid-cols-[1fr_8rem] gap-3">
          <label class="block">
            <span class="label">Bairro</span>
            <input v-model="form.bairro" type="text" class="input" />
          </label>
          <label class="block">
            <span class="label">CEP</span>
            <input v-model="form.cep" type="text" inputmode="numeric" class="input" />
          </label>
        </div>
        <label class="block">
          <span class="label">Estado</span>
          <SelectField v-model="form.estado" :options="estados.map((e) => ({ value: e.sigla, label: e.nome, hint: e.sigla }))" title="Selecionar estado" placeholder="Selecione o estado" />
        </label>
        <label class="block">
          <span class="label">Cidade</span>
          <SelectField v-model="form.cidade" :options="cidades.map((c) => ({ value: c, label: c }))" title="Selecionar cidade" :placeholder="form.estado ? 'Selecione a cidade' : 'Escolha o estado primeiro'" :disabled="!form.estado" />
        </label>
      </section>

      <section class="panel p-4 space-y-4">
        <h2 class="section-title">Contato</h2>
        <label class="block">
          <span class="label">Nome do contato</span>
          <input v-model="form.contato" type="text" class="input" />
        </label>
        <div class="grid grid-cols-[5rem_1fr] gap-3">
          <label class="block">
            <span class="label">DDD</span>
            <input v-model="form.ddd" type="text" inputmode="numeric" maxlength="3" class="input" />
          </label>
          <label class="block">
            <span class="label">Telefone</span>
            <input v-model="form.tel1" type="tel" class="input" />
          </label>
        </div>
        <label class="block">
          <span class="label">Celular</span>
          <input v-model="form.fax" type="tel" class="input" />
        </label>
        <label class="block">
          <span class="label">E-mail</span>
          <input v-model="form.email" type="email" autocapitalize="off" class="input" />
        </label>
        <label class="block">
          <span class="label">E-mail para NF-e</span>
          <input v-model="form.emailnfe" type="email" autocapitalize="off" class="input" />
        </label>
      </section>
    </div>

    <template v-if="canSave" #footer>
      <button class="btn btn-primary w-full" @click="salvar">
        {{ isEdit ? 'Salvar alterações' : 'Cadastrar cliente' }}
      </button>
    </template>
  </AppShell>
</template>
