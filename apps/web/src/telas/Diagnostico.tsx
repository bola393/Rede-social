import { useCallback, useEffect, useState } from 'react';
import {
  verificarCameraEMicrofone,
  verificarContextoSeguro,
  verificarCriptografia,
  verificarInstalavel,
  verificarServidor,
  type Estado,
  type Verificacao,
} from '../diagnostico.js';

/**
 * O diagnóstico do ambiente.
 *
 * Nasceu como a tela inteira da Fase 0 e continua aqui de propósito: quando
 * algo para de funcionar — certificado vencido, permissão negada, servidor
 * fora —, esta tela responde **o quê** e **o que fazer**, sem depender de
 * nenhuma outra parte do app estar funcionando.
 *
 * Fica em Ajustes, e também aparece sozinha para quem ainda não entrou.
 */
export function Diagnostico({ aoVoltar }: { aoVoltar?: () => void }): React.ReactElement {
  const [verificacoes, setVerificacoes] = useState<Verificacao[]>([]);
  const [nomeDaRede, setNomeDaRede] = useState('Nossa Rede');
  const [testandoMidia, setTestandoMidia] = useState(false);
  const [instalavel, setInstalavel] = useState(false);

  useEffect(() => {
    const aoPoderInstalar = (evento: Event): void => {
      evento.preventDefault();
      setInstalavel(true);
    };
    window.addEventListener('beforeinstallprompt', aoPoderInstalar);
    return () => window.removeEventListener('beforeinstallprompt', aoPoderInstalar);
  }, []);

  const rodar = useCallback(async () => {
    setVerificacoes([]);

    const seguro = verificarContextoSeguro();
    setVerificacoes([seguro]);

    const [servidor, banco, saude] = await verificarServidor();
    if (saude) setNomeDaRede(saude.nome);
    setVerificacoes([seguro, servidor, banco]);

    const cripto = await verificarCriptografia();
    setVerificacoes([seguro, servidor, banco, cripto, verificarInstalavel(instalavel)]);
  }, [instalavel]);

  useEffect(() => {
    void rodar();
  }, [rodar]);

  const testarMidia = async (): Promise<void> => {
    setTestandoMidia(true);
    const resultado = await verificarCameraEMicrofone();
    setVerificacoes((anteriores) => [...anteriores.filter((v) => v.id !== 'midia'), resultado]);
    setTestandoMidia(false);
  };

  const problemas = verificacoes.filter((v) => v.estado === 'ruim').length;
  const testouMidia = verificacoes.some((v) => v.id === 'midia');

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col gap-6 px-5 py-8">
      <header>
        <div className="flex items-start justify-between gap-3">
          <p className="text-texto-suave text-sm font-medium">Diagnóstico</p>
          {aoVoltar && (
            <button
              type="button"
              onClick={aoVoltar}
              className="text-texto-suave text-sm underline underline-offset-4"
            >
              Voltar
            </button>
          )}
        </div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{nomeDaRede}</h1>
        <p className="text-texto-suave mt-3 text-[15px] leading-relaxed">
          {problemas === 0
            ? 'Está tudo funcionando por aqui.'
            : `${problemas === 1 ? 'Um item precisa' : `${problemas} itens precisam`} da sua atenção.`}
        </p>
      </header>

      <section className="flex flex-col gap-2.5" aria-label="Diagnóstico">
        {verificacoes.length === 0 && <Esqueleto />}
        {verificacoes.map((verificacao) => (
          <Cartao key={verificacao.id} verificacao={verificacao} />
        ))}
      </section>

      {!testouMidia && (
        <button
          type="button"
          onClick={() => void testarMidia()}
          disabled={testandoMidia}
          className="border-borda bg-superficie active:bg-superficie-alta rounded-xl border px-4 py-3.5 text-[15px] font-medium transition-colors disabled:opacity-50"
        >
          {testandoMidia ? 'Pedindo permissão…' : 'Testar câmera e microfone'}
        </button>
      )}

      <button
        type="button"
        onClick={() => void rodar()}
        className="text-texto-suave text-sm underline underline-offset-4"
      >
        Verificar de novo
      </button>

      <footer className="text-texto-suave mt-auto pt-6 text-xs leading-relaxed">
        Suas conversas são protegidas com criptografia ponta-a-ponta — nem este servidor consegue
        lê-las. Em troca, quem perde a senha e a frase de recuperação perde o histórico, sem
        exceção.
      </footer>
    </main>
  );
}

function Cartao({ verificacao }: { verificacao: Verificacao }): React.ReactElement {
  return (
    <div className="border-borda bg-superficie rounded-xl border p-4">
      <div className="flex items-start gap-3">
        <Marcador estado={verificacao.estado} />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-medium">{verificacao.titulo}</p>
          <p className="text-texto-suave mt-0.5 text-sm leading-relaxed">{verificacao.detalhe}</p>
          {verificacao.ajuda && (
            <p className="bg-superficie-alta text-texto-suave mt-2.5 rounded-lg px-3 py-2 text-[13px] leading-relaxed">
              {verificacao.ajuda}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Marcador({ estado }: { estado: Estado }): React.ReactElement {
  const cor = {
    verificando: 'bg-texto-suave',
    bom: 'bg-bom',
    atencao: 'bg-atencao',
    ruim: 'bg-ruim',
  }[estado];

  const rotulo = {
    verificando: 'verificando',
    bom: 'ok',
    atencao: 'atenção',
    ruim: 'com problema',
  }[estado];

  return (
    <span
      role="img"
      aria-label={rotulo}
      className={`mt-1.5 size-2.5 shrink-0 rounded-full ${cor}`}
    />
  );
}

function Esqueleto(): React.ReactElement {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <div key={i} className="border-borda bg-superficie h-20 animate-pulse rounded-xl border" />
      ))}
    </>
  );
}
