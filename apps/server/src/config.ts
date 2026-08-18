import { z } from 'zod';

/**
 * Lê e confere a configuração no arranque.
 *
 * A ideia é simples: se algo essencial está faltando ou malfeito, o servidor
 * **não sobe**, e diz exatamente o quê. Muito melhor que subir aparentemente
 * bem e só falhar às três da manhã, quando alguém tentar mandar uma foto.
 */

const segredo = (nome: string) =>
  z
    .string()
    .min(32, `${nome} precisa de pelo menos 32 caracteres. Rode \`pnpm preparar\` para gerar.`);

const esquema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  NOME_DA_REDE: z.string().default('Nossa Rede'),
  DOMINIO: z.string().default('localhost'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL não foi definida. Rode `pnpm preparar`.'),

  JWT_SECRET: segredo('JWT_SECRET'),
  COOKIE_SECRET: segredo('COOKIE_SECRET'),
  MEDIA_ENCRYPTION_KEY: segredo('MEDIA_ENCRYPTION_KEY'),

  TURN_SECRET: z.string().default(''),
  TURN_REALM: z.string().default(''),

  PORTA_SERVIDOR: z.coerce.number().int().min(1).max(65_535).default(3000),

  TAMANHO_MAXIMO_UPLOAD_MB: z.coerce.number().int().min(1).max(2_048).default(100),
  DURACAO_MAXIMA_AUDIO_S: z.coerce.number().int().min(5).max(3_600).default(300),
});

export type Config = z.infer<typeof esquema> & {
  readonly emProducao: boolean;
  readonly tamanhoMaximoUploadEmBytes: number;
};

/**
 * Carrega a configuração, ou encerra explicando o que está faltando.
 *
 * O texto do erro é escrito para ser lido por quem nunca viu este projeto — é
 * bem provável que seja a primeira coisa que apareça na tela de alguém tentando
 * subir a rede pela primeira vez.
 */
export function carregarConfig(ambiente: NodeJS.ProcessEnv = process.env): Config {
  const resultado = esquema.safeParse(ambiente);

  if (!resultado.success) {
    const problemas = resultado.error.issues
      .map((p) => `  • ${p.path.join('.')}: ${p.message}`)
      .join('\n');

    console.error(
      [
        '',
        '╭──────────────────────────────────────────────────────────────╮',
        '│  O servidor não subiu: falta configuração                    │',
        '╰──────────────────────────────────────────────────────────────╯',
        '',
        problemas,
        '',
        'Como resolver: rode `pnpm preparar` na raiz do projeto. Ele cria o',
        'arquivo `.env` e sorteia todos os segredos com segurança.',
        '',
      ].join('\n'),
    );
    process.exit(1);
  }

  const config = resultado.data;

  return {
    ...config,
    emProducao: config.NODE_ENV === 'production',
    tamanhoMaximoUploadEmBytes: config.TAMANHO_MAXIMO_UPLOAD_MB * 1024 * 1024,
  };
}
