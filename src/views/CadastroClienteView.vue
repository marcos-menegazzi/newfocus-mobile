<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppShell from '../components/AppShell.vue'
import ScreenHeader from '../components/ScreenHeader.vue'
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
    notify('Cliente atualizado')
    return
  }

  await run(
    `INSERT INTO clifor (bairro, cep, cidade, cj, contato, ddd, email, endereco, estado, fax, inscricao, numero, razao, tel1, cnpj, emailnfe, simples, tippess, obs, fantasia, enviado, codigo, inativo, final, regiao) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'N', 0, 'N', ?, ?)`,
    [...params, f.fantasia, f.final, f.regiao],
  )
  const rows = await query<{ clifor: number }>('SELECT MAX(clifor) AS clifor FROM clifor')
  await router.replace(`/clientes/${rows[0]?.clifor ?? 0}`)
}
</script>

<template>
  <AppShell>
    <div class="p-6">
      <ScreenHeader title="Cadastro de Cliente" />

      <section class="bg-white rounded-card shadow-card p-5 mb-4">
        <h2 class="text-sm font-bold text-ink-900 mb-3">Informações do Cliente</h2>
        <div class="grid grid-cols-1 gap-3">
          <label class="block">
            <span class="text-ink-600 text-xs font-medium">Razão Social</span>
            <input v-model="form.razao" type="text" class="input" placeholder="Razão Social" />
          </label>
          <label class="block">
            <span class="text-ink-600 text-xs font-medium">Fantasia</span>
            <input v-model="form.fantasia" type="text" class="input" placeholder="Fantasia" />
          </label>
          <div class="grid grid-cols-2 gap-3">
            <label class="block">
              <span class="text-ink-600 text-xs font-medium">Simples Nacional</span>
              <select v-model="form.simples" class="input">
                <option value="S">Sim</option>
                <option value="N">Não</option>
              </select>
            </label>
            <label class="block">
              <span class="text-ink-600 text-xs font-medium">Pessoa Física</span>
              <select v-model="form.tippess" class="input">
                <option value="S">Sim</option>
                <option value="N">Não</option>
              </select>
            </label>
            <label class="block">
              <span class="text-ink-600 text-xs font-medium">Final</span>
              <select v-model="form.final" class="input">
                <option value="N">Não</option>
                <option value="S">Sim</option>
              </select>
            </label>
            <label class="block">
              <span class="text-ink-600 text-xs font-medium">Inativo</span>
              <select class="input" disabled>
                <option value="N">Não</option>
                <option value="S">Sim</option>
              </select>
            </label>
          </div>
          <label class="block">
            <span class="text-ink-600 text-xs font-medium">Região</span>
            <select v-model="form.regiao" class="input">
              <option value="">Selecione uma Região</option>
              <option v-for="r in regioes" :key="r.regiao" :value="r.regiao">{{ r.descricao }}</option>
            </select>
          </label>
          <label class="block">
            <span class="text-ink-600 text-xs font-medium">Observação</span>
            <textarea v-model="form.obs" rows="4" class="input" placeholder="Observação" />
          </label>
        </div>
      </section>

      <section class="bg-white rounded-card shadow-card p-5 mb-4">
        <h2 class="text-sm font-bold text-ink-900 mb-3">Endereço</h2>
        <div class="grid grid-cols-1 gap-3">
          <label class="block">
            <span class="text-ink-600 text-xs font-medium">Endereço</span>
            <input v-model="form.endereco" type="text" class="input" placeholder="Endereço" />
          </label>
          <div class="grid grid-cols-2 gap-3">
            <label class="block">
              <span class="text-ink-600 text-xs font-medium">Número</span>
              <input v-model="form.numero" type="text" class="input" placeholder="Número" />
            </label>
            <label class="block">
              <span class="text-ink-600 text-xs font-medium">Complemento</span>
              <input v-model="form.cj" type="text" class="input" placeholder="Complemento" />
            </label>
          </div>
          <label class="block">
            <span class="text-ink-600 text-xs font-medium">Bairro</span>
            <input v-model="form.bairro" type="text" class="input" placeholder="Bairro" />
          </label>
          <div class="grid grid-cols-2 gap-3">
            <label class="block">
              <span class="text-ink-600 text-xs font-medium">CEP</span>
              <input v-model="form.cep" type="text" class="input" placeholder="CEP" />
            </label>
            <label class="block">
              <span class="text-ink-600 text-xs font-medium">Estado</span>
              <select v-model="form.estado" class="input">
                <option value="">Estado</option>
                <option v-for="e in estados" :key="e.sigla" :value="e.sigla">{{ e.nome }}</option>
              </select>
            </label>
          </div>
          <label class="block">
            <span class="text-ink-600 text-xs font-medium">Cidade</span>
            <select v-model="form.cidade" class="input" :disabled="!form.estado">
              <option value="">Cidade</option>
              <option v-for="c in cidades" :key="c" :value="c">{{ c }}</option>
            </select>
          </label>
        </div>
      </section>

      <section class="bg-white rounded-card shadow-card p-5 mb-4">
        <h2 class="text-sm font-bold text-ink-900 mb-3">Contato</h2>
        <div class="grid grid-cols-1 gap-3">
          <label class="block">
            <span class="text-ink-600 text-xs font-medium">Contato</span>
            <input v-model="form.contato" type="text" class="input" placeholder="Contato" />
          </label>
          <div class="grid grid-cols-3 gap-3">
            <label class="block">
              <span class="text-ink-600 text-xs font-medium">DDD</span>
              <input v-model="form.ddd" type="text" class="input" placeholder="DDD" />
            </label>
            <label class="block col-span-2">
              <span class="text-ink-600 text-xs font-medium">Telefone</span>
              <input v-model="form.tel1" type="text" class="input" placeholder="Telefone" />
            </label>
          </div>
          <label class="block">
            <span class="text-ink-600 text-xs font-medium">Celular</span>
            <input v-model="form.fax" type="text" class="input" placeholder="Celular" />
          </label>
          <label class="block">
            <span class="text-ink-600 text-xs font-medium">E-mail</span>
            <input v-model="form.email" type="text" class="input" placeholder="E-mail" />
          </label>
          <label class="block">
            <span class="text-ink-600 text-xs font-medium">E-mail NF-e</span>
            <input v-model="form.emailnfe" type="text" class="input" placeholder="E-mail NF-e" />
          </label>
          <label class="block">
            <span class="text-ink-600 text-xs font-medium">CNPJ</span>
            <div class="flex gap-2">
              <input v-model="form.cnpj" type="text" class="input flex-1" placeholder="CNPJ" />
              <button type="button" class="btn-primary shrink-0 px-4" :disabled="lookupLoading" @click="buscarCnpj">
                {{ lookupLoading ? 'Buscando…' : 'Buscar' }}
              </button>
            </div>
            <p v-if="lookupMsg" class="text-red-500 text-xs mt-1">{{ lookupMsg }}</p>
          </label>
          <label class="block">
            <span class="text-ink-600 text-xs font-medium">Inscrição Estadual</span>
            <input v-model="form.inscricao" type="text" class="input" placeholder="IE" />
          </label>
        </div>
      </section>

      <button v-if="canSave" class="btn-primary w-full" @click="salvar">Salvar</button>
    </div>
  </AppShell>
</template>
