import { useMemo, useState } from 'react';
import { useSessao } from '../nucleo/sessao.js';
import { Aviso, Botao, Cabecalho, Tela } from '../pecas/basicas.js';

/**
 * A frase de 24 palavras, mostrada uma vez só.
 *
 * ## Por que esta tela é chata de propósito
 *
 * Ela não deixa seguir sem confirmar três palavras sorteadas. Isso irrita, e é
 * exatamente o ponto: sem esse atrito, quase todo mundo clica em "ok, anotei"
 * sem anotar — e descobre o problema meses depois, quando o celular quebra e o
 * histórico não volta.
 *
 * Não existe segunda chance aqui. A frase nunca chegou ao servidor e nunca vai;
 * fechar esta tela é a última vez que ela existe em algum lugar além do papel.
 */
export function FraseDeRecuperacao({ frase }: { frase: string }) {
  const { confirmarQueAnotou } = useSessao();
  const palavras = useMemo(() => frase.split(' '), [frase]);

  const [etapa, setEtapa] = useState<'ler' | 'conferir'>('ler');
  const [copiado, setCopiado] = useState(false);

  // Três posições sorteadas, decididas uma vez só — senão elas trocariam a
  // cada tecla digitada.
  const aConferir = useMemo(() => {
    const escolhidas = new Set<number>();
    while (escolhidas.size < 3) escolhidas.add(Math.floor(Math.random() * palavras.length));
    return [...escolhidas].sort((a, b) => a - b);
  }, [palavras.length]);

  const [respostas, setRespostas] = useState<Record<number, string>>({});
  const [erro, setErro] = useState(false);

  const todasCertas = aConferir.every(
    (i) => respostas[i]?.trim().toLowerCase() === palavras[i]?.toLowerCase(),
  );

  if (etapa === 'ler') {
    return (
      <Tela>
        <Cabecalho
          titulo="Sua frase de recuperação"
          descricao="Estas 24 palavras são a única forma de recuperar suas conversas se você trocar de celular ou esquecer a senha."
        />

        <Aviso tom="atencao">
          <strong>Escreva no papel.</strong> Não tire foto, não mande para você mesmo, não guarde no
          computador. Quem tiver estas palavras tem acesso a tudo, para sempre.
        </Aviso>

        <ol className="border-borda bg-superficie grid grid-cols-2 gap-x-3 gap-y-2 rounded-xl border p-4">
          {palavras.map((palavra, i) => (
            <li key={`${i}-${palavra}`} className="flex items-baseline gap-2 text-[15px]">
              <span className="text-texto-suave w-6 shrink-0 text-right text-xs">{i + 1}</span>
              <span className="font-medium">{palavra}</span>
            </li>
          ))}
        </ol>

        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(frase).then(() => setCopiado(true));
          }}
          className="text-texto-suave text-sm underline underline-offset-4"
        >
          {copiado
            ? 'Copiado — cole no papel e limpe a área de transferência'
            : 'Copiar as palavras'}
        </button>

        <Botao onClick={() => setEtapa('conferir')}>Já anotei</Botao>

        <p className="text-texto-suave text-[13px] leading-relaxed">
          Esta tela não volta. Depois daqui, a frase existe só onde você a escreveu.
        </p>
      </Tela>
    );
  }

  return (
    <Tela>
      <Cabecalho
        titulo="Confirme que anotou"
        descricao="Digite as palavras destas três posições. É a única forma de eu saber que a anotação está certa."
      />

      <div className="flex flex-col gap-4">
        {aConferir.map((i) => (
          <label key={i} className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Palavra número {i + 1}</span>
            <input
              value={respostas[i] ?? ''}
              onChange={(e) => {
                setErro(false);
                setRespostas((r) => ({ ...r, [i]: e.target.value }));
              }}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              className="border-borda bg-superficie focus:border-destaque min-h-12 rounded-xl border px-3.5 text-[16px] outline-none"
            />
          </label>
        ))}
      </div>

      {erro && <Aviso tom="ruim">Alguma palavra não bate. Confira o que você anotou.</Aviso>}

      <Botao
        onClick={() => {
          if (todasCertas) confirmarQueAnotou();
          else setErro(true);
        }}
      >
        Confirmar e entrar
      </Botao>

      <button
        type="button"
        onClick={() => setEtapa('ler')}
        className="text-texto-suave text-sm underline underline-offset-4"
      >
        Ver as palavras de novo
      </button>
    </Tela>
  );
}
