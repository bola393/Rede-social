import { z } from 'zod';

/**
 * A resposta do `/api/saude`.
 *
 * É o que o `pnpm doutor` e a tela inicial consultam para dizer se a rede está
 * de pé. Deve responder rápido e sem exigir login: é justamente quando as
 * coisas estão quebradas que alguém vai chamá-la.
 *
 * Cuidado deliberado: esta resposta é pública, então ela diz *se* algo está
 * funcionando, nunca *por quê* falhou. Mensagem de erro de banco aqui seria um
 * presente para quem estivesse bisbilhotando.
 */
export const saudeSchema = z.object({
  ok: z.boolean(),
  nome: z.string(),
  versao: z.string(),
  /** Quantos segundos o servidor está no ar. */
  noArHa: z.number(),
  banco: z.enum(['ok', 'fora']),
  /**
   * Se a página está sendo servida por HTTPS de verdade.
   *
   * Importa mais do que parece: sem contexto seguro, o Android bloqueia câmera
   * e microfone, e nada de áudio ou chamada funciona.
   */
  contextoSeguro: z.boolean(),
});

export type Saude = z.infer<typeof saudeSchema>;
