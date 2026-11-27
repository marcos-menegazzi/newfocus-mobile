<script setup lang="ts">
import { computed } from 'vue'
import Icon from './Icon.vue'
import { formatNumero, formatReal } from '../lib/format'

export interface DetalheItem {
  label: string
  valor: string
  /** Difere das condições do pedido: o vendedor precisa ver ao revisar. */
  diverge: boolean
}

const props = defineProps<{
  item: {
    codproduto?: number | string | null
    descricao?: string
    qtd?: number | string | null
    unidade?: string
    vlunit?: number | string | null
    vltotal?: number | string | null
    descto?: number | string | null
    descper?: string
    descinc?: number | string | null
  }
  detalhes: DetalheItem[]
  /** Mostra Editar e Excluir; sem isso o item é só para consulta. */
  editavel?: boolean
  /** Bloqueia as ações (pedido fora de aberto) sem escondê-las. */
  bloqueado?: boolean
}>()

const emit = defineEmits<{ (e: 'editar'): void; (e: 'excluir'): void }>()

const nome = computed(() => props.item.descricao || String(props.item.codproduto ?? ''))

// Desconto e desconto incondicional em uma linha curta, junto do preço.
const descontos = computed(() => {
  const d = Number(props.item.descto || 0)
  const inc = Number(props.item.descinc || 0)
  return [
    d > 0 && `desc. ${props.item.descper === 'S' ? `${formatNumero(d)}%` : `R$ ${formatReal(d)}`}`,
    inc > 0 && `desc. inc. ${formatNumero(inc)}%`,
  ]
    .filter(Boolean)
    .join(', ')
})
</script>

<template>
  <div class="min-w-0">
    <div class="flex items-start gap-2">
      <p class="min-w-0 flex-1 text-[15px] font-medium leading-snug line-clamp-2">
        <span class="tabular-nums text-ink-500">{{ item.codproduto }}</span> - {{ item.descricao }}
      </p>
      <div v-if="editavel" class="-mr-2 -mt-2.5 flex shrink-0 gap-1">
        <button type="button" class="icon-btn" :aria-label="`Editar ${nome}`" :disabled="bloqueado" @click="emit('editar')">
          <Icon name="edit" :size="18" />
        </button>
        <button type="button" class="icon-btn text-danger-600" :aria-label="`Excluir ${nome}`" :disabled="bloqueado" @click="emit('excluir')">
          <Icon name="trash" :size="18" />
        </button>
      </div>
    </div>

    <div class="mt-1 flex items-baseline justify-between gap-3">
      <p class="meta min-w-0 tabular-nums">
        {{ formatNumero(item.qtd) }}{{ item.unidade ? ` ${item.unidade}` : '' }} × R$ {{ formatReal(item.vlunit) }}<template v-if="descontos"><span aria-hidden="true"> · </span><span class="font-medium text-brand-600">{{ descontos }}</span></template>
      </p>
      <p class="shrink-0 text-[15px] font-semibold tabular-nums">R$ {{ formatReal(item.vltotal) }}</p>
    </div>

    <dl v-if="detalhes.length" class="mt-2 flex flex-wrap gap-1.5">
      <div
        v-for="d in detalhes"
        :key="d.label"
        class="tag"
        :class="{ 'tag-destaque': d.diverge }"
      >
        <dt class="shrink-0" :class="d.diverge ? 'text-brand-600' : 'text-ink-500'">{{ d.label }}</dt>
        <dd class="min-w-0 break-words font-medium">
          {{ d.valor }}<span v-if="d.diverge" class="sr-only"> (diferente do pedido)</span>
        </dd>
      </div>
    </dl>
  </div>
</template>
