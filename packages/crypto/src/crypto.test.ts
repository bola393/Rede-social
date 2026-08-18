import { beforeAll, describe, expect, it } from 'vitest';
import {
  abrirChaveDeConversa,
  assinar,
  chaveMestraDaFrase,
  cifrarArquivo,
  cifrarMensagem,
  conferirAssinatura,
  conferirFrase,
  decifrarArquivo,
  decifrarMensagem,
  destrancarIdentidade,
  gerarChaveDeConversa,
  gerarFraseDeRecuperacao,
  gerarIdentidade,
  inicializar,
  paraBytes,
  paraTexto,
  partePublica,
  rotacionarChave,
  selarParaAparelho,
  selarParaRecuperacao,
  selarParaTodos,
  trancarIdentidade,
} from './index.js';
import type { ContextoDaMensagem } from './tipos.js';

beforeAll(async () => {
  await inicializar();
});

const contexto = (mudancas: Partial<ContextoDaMensagem> = {}): ContextoDaMensagem => ({
  conversaId: 'conversa-do-casal',
  remetenteId: 'ana',
  epoca: 1,
  momento: 1_755_000_000_000,
  ...mudancas,
});

/** Troca um byte no meio de um texto base64, simulando adulteração. */
function adulterar(base64: string): string {
  const bytes = paraBytes(base64);
  const meio = Math.floor(bytes.length / 2);
  bytes[meio] = (bytes[meio]! ^ 0xff) & 0xff;
  return paraTexto(bytes);
}

describe('identidade do aparelho', () => {
  it('gera chaves diferentes a cada vez', () => {
    expect(gerarIdentidade().troca.publica).not.toBe(gerarIdentidade().troca.publica);
  });

  it('só entrega a parte pública ao servidor', () => {
    const identidade = gerarIdentidade();
    const publica = partePublica(identidade);

    expect(publica).toEqual({
      assinatura: identidade.assinatura.publica,
      troca: identidade.troca.publica,
    });
    // A garantia que importa: nada de privado escapou junto.
    expect(JSON.stringify(publica)).not.toContain(identidade.troca.privada);
    expect(JSON.stringify(publica)).not.toContain(identidade.assinatura.privada);
  });

  it('tranca e destranca com a senha certa', () => {
    const identidade = gerarIdentidade();
    const cofre = trancarIdentidade(identidade, 'senha muito boa e comprida');

    expect(destrancarIdentidade(cofre, 'senha muito boa e comprida')).toEqual(identidade);
  });

  it('devolve null quando a senha está errada', () => {
    const cofre = trancarIdentidade(gerarIdentidade(), 'a senha certa');

    expect(destrancarIdentidade(cofre, 'a senha certa ')).toBeNull();
    expect(destrancarIdentidade(cofre, 'A senha certa')).toBeNull();
    expect(destrancarIdentidade(cofre, '')).toBeNull();
  });

  it('não guarda a chave privada em claro dentro do cofre', () => {
    const identidade = gerarIdentidade();
    const cofre = trancarIdentidade(identidade, 'senha');

    expect(JSON.stringify(cofre)).not.toContain(identidade.troca.privada);
    expect(JSON.stringify(cofre)).not.toContain(identidade.assinatura.privada);
  });

  it('recusa um cofre adulterado, mesmo com a senha certa', () => {
    const cofre = trancarIdentidade(gerarIdentidade(), 'senha');

    expect(destrancarIdentidade({ ...cofre, cifrado: adulterar(cofre.cifrado) }, 'senha')).toBeNull();
  });

  it('usa um sal diferente a cada vez, então a mesma senha gera cofres diferentes', () => {
    const identidade = gerarIdentidade();

    expect(trancarIdentidade(identidade, 'igual').cifrado).not.toBe(
      trancarIdentidade(identidade, 'igual').cifrado,
    );
  });
});

describe('assinatura', () => {
  it('confirma o que o dono assinou', () => {
    const ana = gerarIdentidade();
    const dados = new TextEncoder().encode('marcamos às oito');

    expect(conferirAssinatura(dados, assinar(dados, ana), ana.assinatura.publica)).toBe(true);
  });

  it('recusa a assinatura de outra pessoa', () => {
    const ana = gerarIdentidade();
    const bruno = gerarIdentidade();
    const dados = new TextEncoder().encode('marcamos às oito');

    expect(conferirAssinatura(dados, assinar(dados, bruno), ana.assinatura.publica)).toBe(false);
  });

  it('recusa quando os dados mudaram depois de assinados', () => {
    const ana = gerarIdentidade();
    const assinatura = assinar(new TextEncoder().encode('às oito'), ana);

    expect(
      conferirAssinatura(new TextEncoder().encode('às nove'), assinatura, ana.assinatura.publica),
    ).toBe(false);
  });
});

describe('chave da conversa', () => {
  it('entrega a chave ao aparelho a quem foi selada', () => {
    const chave = gerarChaveDeConversa();
    const celular = gerarIdentidade();

    const envelope = selarParaAparelho(chave, celular.troca.publica);

    expect(abrirChaveDeConversa(envelope, celular)).toEqual(chave);
  });

  it('não deixa outro aparelho abrir o envelope alheio', () => {
    const chave = gerarChaveDeConversa();
    const celularDaAna = gerarIdentidade();
    const celularDoBruno = gerarIdentidade();

    const paraAna = selarParaAparelho(chave, celularDaAna.troca.publica);

    expect(abrirChaveDeConversa(paraAna, celularDoBruno)).toBeNull();
  });

  it('sela para todos os aparelhos de uma vez', () => {
    const chave = gerarChaveDeConversa();
    const aparelhos = ['celular-ana', 'notebook-ana', 'celular-bruno'].map((aparelhoId) => ({
      aparelhoId,
      identidade: gerarIdentidade(),
    }));

    const envelopes = selarParaTodos(
      chave,
      aparelhos.map((a) => ({
        aparelhoId: a.aparelhoId,
        chavePublicaDeTroca: a.identidade.troca.publica,
      })),
    );

    expect(envelopes).toHaveLength(3);
    for (const [i, envelope] of envelopes.entries()) {
      expect(abrirChaveDeConversa(envelope, aparelhos[i]!.identidade)).toEqual(chave);
    }
  });

  it('gira a época com uma chave inteiramente nova', () => {
    const primeira = gerarChaveDeConversa();
    const segunda = rotacionarChave(primeira);

    expect(segunda.epoca).toBe(2);
    expect(segunda.chave).not.toBe(primeira.chave);
  });

  it('quem saiu da conversa não lê a época seguinte', () => {
    const epoca1 = gerarChaveDeConversa();
    const exNamorado = gerarIdentidade();

    // Ele tinha a chave da época 1 — e continua tendo.
    const envelopeAntigo = selarParaAparelho(epoca1, exNamorado.troca.publica);
    expect(abrirChaveDeConversa(envelopeAntigo, exNamorado)).toEqual(epoca1);

    // Ao removê-lo, gira-se a época. A chave nova não é selada para ele.
    const epoca2 = rotacionarChave(epoca1);
    const mensagemNova = cifrarMensagem('assunto particular', epoca2, contexto({ epoca: 2 }));

    // Com a única chave que ele tem, a mensagem nova não abre.
    expect(decifrarMensagem(mensagemNova, epoca1, contexto({ epoca: 2 }))).toBeNull();
  });
});

describe('mensagem', () => {
  it('vai e volta em texto igual ao original', () => {
    const chave = gerarChaveDeConversa();
    const texto = 'te amo 🤍 chega em casa que horas?';

    expect(decifrarMensagem(cifrarMensagem(texto, chave, contexto()), chave, contexto())).toBe(
      texto,
    );
  });

  it('produz bytes diferentes para o mesmo texto', () => {
    const chave = gerarChaveDeConversa();

    expect(cifrarMensagem('oi', chave, contexto()).cifrado).not.toBe(
      cifrarMensagem('oi', chave, contexto()).cifrado,
    );
  });

  it('não abre com a chave de outra conversa', () => {
    const nossa = gerarChaveDeConversa();
    const outra = gerarChaveDeConversa();

    expect(decifrarMensagem(cifrarMensagem('segredo', nossa, contexto()), outra, contexto())).toBeNull();
  });

  it('não deixa transplantar a mensagem para outra conversa', () => {
    const chave = gerarChaveDeConversa();
    const original = cifrarMensagem('era para o grupo da família', chave, contexto());

    // Mesmíssima chave e mesmos bytes — só o nome da conversa mudou.
    expect(
      decifrarMensagem(original, chave, contexto({ conversaId: 'conversa-do-trabalho' })),
    ).toBeNull();
  });

  it('não deixa atribuir a mensagem a outra pessoa', () => {
    const chave = gerarChaveDeConversa();
    const daAna = cifrarMensagem('eu que escrevi isso', chave, contexto({ remetenteId: 'ana' }));

    expect(decifrarMensagem(daAna, chave, contexto({ remetenteId: 'bruno' }))).toBeNull();
  });

  it('não deixa mudar o horário da mensagem', () => {
    const chave = gerarChaveDeConversa();
    const original = cifrarMensagem('cheguei', chave, contexto({ momento: 1_755_000_000_000 }));

    expect(decifrarMensagem(original, chave, contexto({ momento: 1_755_000_009_999 }))).toBeNull();
  });

  it('recusa a mensagem se um único byte mudou no caminho', () => {
    const chave = gerarChaveDeConversa();
    const original = cifrarMensagem('transfere 100 reais', chave, contexto());

    expect(
      decifrarMensagem({ ...original, cifrado: adulterar(original.cifrado) }, chave, contexto()),
    ).toBeNull();
    expect(
      decifrarMensagem({ ...original, nonce: adulterar(original.nonce) }, chave, contexto()),
    ).toBeNull();
  });

  it('avisa alto se a época do contexto não bate com a da chave', () => {
    const chave = gerarChaveDeConversa(); // época 1

    // Isto seria um bug de quem chamou: geraria uma mensagem ilegível para todos.
    // Melhor estourar aqui do que perder a mensagem silenciosamente.
    expect(() => cifrarMensagem('oi', chave, contexto({ epoca: 7 }))).toThrow(/época/i);
  });
});

describe('arquivos (fotos, vídeos, áudios)', () => {
  it('vai e volta byte a byte', () => {
    const audio = new Uint8Array(64_000).map((_, i) => (i * 31) % 256);

    const cofre = cifrarArquivo(audio);

    expect(decifrarArquivo(cofre.bytes, cofre.chave, cofre.nonce)).toEqual(audio);
  });

  it('cifra o arquivo de verdade, não só o embrulha', () => {
    const original = new TextEncoder().encode('CONTEUDO SUPER SECRETO'.repeat(50));

    const cofre = cifrarArquivo(original);

    expect(Buffer.from(cofre.bytes).includes('SUPER SECRETO')).toBe(false);
  });

  it('dá uma chave diferente a cada arquivo', () => {
    const bytes = new Uint8Array([1, 2, 3]);

    expect(cifrarArquivo(bytes).chave).not.toBe(cifrarArquivo(bytes).chave);
  });

  it('não abre com a chave errada, nem com bytes truncados', () => {
    const cofre = cifrarArquivo(new TextEncoder().encode('foto'));
    const outra = cifrarArquivo(new TextEncoder().encode('outra'));

    expect(decifrarArquivo(cofre.bytes, outra.chave, cofre.nonce)).toBeNull();
    expect(decifrarArquivo(cofre.bytes.slice(0, -3), cofre.chave, cofre.nonce)).toBeNull();
  });
});

describe('frase de recuperação', () => {
  it('tem 24 palavras e é válida', () => {
    const frase = gerarFraseDeRecuperacao();

    expect(frase.split(' ')).toHaveLength(24);
    expect(conferirFrase(frase)).toBe(true);
  });

  it('sorteia uma frase diferente a cada vez', () => {
    expect(gerarFraseDeRecuperacao()).not.toBe(gerarFraseDeRecuperacao());
  });

  it('deriva sempre as mesmas chaves da mesma frase', () => {
    const frase = gerarFraseDeRecuperacao();

    expect(chaveMestraDaFrase(frase)).toEqual(chaveMestraDaFrase(frase));
  });

  it('perdoa maiúsculas, espaço sobrando e quebra de linha', () => {
    const frase = gerarFraseDeRecuperacao();
    const bagunçada = `  ${frase.toUpperCase().split(' ').join('\n  ')}  `;

    expect(conferirFrase(bagunçada)).toBe(true);
    expect(chaveMestraDaFrase(bagunçada)).toEqual(chaveMestraDaFrase(frase));
  });

  it('detecta uma palavra digitada errada', () => {
    const palavras = gerarFraseDeRecuperacao().split(' ');
    palavras[5] = 'abacaxi';

    expect(conferirFrase(palavras.join(' '))).toBe(false);
    expect(() => chaveMestraDaFrase(palavras.join(' '))).toThrow(/inválida/i);
  });

  it('recupera o histórico num aparelho novo', () => {
    const frase = gerarFraseDeRecuperacao();
    const mestra = chaveMestraDaFrase(frase);
    const chave = gerarChaveDeConversa();

    // No dia em que a conversa nasceu, a chave também foi selada para a frase.
    const guardado = selarParaRecuperacao(chave, mestra.publica);
    const mensagem = cifrarMensagem('nossa primeira conversa', chave, contexto());

    // Meses depois, celular novo, só com a frase escrita no papel.
    const recuperada = abrirChaveDeConversa(guardado, { troca: chaveMestraDaFrase(frase) });

    expect(recuperada).toEqual(chave);
    expect(decifrarMensagem(mensagem, recuperada!, contexto())).toBe('nossa primeira conversa');
  });

  it('não deixa outra frase abrir o mesmo envelope', () => {
    const chave = gerarChaveDeConversa();
    const guardado = selarParaRecuperacao(chave, chaveMestraDaFrase(gerarFraseDeRecuperacao()).publica);

    const intruso = chaveMestraDaFrase(gerarFraseDeRecuperacao());

    expect(abrirChaveDeConversa(guardado, { troca: intruso })).toBeNull();
  });
});

describe('a promessa central: o servidor não lê nada', () => {
  it('não deixa vestígio do texto no que é enviado ao servidor', () => {
    const segredo = 'a senha do cofre é 4271';
    const chave = gerarChaveDeConversa();
    const celular = gerarIdentidade();

    // Exatamente o que sai deste aparelho em direção ao banco de dados.
    const oQueOServidorRecebe = JSON.stringify({
      mensagem: cifrarMensagem(segredo, chave, contexto()),
      chaveDoAparelho: selarParaAparelho(chave, celular.troca.publica),
      identidade: partePublica(celular),
      cofreDoAparelho: trancarIdentidade(celular, 'senha do dono'),
    });

    expect(oQueOServidorRecebe).not.toContain(segredo);
    expect(oQueOServidorRecebe).not.toContain('4271');
    expect(oQueOServidorRecebe).not.toContain(chave.chave);
    expect(oQueOServidorRecebe).not.toContain(celular.troca.privada);
    expect(oQueOServidorRecebe).not.toContain('senha do dono');
  });

  it('mesmo com tudo que o servidor guarda, não dá para abrir a mensagem', () => {
    const chave = gerarChaveDeConversa();
    const celular = gerarIdentidade();
    const mensagem = cifrarMensagem('conteúdo particular', chave, contexto());

    // O servidor tem o envelope selado e a chave pública. Não tem a privada.
    const envelope = selarParaAparelho(chave, celular.troca.publica);
    const chavePublicaSozinha = { troca: { publica: celular.troca.publica, privada: '' } };

    expect(abrirChaveDeConversa(envelope, chavePublicaSozinha)).toBeNull();
    expect(decifrarMensagem(mensagem, gerarChaveDeConversa(), contexto())).toBeNull();
  });
});
