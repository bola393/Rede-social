import { useEffect, useState } from 'react';
import { ProvedorDaSessao, useSessao } from './nucleo/sessao.js';
import { Ajustes } from './telas/Ajustes.js';
import { Cadastro } from './telas/Cadastro.js';
import { Destravar } from './telas/Destravar.js';
import { Diagnostico } from './telas/Diagnostico.js';
import { Entrar } from './telas/Entrar.js';
import { FraseDeRecuperacao } from './telas/FraseDeRecuperacao.js';
import { Tela } from './pecas/basicas.js';

/**
 * Quem entra em qual tela.
 *
 * Quatro estados, nesta ordem — e a ordem importa:
 *
 * 0. **Frase pendente** → mostrar as 24 palavras e cobrar a confirmação.
 * 1. **Sem sessão** → entrar ou criar conta.
 * 2. **Com sessão, mas trancado** → destravar com senha ou PIN.
 * 3. **Destravado** → o app.
 *
 * O passo 0 vem primeiro porque o cadastro já cria a sessão: sem ele, o
 * roteador correria para o app e a frase nunca apareceria.
 *
 * O passo 2 existe porque a sessão sobrevive a fechar a aba, mas a chave
 * privada não: ela mora só na memória. Quem pega seu celular já aberto ainda
 * esbarra na tela de destravar.
 */
export function App() {
  return (
    <ProvedorDaSessao>
      <Roteador />
    </ProvedorDaSessao>
  );
}

function Roteador() {
  const { eu, destravado, carregando, trancar, fraseParaAnotar } = useSessao();
  const [tela, setTela] = useState<'inicio' | 'ajustes' | 'diagnostico'>('inicio');
  const [querCadastrar, setQuerCadastrar] = useState(false);

  useTrancarAoSair(trancar, destravado);

  if (carregando) {
    return (
      <Tela>
        <div className="flex flex-1 items-center justify-center">
          <p className="text-texto-suave text-sm">Abrindo…</p>
        </div>
      </Tela>
    );
  }

  // Antes de tudo: quem acabou de se cadastrar precisa ver as 24 palavras e
  // confirmar que anotou. É a única forma de recuperar o histórico depois, e
  // pular esta tela é o pior desfecho possível.
  if (fraseParaAnotar) return <FraseDeRecuperacao frase={fraseParaAnotar} />;

  if (!eu) {
    if (tela === 'diagnostico') return <Diagnostico aoVoltar={() => setTela('inicio')} />;

    return querCadastrar ? (
      <Cadastro aoQuererEntrar={() => setQuerCadastrar(false)} />
    ) : (
      <Entrar
        aoQuererCadastrar={() => setQuerCadastrar(true)}
        aoQuererDiagnostico={() => setTela('diagnostico')}
      />
    );
  }

  if (!destravado) return <Destravar />;

  if (tela === 'ajustes') return <Ajustes aoVoltar={() => setTela('inicio')} />;
  if (tela === 'diagnostico') return <Diagnostico aoVoltar={() => setTela('ajustes')} />;

  return <Inicio aoAbrirAjustes={() => setTela('ajustes')} />;
}

/**
 * Tranca o app sozinho depois de um tempo em segundo plano.
 *
 * Cinco minutos: tempo de atender o telefone e voltar sem se irritar, curto o
 * bastante para que um celular esquecido na mesa não fique aberto.
 */
function useTrancarAoSair(trancar: () => void, destravado: boolean): void {
  useEffect(() => {
    if (!destravado) return;

    let saiuEm: number | null = null;

    const aoMudarVisibilidade = (): void => {
      if (document.hidden) {
        saiuEm = Date.now();
        return;
      }
      if (saiuEm && Date.now() - saiuEm > 5 * 60_000) trancar();
      saiuEm = null;
    };

    document.addEventListener('visibilitychange', aoMudarVisibilidade);
    return () => document.removeEventListener('visibilitychange', aoMudarVisibilidade);
  }, [trancar, destravado]);
}

/**
 * A tela inicial, por enquanto.
 *
 * O feed e as conversas chegam nas Fases 2 e 4. Até lá ela confirma que o
 * acesso funciona e leva para os ajustes.
 */
function Inicio({ aoAbrirAjustes }: { aoAbrirAjustes: () => void }) {
  const { eu } = useSessao();
  if (!eu) return null;

  return (
    <Tela>
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-texto-suave text-sm font-medium">Fase 1 · acesso e identidade</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Oi, {eu.nome}</h1>
        </div>
        <button
          type="button"
          onClick={aoAbrirAjustes}
          aria-label="Ajustes"
          className="border-borda bg-superficie min-h-11 rounded-xl border px-3 text-sm"
        >
          Ajustes
        </button>
      </header>

      <div className="flex flex-col gap-2.5">
        <Cartao
          titulo="Sua conta está pronta"
          texto={`@${eu.apelido}${eu.papel === 'ADMIN' ? ' · você administra a rede' : ''}`}
        />
        <Cartao
          titulo="Suas chaves estão neste aparelho"
          texto="Foram criadas aqui e não saem daqui. O servidor só conhece a parte pública."
        />
        <Cartao
          titulo="O que vem agora"
          texto="Fase 2: as conversas, com criptografia ponta-a-ponta de verdade."
        />
      </div>

      {eu.papel === 'ADMIN' && (
        <div className="border-destaque/30 bg-destaque/10 rounded-xl border p-4">
          <p className="text-[15px] font-medium">Convide sua namorada</p>
          <p className="text-texto-suave mt-1 text-[13px] leading-relaxed">
            Vá em Ajustes → Convites, gere um código e mande para ela junto com o endereço da rede.
          </p>
        </div>
      )}

      <p className="text-texto-suave mt-auto text-[13px] leading-relaxed">
        Guardou a frase de 24 palavras num papel? É a única forma de recuperar suas conversas se
        este aparelho se perder.
      </p>
    </Tela>
  );
}

function Cartao({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="border-borda bg-superficie rounded-xl border p-4">
      <p className="text-[15px] font-medium">{titulo}</p>
      <p className="text-texto-suave mt-0.5 text-sm leading-relaxed">{texto}</p>
    </div>
  );
}
