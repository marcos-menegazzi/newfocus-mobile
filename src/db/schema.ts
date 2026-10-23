export const DB_NAME = 'newfocus.db'
export const SCHEMA_VERSION = '20260930'

// Reproduced verbatim from the old Cordova app (www/index.html createDatabase()).
export const TABLES: string[] = [
  `CREATE TABLE IF NOT EXISTS usuario (
      iduser INTEGER NOT NULL PRIMARY KEY,
      codlic DOUBLE(10,0), usuario CHAR(10), senha CHAR(10), estoque CHAR(1),
      server CHAR(50), id CHAR(30), data_sinc DATE, hora_sinc TIME, versao CHAR(8),
      bloqueia CHAR(1), dias DOUBLE(2,0), libera CHAR(1), sincprod CHAR(1),
      prodsinc CHAR(1), limcred CHAR(1), bloqemp CHAR(1), bloqcli CHAR(1),
      saldoflex DOUBLE(14,2), libmin CHAR(1), snos CHAR(1), altcli CHAR(1),
      obscli CHAR(1), finped CHAR(1)
  )`,
  `CREATE TABLE IF NOT EXISTS cidades (idcidade INTEGER NOT NULL PRIMARY KEY, cidade CHAR(40), estado CHAR(2))`,
  `CREATE TABLE IF NOT EXISTS estados (idestado INTEGER NOT NULL PRIMARY KEY, estado CHAR(2), descricao CHAR(30))`,
  `CREATE TABLE IF NOT EXISTS comissao (idcomissao INTEGER NOT NULL PRIMARY KEY, codigo DOUBLE(10,0), descricao CHAR(50))`,
  `CREATE TABLE IF NOT EXISTS agenda (idagenda INTEGER NOT NULL PRIMARY KEY, clifor DOUBLE(6,0), data_base DATE, dia CHAR(1), atendido CHAR(1), hora CHAR(5), dias DOUBLE(10,0), motivo CHAR(200), snvis CHAR(1))`,
  `CREATE TABLE IF NOT EXISTS visitas (idvisita INTEGER NOT NULL PRIMARY KEY, clifor DOUBLE(6,0), data DATE, atendido CHAR(1), hora CHAR(5), motivo CHAR(200), data_agenda DATE, codmotivo CHAR(5), latitude DOUBLE(18,8), longitude DOUBLE(18,8), sincronizada CHAR(1))`,
  `CREATE TABLE IF NOT EXISTS produtos (
      idproduto INTEGER NOT NULL PRIMARY KEY, codigo CHAR(18), descricao CHAR(60),
      descred CHAR(40), grupo CHAR(15), peso DOUBLE(18,6), barras CHAR(13),
      link VARCHAR(200), comprado DOUBLE(18,6), observacao BLOB
  )`,
  `CREATE TABLE IF NOT EXISTS grupos (idgrupo INTEGER NOT NULL PRIMARY KEY, codigo CHAR(15), descricao VARCHAR(60))`,
  `CREATE TABLE IF NOT EXISTS tpreco (
      idtabela INTEGER NOT NULL PRIMARY KEY, codigo DOUBLE(10,0), descricao CHAR(40),
      flex DOUBLE(5,2), flex_pos DOUBLE(5,2), flex_max DOUBLE(5,2),
      flex_min DOUBLE(5,2), usa_cliente CHAR(1)
  )`,
  `CREATE TABLE IF NOT EXISTS fatores (idfator INTEGER NOT NULL PRIMARY KEY, produto CHAR(18), unidade CHAR(6), fator DOUBLE(18,6))`,
  `CREATE TABLE IF NOT EXISTS mvtpreco (id INTEGER NOT NULL PRIMARY KEY, tabela_codigo DOUBLE(10,0), produto CHAR(18), venda DOUBLE(14,2), maximo DOUBLE(14,2), minimo DOUBLE(14,2))`,
  `CREATE TABLE IF NOT EXISTS ped (
      idpedido INTEGER NOT NULL PRIMARY KEY, operacao CHAR(40), numpedido CHAR(10),
      clifor INTEGER, empresa INTEGER, condpag INTEGER, valor_frete DOUBLE(14,2) DEFAULT 0,
      total DOUBLE(14,2), descto DOUBLE(14,2), status CHAR(1), data DATE, obsped VARCHAR(200),
      tabela DOUBLE(10), carga DOUBLE(10), lancto DOUBLE(10), sefaz CHAR(3), file CHAR(100),
      tipo CHAR(1), comissao DOUBLE(10,0), complemento VARCHAR(200), idunico VARCHAR(100),
      numero VARCHAR(10), snunidade CHAR(1), snquilo CHAR(1), valor_quilo DOUBLE(14,2),
      valor_unidade DOUBLE(14,2), peso_total DOUBLE(18,6), retsuc DOUBLE(18,6),
      resolvido CHAR(1), cliente_nome VARCHAR(60), cliente_cpf CHAR(20), vendedor DOUBLE(6,0)
  )`,
  `CREATE TABLE IF NOT EXISTS mped (
      idpedido INTEGER NOT NULL PRIMARY KEY, numpedido CHAR(10), codproduto CHAR(18),
      qtd DOUBLE(18,6), vlunit DOUBLE(14,2), descto DOUBLE(14,2), vltotal DOUBLE(14,2),
      desctorat DOUBLE(14,2), descinc DOUBLE(14,2), vlunbase DOUBLE(14,2),
      vlbruto DOUBLE(14,2), operacao CHAR(40), condicao INTEGER, comissao DOUBLE(10,0),
      descper CHAR(1), tabela DOUBLE(10), valor_negocia DOUBLE(14,2), peso_item DOUBLE(18,6),
      unidade CHAR(6), fator DOUBLE(18,6), flex DOUBLE(14,2)
  )`,
  `CREATE TABLE IF NOT EXISTS histvenda (idvenda INTEGER NOT NULL PRIMARY KEY, pedido DOUBLE(10,0), data DATE, clifor DOUBLE(6,0), total DOUBLE(14,2), quantidade DOUBLE(18,6), lancto DOUBLE(10,0), condicao VARCHAR(50))`,
  `CREATE TABLE IF NOT EXISTS histitens (iditem INTEGER NOT NULL PRIMARY KEY, pedido DOUBLE(10,0), produto CHAR(18), descricao VARCHAR(50), faturamento CHAR(1), quant DOUBLE(18,6), vlunit DOUBLE(14,2), vldescto DOUBLE(14,2), vltotal DOUBLE(14,2), lancto DOUBLE(10,0), sequencia DOUBLE(10,0), tabela VARCHAR(50))`,
  `CREATE TABLE IF NOT EXISTS operacao (idoperacao INTEGER NOT NULL PRIMARY KEY, empresa DOUBLE(6,0), operacao CHAR(40), cobranca CHAR(2), estoque CHAR(1), local DOUBLE(10,0))`,
  `CREATE TABLE IF NOT EXISTS carga (idcarga INTEGER NOT NULL PRIMARY KEY, codigo DOUBLE(10,0), descricao CHAR(30), dataalt DATE, inativo CHAR(1))`,
  `CREATE TABLE IF NOT EXISTS historico_agenda (idhistagenda INTEGER NOT NULL PRIMARY KEY, codigo CHAR(5), descricao CHAR(60), data DATE, inativo CHAR(1))`,
  `CREATE TABLE IF NOT EXISTS estoque (idestoque INTEGER NOT NULL PRIMARY KEY, codigo CHAR(18), estoque DOUBLE(18,6), empresa DOUBLE(6,0), local DOUBLE(10,0), centralizado CHAR(1))`,
  `CREATE TABLE IF NOT EXISTS clifor (
      clifor INTEGER NOT NULL PRIMARY KEY, bairro CHAR(30), cep CHAR(10), cidade CHAR(40),
      cj CHAR(15), contato CHAR(17), ddd CHAR(10), email CHAR(100), endereco CHAR(50),
      estado CHAR(2), fax CHAR(15), inscricao CHAR(20), numero CHAR(6), razao CHAR(60),
      tel1 CHAR(15), cnpj CHAR(20), emailnfe CHAR(100), simples CHAR(1), tippess CHAR(1),
      obs BLOB, enviado CHAR(1), fantasia CHAR(60), codigo DOUBLE(6,0), inativo CHAR(1),
      tabela DOUBLE(10), saldo DOUBLE(14,2), limcred DOUBLE(14,2), credito DOUBLE(14,2),
      comissao DOUBLE(10,0), final CHAR(1), regiao CHAR(5)
  )`,
  `CREATE TABLE IF NOT EXISTS titulos (idtitulo INTEGER NOT NULL PRIMARY KEY, numero CHAR(15), valor DOUBLE(14,2), clifor DOUBLE(6), emissao DATE, vencimento DATE, obs CHAR(200), cobranca VARCHAR(100), tipo CHAR(1), empresa DOUBLE(6))`,
  `CREATE TABLE IF NOT EXISTS numped (idnumped INTEGER NOT NULL PRIMARY KEY, numped DOUBLE(10,0))`,
  `CREATE TABLE IF NOT EXISTS condicao (idcondicao INTEGER NOT NULL PRIMARY KEY, codigo DOUBLE(10,0), descr CHAR(30), parcelas CHAR(60), avista CHAR(1), inativo CHAR(1))`,
  `CREATE TABLE IF NOT EXISTS condicao_cliente (idcondicao INTEGER NOT NULL PRIMARY KEY, condicao DOUBLE(10,0), cliente DOUBLE(6,0))`,
  `CREATE TABLE IF NOT EXISTS cobranca_cliente (idcobranca INTEGER NOT NULL PRIMARY KEY, cobranca CHAR(2), cliente DOUBLE(6,0))`,
  `CREATE TABLE IF NOT EXISTS tabela_cliente (idtabela INTEGER NOT NULL PRIMARY KEY, tabela DOUBLE(10), cliente DOUBLE(6,0))`,
  `CREATE TABLE IF NOT EXISTS cobrancas (idcobranca INTEGER NOT NULL PRIMARY KEY, codigo CHAR(2), descr CHAR(60))`,
  `CREATE TABLE IF NOT EXISTS empresas (idempresa INTEGER NOT NULL PRIMARY KEY, empresa DOUBLE(6,0), fantasia CHAR(60))`,
  `CREATE TABLE IF NOT EXISTS financeiro (idfinanceiro INTEGER NOT NULL PRIMARY KEY, pedido CHAR(10), condicao DOUBLE(10,0), cobranca CHAR(2), valor DOUBLE(14,2), autorizacao CHAR(15))`,
  `CREATE TABLE IF NOT EXISTS parcelas (idparcela INTEGER NOT NULL PRIMARY KEY, idfinanceiro INTEGER, pedido CHAR(10), condicao DOUBLE(10,0), cobranca CHAR(2), valor DOUBLE(14,2))`,
  `CREATE TABLE IF NOT EXISTS regiao (idregiao INTEGER NOT NULL PRIMARY KEY, regiao CHAR(5), descricao CHAR(40))`,
  `CREATE TABLE IF NOT EXISTS vendedores (idvendedor INTEGER NOT NULL PRIMARY KEY, codigo DOUBLE(6,0), nome VARCHAR(60))`,
  `CREATE TABLE IF NOT EXISTS sucata_cliente (idsucata INTEGER NOT NULL PRIMARY KEY, cliente DOUBLE(6,0), empresa DOUBLE(6,0), saldo DOUBLE(18,6))`,
]

export const SCHEMA_SQL = TABLES.join(';\n')
