import { z } from 'zod';
import { SEGUNDOS_VALIDOS, MODOS_DE_EXPIRACAO, TIPOS_DE_MENSAGEM } from './enums.js';

/**
 * As regras de validação de tudo que entra pela API.
 *
 * Ficam aqui, e não no servidor, para que a interface valide exatamente as
 * mesmas coisas — a pessoa recebe o aviso na hora de digitar, em vez de depois
 * de enviar. E, principalmente, para que os dois lados nunca discordem.
 *
 * O servidor valida de novo, sempre. A validação do navegador é gentileza com
 * quem usa; a do servidor é a que protege.
 */

/** Texto em base64url — o formato de tudo que é criptografado no projeto. */
const base64 = z
  .string()
  .regex(/^[A-Za-z0-9_-]+$/, 'Deve estar em base64url (letras, números, hífen e sublinhado).');

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'E-mail curto demais.')
  .max(200, 'E-mail longo demais.')
  .email('Isso não parece um e-mail.');

/**
 * O apelido que aparece no lugar do e-mail: `@ana`.
 *
 * Minúsculas de propósito, para que `@Ana` e `@ana` não virem duas pessoas
 * diferentes e ninguém consiga se passar por outro por causa de maiúsculas.
 */
export const apelidoSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'O apelido precisa de ao menos 3 letras.')
  .max(24, 'O apelido pode ter no máximo 24 letras.')
  .regex(/^[a-z0-9_]+$/, 'Use apenas letras sem acento, números e sublinhado.');

/**
 * A senha.
 *
 * O mínimo é 12 caracteres, e não 8 com "uma maiúscula e um símbolo". Regras de
 * composição empurram todo mundo para `Senha@123`, que é péssima; comprimento é
 * o que de fato encarece um ataque. A força real é medida pelo zxcvbn na
 * interface, que entende que "correta cavalo bateria grampo" vale mais que
 * "P@ss1".
 */
export const senhaSchema = z
  .string()
  .min(12, 'A senha precisa de pelo menos 12 caracteres. Uma frase curta funciona bem.')
  .max(200, 'Senha longa demais.');

export const nomeSchema = z
  .string()
  .trim()
  .min(1, 'Diga como você quer ser chamado.')
  .max(60, 'Nome longo demais.');

/** As chaves públicas do aparelho — o que o servidor pode saber. */
export const identidadePublicaSchema = z.object({
  assinatura: base64,
  troca: base64,
});

/** A identidade trancada com a senha, que o servidor guarda sem conseguir abrir. */
export const identidadeTrancadaSchema = z.object({
  versao: z.literal(1),
  cifrado: base64,
  nonce: base64,
  sal: base64,
  operacoes: z.number().int().positive(),
  memoria: z.number().int().positive(),
});

export const cadastroSchema = z.object({
  convite: z.string().trim().min(6, 'Código de convite inválido.').max(64),
  email: emailSchema,
  apelido: apelidoSchema,
  nome: nomeSchema,
  senha: senhaSchema,
  nomeDoAparelho: z.string().trim().min(1).max(60).default('Meu aparelho'),
  identidade: identidadePublicaSchema,
  cofre: identidadeTrancadaSchema,
  /** Pública da chave mestre derivada da frase de recuperação. */
  chaveDeRecuperacao: base64,
});

export const loginSchema = z.object({
  email: emailSchema,
  senha: z.string().min(1, 'Digite a senha.'),
  nomeDoAparelho: z.string().trim().min(1).max(60).optional(),
});

export const criarConviteSchema = z.object({
  /** Quantas pessoas podem usar este mesmo código. */
  usos: z.number().int().min(1).max(50).default(1),
  /** Validade em dias. Convite que não vence é convite que vaza. */
  validadeEmDias: z.number().int().min(1).max(90).default(7),
  observacao: z.string().trim().max(120).optional(),
});

/** Mensagem cifrada, do jeito que sai do aparelho. */
export const mensagemSchema = z.object({
  conversaId: z.string().min(1),
  tipo: z.enum(TIPOS_DE_MENSAGEM),
  epoca: z.number().int().positive(),
  cifrado: base64,
  nonce: base64,
  momento: z.number().int().positive(),
  midiaId: z.string().optional(),
  /** Prazo desta mensagem. Ausente = segue o padrão da conversa. */
  expiraEmSegundos: z
    .number()
    .int()
    .refine((s) => SEGUNDOS_VALIDOS.includes(s), 'Prazo de expiração não permitido.')
    .optional(),
  modoDeExpiracao: z.enum(MODOS_DE_EXPIRACAO).optional(),
  /** Mídia que some assim que for aberta uma vez. */
  verUmaVez: z.boolean().default(false),
});

export type Cadastro = z.infer<typeof cadastroSchema>;
export type Login = z.infer<typeof loginSchema>;
export type CriarConvite = z.infer<typeof criarConviteSchema>;
export type NovaMensagem = z.infer<typeof mensagemSchema>;
