/**
 * Toda a criptografia ponta-a-ponta da rede mora aqui.
 *
 * Este pacote é de propósito o único lugar do projeto que sabe fazer contas com
 * chaves. Ele não conhece banco de dados, não conhece tela e não faz requisição
 * nenhuma — o que o torna simples de auditar e de testar de verdade.
 *
 * ## Como usar
 *
 * ```ts
 * import { inicializar, gerarIdentidade, cifrarMensagem } from '@rede/crypto';
 *
 * await inicializar(); // uma vez, antes de tudo
 * const identidade = gerarIdentidade();
 * ```
 *
 * ## O desenho, em cinco linhas
 *
 * 1. Cada aparelho tem sua identidade; as chaves privadas nunca saem dele.
 * 2. Cada conversa tem uma chave simétrica, selada para cada aparelho membro.
 * 3. Alguém entrou ou saiu? Época nova, chave nova.
 * 4. Mensagens e arquivos são cifrados com essa chave; o servidor só vê bytes.
 * 5. A frase de recuperação abre o histórico num aparelho novo.
 */

export { inicializar, iguaisEmTempoConstante, limpar, paraBytes, paraTexto, sortearBytes } from './sodium.js';

export {
  assinar,
  conferirAssinatura,
  destrancarIdentidade,
  gerarIdentidade,
  partePublica,
  trancarIdentidade,
} from './identidade.js';

export {
  abrirChaveDeConversa,
  gerarChaveDeConversa,
  rotacionarChave,
  selarParaAparelho,
  selarParaTodos,
} from './conversa.js';

export { cifrarMensagem, decifrarMensagem } from './mensagem.js';

export { cifrarArquivo, decifrarArquivo } from './arquivo.js';

export {
  chaveMestraDaFrase,
  conferirFrase,
  gerarFraseDeRecuperacao,
  selarParaRecuperacao,
} from './recuperacao.js';

export type {
  ArquivoCifrado,
  Base64,
  ChaveDeConversa,
  ChaveSelada,
  ContextoDaMensagem,
  Identidade,
  IdentidadePublica,
  IdentidadeTrancada,
  MensagemCifrada,
  ParDeAssinatura,
  ParDeTroca,
} from './tipos.js';
