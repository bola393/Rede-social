/**
 * Quão boa é esta senha, de verdade.
 *
 * Usa o zxcvbn, que não conta maiúsculas e símbolos: ele **estima quantos
 * palpites** um atacante precisaria dar. É por isso que ele sabe que
 * `Senha@123` é péssima apesar de "cumprir os requisitos", e que
 * `girassol na varanda` é ótima apesar de não ter nenhum.
 *
 * O dicionário em português brasileiro importa aqui: sem ele, `futebol` e
 * `saudade` passariam por palavras raras.
 *
 * O pacote é grande (algumas centenas de KB), então só é baixado quando alguém
 * chega numa tela que tem campo de senha.
 */

export interface Forca {
  /** 0 (terrível) a 4 (ótima). Serve para desenhar as barrinhas. */
  nota: 0 | 1 | 2 | 3 | 4;
  rotulo: string;
  /** O que fazer para melhorar, quando há o que fazer. */
  conselho: string | null;
  /** Quanto tempo levaria para quebrá-la, em texto. */
  tempoParaQuebrar: string;
  /** O mesmo, em segundos — é este número que decide se passa. */
  segundosParaQuebrar: number;
  /** Passa no mínimo exigido? */
  aceitavel: boolean;
}

type Avaliador = (senha: string) => Forca;
let avaliador: Avaliador | null = null;
let carregando: Promise<Avaliador> | null = null;

const ROTULOS = ['Muito fraca', 'Fraca', 'Razoável', 'Boa', 'Ótima'] as const;

async function carregar(): Promise<Avaliador> {
  carregando ??= (async () => {
    // A versão 4 do zxcvbn trocou os singletons por uma fábrica: em vez de
    // configurar um estado global, monta-se um avaliador com as opções dele.
    // Exportações nomeadas, não `default`: a versão 4 dos pacotes de idioma
    // não traz um `default`, e usá-lo dava um "reading 'dictionary' of
    // undefined" que só aparecia no console do navegador.
    const [{ ZxcvbnFactory }, comum, portugues] = await Promise.all([
      import('@zxcvbn-ts/core'),
      import('@zxcvbn-ts/language-common'),
      import('@zxcvbn-ts/language-pt-br'),
    ]);

    const zxcvbn = new ZxcvbnFactory({
      dictionary: { ...comum.dictionary, ...portugues.dictionary },
      graphs: comum.adjacencyGraphs,
      translations: portugues.translations,
    });

    avaliador = (senha: string): Forca => {
      const r = zxcvbn.check(senha);
      const nota = r.score as Forca['nota'];

      const lento = r.crackTimes.offlineSlowHashingXPerSecond;

      return {
        nota,
        rotulo: ROTULOS[nota]!,
        // Preferimos a sugestão à "razão": a sugestão diz o que fazer, e a
        // razão só diz o que está errado.
        conselho: r.feedback.suggestions[0] ?? r.feedback.warning ?? null,
        // O cenário lento é o que importa aqui: as senhas ficam protegidas por
        // Argon2id, então um ataque offline é caro por tentativa. Já vem
        // traduzido, porque as traduções em português foram carregadas acima.
        tempoParaQuebrar: lento.display,
        segundosParaQuebrar: lento.seconds,
        aceitavel: lento.seconds >= SEGUNDOS_MINIMOS,
      };
    };

    return avaliador;
  })();

  return carregando;
}

/** Começa a baixar o dicionário antes de a pessoa digitar. */
export function prepararMedidor(): void {
  void carregar();
}

export async function medirForca(senha: string): Promise<Forca> {
  if (!senha) {
    return {
      nota: 0,
      rotulo: '',
      conselho: null,
      tempoParaQuebrar: '',
      segundosParaQuebrar: 0,
      aceitavel: false,
    };
  }

  try {
    return (avaliador ?? (await carregar()))(senha);
  } catch {
    // O medidor é conforto, não proteção: quem protege a senha é o Argon2id no
    // servidor e o limite de tentativas. Se o dicionário não carregar — rede
    // ruim, bloqueio de script —, é melhor deixar a pessoa seguir com o mínimo
    // de 12 caracteres do que travá-la numa tela que não explica nada.
    carregando = null;
    return {
      nota: 2,
      rotulo: 'Não consegui avaliar',
      conselho: 'Prefira uma frase com várias palavras.',
      tempoParaQuebrar: '',
      segundosParaQuebrar: 0,
      // Deixa passar: o medidor é conforto, e travar alguém por causa de um
      // dicionário que não baixou seria pior do que aceitar a senha.
      aceitavel: true,
    };
  }
}

/**
 * O mínimo aceito: um ano de ataque offline lento.
 *
 * ## Por que tempo, e não a nota de 0 a 4
 *
 * A nota engana. Medindo de verdade, `Senha@123456` e `Amor2024!!` tiram
 * **nota 3** e caem em **três horas**; qualquer frase natural em português
 * tira 4 e leva **séculos**. Não há meio-termo entre os dois grupos — usar a
 * nota como porteiro deixaria passar exatamente as senhas que parecem fortes
 * e não são.
 *
 * Um ano separa os dois grupos com folga enorme, e é um número que dá para
 * explicar a quem está lendo a tela.
 */
export const SEGUNDOS_MINIMOS = 365 * 24 * 60 * 60;
