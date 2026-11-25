import { expect, it } from 'vitest'
import { comandoMetas, linhasMetas } from './metas'

const item = (grupo: string) => `<item><grupo>${grupo}</grupo><quantidade>1</quantidade><total>10</total><meta>20</meta><falta>10</falta><percmeta>50</percmeta><percfalta>50</percfalta></item>`
const doc = (xml: string) => new DOMParser().parseFromString(xml, 'text/xml')

it('lê os itens dentro de <itens>', () => {
  const r = linhasMetas(doc(`<String><retorno><tipo>grupo</tipo><itens>${item('A')}${item('B')}</itens></retorno></String>`))
  expect(r.tipo).toBe('grupo')
  expect(r.rows.map((x) => x.label)).toEqual(['A', 'B'])
})
it('lê os itens direto em <retorno>', () => {
  const r = linhasMetas(doc(`<String><retorno><tipo>grupo</tipo>${item('A')}${item('B')}</retorno></String>`))
  expect(r.rows.map((x) => x.label)).toEqual(['A', 'B'])
})
it('envia as datas no formato do app original', () => {
  expect(comandoMetas(3, { dtInicial: '2026-11-01', dtFinal: '2026-11-25', grupo: '', marca: '7', faturamento: 'S' }))
    .toBe("P_RMTWEB01:EXEC(3, '2026-11-01', '2026-11-25', '', '7', 'S')")
})
