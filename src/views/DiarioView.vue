<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import AppShell from '../components/AppShell.vue'
import FuncionariosField from '../components/FuncionariosField.vue'
import Icon from '../components/Icon.vue'
import SelectField from '../components/SelectField.vue'
import { useToast } from '../composables/useToast'
import {
  lancarDiario,
  listarFuncionarios,
  listarOs,
  uploadImage,
  type Apontamento,
  type Opt,
} from '../services/os'

const { notify } = useToast()

const ordens = ref<Opt[]>([])
const disponiveis = ref<Opt[]>([])
const selecionados = ref<Opt[]>([])

const os = ref('')
const data = ref('')
const hora = ref('')
const apontamentos = ref<Apontamento[]>([])
const obs = ref('')
const fotos = ref<string[]>([])

const loading = ref(false)
const msg = ref('')

const pad = (n: number) => String(n).padStart(2, '0')
const isoDia = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

onMounted(async () => {
  data.value = isoDia(new Date())
  try {
    ordens.value = await listarOs()
  } catch {
    msg.value = 'Não foi possível carregar as OS. O diário funciona online: verifique a internet e abra a tela de novo.'
  }
})

async function onOsChange() {
  selecionados.value = []
  disponiveis.value = []
  if (!os.value) return
  disponiveis.value = await listarFuncionarios(os.value)
}

function addFunc(f: Opt) {
  selecionados.value.push(f)
  disponiveis.value = disponiveis.value.filter((x) => x.codigo !== f.codigo)
}

function addAll() {
  selecionados.value.push(...disponiveis.value)
  disponiveis.value = []
}

function removeFunc(f: Opt) {
  selecionados.value = selecionados.value.filter((x) => x.codigo !== f.codigo)
  disponiveis.value.push(f)
}

function registrar(d: string, h: string) {
  if (apontamentos.value.some((a) => a.data === d && a.hora === h)) {
    msg.value = `O horário ${h} de ${formatData(d)} já foi adicionado.`
    return
  }
  apontamentos.value.push({ data: d, hora: h })
  msg.value = ''
}

function addApontamento() {
  if (!data.value || !hora.value) return (msg.value = 'Informe a data e a hora do apontamento.')
  registrar(data.value, hora.value)
  hora.value = ''
}

function addAgora() {
  const now = new Date()
  registrar(isoDia(now), `${pad(now.getHours())}:${pad(now.getMinutes())}`)
}

function removeApontamento(a: Apontamento) {
  apontamentos.value = apontamentos.value.filter((x) => x !== a)
}

function formatData(d: string): string {
  if (!d || d.length < 10) return ''
  return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`
}

function rotuloDia(d: string): string {
  const hoje = new Date()
  const ontem = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 1)
  const curto = `${d.slice(8, 10)}/${d.slice(5, 7)}`
  if (d === isoDia(hoje)) return `Hoje, ${curto}`
  if (d === isoDia(ontem)) return `Ontem, ${curto}`
  const semana = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(new Date(`${d}T12:00:00`))
  return `${semana.charAt(0).toUpperCase()}${semana.slice(1)}, ${curto}`
}

// Linha do tempo: horários em ordem, agrupados por dia.
const dias = computed(() => {
  const ordenados = [...apontamentos.value].sort((a, b) => `${a.data}${a.hora}`.localeCompare(`${b.data}${b.hora}`))
  const grupos: { data: string; itens: Apontamento[] }[] = []
  for (const a of ordenados) {
    const ultimo = grupos[grupos.length - 1]
    if (ultimo?.data === a.data) ultimo.itens.push(a)
    else grupos.push({ data: a.data, itens: [a] })
  }
  return grupos
})

const pendencias = computed(() => {
  const falta: string[] = []
  if (!os.value) falta.push('escolher a OS')
  if (!selecionados.value.length) falta.push('adicionar um funcionário')
  if (!apontamentos.value.length) falta.push('registrar um horário')
  if (!falta.length) return ''
  const ultimo = falta.pop()
  return `Para lançar, falta ${falta.length ? `${falta.join(', ')} e ${ultimo}` : ultimo}.`
})

async function foto(source: CameraSource) {
  try {
    const photo = await Camera.getPhoto({ resultType: CameraResultType.Base64, source })
    if (photo.base64String) fotos.value.push(photo.base64String)
  } catch {
    // Câmera ou galeria fechada sem escolher foto.
  }
}

function removerFoto(i: number) {
  fotos.value.splice(i, 1)
}

async function lancar() {
  if (pendencias.value) return
  msg.value = ''
  loading.value = true
  try {
    let enviadas: string[] = []
    if (fotos.value.length > 0) {
      enviadas = await Promise.all(fotos.value.map((f) => uploadImage(f)))
      if (enviadas.some((x) => !x)) throw new Error('Não foi possível enviar as fotos. Verifique a internet e tente de novo.')
    }
    const r = await lancarDiario({
      os: os.value,
      obs: obs.value,
      funcionarios: selecionados.value.map((f) => f.codigo),
      apontamentos: apontamentos.value.map(({ data: d, hora: h }) => ({ data: d, hora: h })),
      fotos: enviadas,
    })
    if (!r.ok) throw new Error(r.msg || 'O servidor não aceitou o diário.')
    notify(r.msg || 'Diário lançado', 'success')
    reset()
  } catch (e) {
    msg.value = e instanceof Error ? e.message : 'Não foi possível lançar o diário.'
  } finally {
    loading.value = false
  }
}

function reset() {
  os.value = ''
  data.value = isoDia(new Date())
  hora.value = ''
  apontamentos.value = []
  obs.value = ''
  fotos.value = []
  selecionados.value = []
  disponiveis.value = []
}
</script>

<template>
  <AppShell title="Diário de obra">
    <div class="page">
      <section class="panel p-4 space-y-4">
        <div>
          <span class="label">Ordem de serviço</span>
          <SelectField
            v-model="os"
            :options="ordens.map((o) => ({ value: o.codigo, label: o.descricao }))"
            title="Selecionar OS"
            placeholder="Selecione uma OS"
            empty="Nenhuma OS disponível"
            aria-label="Ordem de serviço"
            @change="onOsChange"
          />
        </div>
        <FuncionariosField
          :disponiveis="disponiveis"
          :selecionados="selecionados"
          :disabled="!os"
          @add="addFunc"
          @add-all="addAll"
          @remove="removeFunc"
        />
      </section>

      <section class="panel p-4" aria-labelledby="horarios-title">
        <div class="flex items-center justify-between gap-3">
          <h2 id="horarios-title" class="section-title">Horários</h2>
          <button type="button" class="btn btn-sm btn-tonal" @click="addAgora">
            <Icon name="clock" :size="17" />
            Agora
          </button>
        </div>

        <div class="mt-3 grid grid-cols-[minmax(0,1fr)_6.5rem_auto] gap-2 items-end">
          <label class="block">
            <span class="label">Data</span>
            <input v-model="data" type="date" class="input min-w-0" />
          </label>
          <label class="block">
            <span class="label">Hora</span>
            <input v-model="hora" type="time" class="input min-w-0" />
          </label>
          <button type="button" class="btn btn-tonal px-3.5" aria-label="Adicionar horário" @click="addApontamento">
            <Icon name="plus" />
          </button>
        </div>

        <div v-if="dias.length" class="mt-4">
          <div v-for="g in dias" :key="g.data" class="pt-1">
            <h3 class="text-[13px] font-semibold text-ink-700 pb-1">{{ rotuloDia(g.data) }}</h3>
            <ol class="ml-[5px] border-l-2 border-brand-100 pb-1">
              <li v-for="a in g.itens" :key="a.hora" class="timeline-item relative flex items-center justify-between gap-3 pl-5 py-1">
                <span class="figure text-[28px] tabular-nums">{{ a.hora }}</span>
                <button
                  type="button"
                  class="icon-btn text-ink-400 active:text-danger-600"
                  :aria-label="`Remover horário ${a.hora} de ${formatData(a.data)}`"
                  @click="removeApontamento(a)"
                >
                  <Icon name="trash" :size="18" />
                </button>
              </li>
            </ol>
          </div>
        </div>
        <p v-else class="meta mt-3">
          Toque em <strong class="font-semibold text-ink-700">Agora</strong> para registrar este momento, ou informe a data e a hora.
        </p>
      </section>

      <section class="panel p-4 space-y-4">
        <label class="block">
          <span class="label">Observações</span>
          <textarea v-model="obs" rows="3" class="input" placeholder="O que foi feito, materiais, ocorrências" />
        </label>
        <div>
          <div class="flex items-baseline justify-between mb-1.5">
            <span class="label mb-0">Fotos</span>
            <span v-if="fotos.length" class="meta tabular-nums">{{ fotos.length }}</span>
          </div>
          <div class="grid grid-cols-3 gap-2">
            <div v-for="(f, i) in fotos" :key="i" class="relative aspect-square">
              <img :src="`data:image/jpg;base64,${f}`" :alt="`Foto ${i + 1}`" class="h-full w-full rounded-xl object-cover" />
              <button
                type="button"
                class="absolute top-1 right-1 h-8 w-8 rounded-full bg-ink-900/75 text-white flex items-center justify-center"
                :aria-label="`Remover foto ${i + 1}`"
                @click="removerFoto(i)"
              >
                <Icon name="x" :size="16" />
              </button>
            </div>
            <button type="button" class="photo-add" @click="foto(CameraSource.Camera)">
              <Icon name="camera" :size="22" />
              Câmera
            </button>
            <button type="button" class="photo-add" @click="foto(CameraSource.Photos)">
              <Icon name="image" :size="22" />
              Galeria
            </button>
          </div>
        </div>
      </section>

      <p v-if="msg" class="flex items-start gap-2 rounded-xl px-3.5 py-3 text-sm bg-danger-100 text-danger-700" role="alert">
        <Icon name="alert" class="mt-px" />
        {{ msg }}
      </p>
    </div>

    <template #footer>
      <p v-if="pendencias" class="meta text-center mb-2">{{ pendencias }}</p>
      <button class="btn btn-primary w-full" :disabled="loading || !!pendencias" @click="lancar">
        {{ loading ? 'Enviando…' : 'Lançar diário' }}
      </button>
    </template>
  </AppShell>
</template>

<style scoped>
/* Marcador de cada horário sobre a linha do tempo. */
.timeline-item::before {
  content: '';
  position: absolute;
  left: -7px;
  top: 50%;
  width: 12px;
  height: 12px;
  margin-top: -6px;
  border-radius: 9999px;
  background: var(--color-brand-600);
  box-shadow: 0 0 0 3px var(--color-surface);
}

.photo-add {
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  border-radius: 0.75rem;
  border: 1.5px dashed var(--color-ink-200);
  color: var(--color-ink-500);
  font-size: 13px;
  font-weight: 500;
  transition: background-color 0.15s;
}
.photo-add:active {
  background: var(--color-ink-50);
}
</style>
