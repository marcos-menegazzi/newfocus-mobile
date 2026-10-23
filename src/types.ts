export interface Usuario {
  codlic: number
  usuario: string
  senha: string
  estoque: string
  server: string
  id: string
  versao: string
  bloqueia: string
  dias: number
  libera: string
  sincprod: string
  limcred: string
  bloqemp: string
  bloqcli: string
  libmin: string
  snos: string
  altcli: string
  obscli: string
  finped: string
  saldoflex?: number
  data_sinc?: string
  hora_sinc?: string
}

export interface LoginInput {
  server: string
  id: string
  licenciada: string
  usuario: string
  senha: string
}

export interface LoginResult {
  estoque: string
  bloqueia: string
  dias: string
  libera: string
  sincprod: string
  limcred: string
  bloqemp: string
  bloqcli: string
  libmin: string
  snos: string
  altcli: string
  obscli: string
  finped: string
  sequencia: number
}
