import { useCallback, useEffect, useState } from 'react';
import { chamar, ErroDaApi } from '../nucleo/api.js';
import { esquecerPin, identidadeAtual, protegerComPin, temPin } from '../nucleo/cofre.js';
import { useSessao } from '../nucleo/sessao.js';
import { Aviso, Botao, Cabecalho, Tela } from '../pecas/basicas.js';

interface Convite {
  id: string;
  codigo: string;
  usosRestantes: number;
  expiraEm: string;
  observacao: string | null;
  usadoPor: { apelido: string; nome: string }[];
  vale: boolean;
}

interface Membro {
  id: string;
  apelido: string;
  nome: string;
  papel: 'ADMIN' | 'MEMBRO';
  criadoEm: string;
  vistoPorUltimoEm: string | null;
  ativo: boolean;
}

interface Aparelho {
  id: string;
  nome: string;
  criadoEm: string;
  usadoEm: string | null;
  revogado: boolean;
  esteAqui: boolean;
  sessaoAtiva: boolean;
}

/**
 * Ajustes: convites, membros, aparelhos e o PIN.
 *
 * Uma escolha que vale explicar: **revogar aparelho não exige ser
 * administrador**. Quem perdeu o celular precisa cortar o acesso agora, não
 * quando conseguir falar com outra pessoa. Cada um cuida dos seus.
 */
export function Ajustes({ aoVoltar }: { aoVoltar: () => void }) {
  const { eu, sair, trancar } = useSessao();
  const [aba, setAba] = useState<'aparelhos' | 'convites' | 'membros'>('aparelhos');

  if (!eu) return null;

  const abas = [
    { id: 'aparelhos' as const, rotulo: 'Aparelhos' },
    ...(eu.papel === 'ADMIN' ? [{ id: 'convites' as const, rotulo: 'Convites' }] : []),
    { id: 'membros' as const, rotulo: 'Membros' },
  ];

  return (
    <Tela>
      <div className="flex items-center justify-between">
        <Cabecalho titulo="Ajustes" />
        <button
          type="button"
          onClick={aoVoltar}
          className="text-texto-suave text-sm underline underline-offset-4"
        >
          Voltar
        </button>
      </div>

      <div className="border-borda bg-superficie flex gap-1 rounded-xl border p-1" role="tablist">
        {abas.map((a) => (
          <button
            key={a.id}
            type="button"
            role="tab"
            aria-selected={aba === a.id}
            onClick={() => setAba(a.id)}
            className={`min-h-10 flex-1 rounded-lg text-sm font-medium transition-colors ${
              aba === a.id ? 'bg-superficie-alta' : 'text-texto-suave'
            }`}
          >
            {a.rotulo}
          </button>
        ))}
      </div>

      {aba === 'aparelhos' && <Aparelhos />}
      {aba === 'convites' && <Convites />}
      {aba === 'membros' && <Membros souAdmin={eu.papel === 'ADMIN'} meuId={eu.id} />}

      <div className="mt-auto flex flex-col gap-3 pt-6">
        <Botao variante="secundario" onClick={trancar}>
          Trancar o app
        </Botao>
        <Botao variante="perigo" onClick={() => void sair()}>
          Sair desta conta
        </Botao>
        <p className="text-texto-suave text-[13px] leading-relaxed">
          Sair apaga as chaves guardadas neste aparelho. Suas conversas continuam no servidor,
          cifradas — você as reabre ao entrar de novo.
        </p>
      </div>
    </Tela>
  );
}

// ─── Aparelhos ─────────────────────────────────────────────────────────────

function Aparelhos() {
  const [aparelhos, setAparelhos] = useState<Aparelho[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      setAparelhos(await chamar<Aparelho[]>('/api/aparelhos'));
    } catch (e) {
      setErro(e instanceof ErroDaApi ? e.message : 'Não consegui carregar seus aparelhos.');
    }
  }, []);

  useEffect(() => void carregar(), [carregar]);

  async function revogar(aparelho: Aparelho) {
    const confirmado = window.confirm(
      aparelho.esteAqui
        ? 'Este é o aparelho que você está usando agora. Revogá-lo vai te desconectar. Continuar?'
        : `Revogar "${aparelho.nome}"? Ele será desconectado imediatamente.`,
    );
    if (!confirmado) return;

    await chamar(`/api/aparelhos/${aparelho.id}/revogar`, { metodo: 'POST', corpo: {} });
    if (aparelho.esteAqui) window.location.reload();
    else void carregar();
  }

  return (
    <section className="flex flex-col gap-4">
      <ProtecaoPorPin />

      {erro && <Aviso tom="ruim">{erro}</Aviso>}
      {!aparelhos && <p className="text-texto-suave text-sm">Carregando…</p>}

      <div className="flex flex-col gap-2">
        {aparelhos?.map((a) => (
          <div key={a.id} className="border-borda bg-superficie rounded-xl border p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[15px] font-medium">
                  {a.nome}
                  {a.esteAqui && <span className="text-bom ml-2 text-xs">este aqui</span>}
                </p>
                <p className="text-texto-suave mt-0.5 text-[13px]">
                  {a.revogado
                    ? 'Revogado'
                    : a.sessaoAtiva
                      ? `Ativo · desde ${new Date(a.criadoEm).toLocaleDateString('pt-BR')}`
                      : 'Sem sessão ativa'}
                </p>
              </div>
              {!a.revogado && (
                <button
                  type="button"
                  onClick={() => void revogar(a)}
                  className="text-ruim shrink-0 text-[13px] underline underline-offset-4"
                >
                  Revogar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="text-texto-suave text-[13px] leading-relaxed">
        Perdeu um aparelho? Revogue-o aqui. Ele é desconectado na hora e para de receber as chaves
        das conversas — o que ele já tinha baixado antes, porém, continua com ele.
      </p>
    </section>
  );
}

// ─── PIN ───────────────────────────────────────────────────────────────────

function ProtecaoPorPin() {
  const [ativo, setAtivo] = useState<boolean | null>(null);
  const [definindo, setDefinindo] = useState(false);
  const [pin, setPin] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => void temPin().then(setAtivo), []);

  async function salvar() {
    setErro(null);

    if (pin.length !== 6) return setErro('O PIN precisa ter 6 dígitos.');
    if (pin !== confirmacao) return setErro('Os dois PINs não são iguais.');
    // Um PIN de dígitos repetidos ou em sequência é a primeira coisa que
    // alguém tenta. Melhor recusar agora do que dar falsa sensação depois.
    if (/^(\d)\1{5}$/.test(pin))
      return setErro('Escolha um PIN menos óbvio que seis dígitos iguais.');
    if ('0123456789'.includes(pin) || '9876543210'.includes(pin)) {
      return setErro('Escolha um PIN que não seja uma sequência.');
    }

    const identidade = identidadeAtual();
    if (!identidade) return setErro('Destrave o app antes de definir o PIN.');

    await protegerComPin(identidade, pin);
    setAtivo(true);
    setDefinindo(false);
    setPin('');
    setConfirmacao('');
  }

  if (ativo === null) return null;

  if (!definindo) {
    return (
      <div className="border-borda bg-superficie rounded-xl border p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[15px] font-medium">PIN de acesso</p>
            <p className="text-texto-suave mt-0.5 text-[13px]">
              {ativo ? 'Ativo — destrava sem digitar a senha inteira.' : 'Desligado.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (ativo) {
                void esquecerPin().then(() => setAtivo(false));
              } else {
                setDefinindo(true);
              }
            }}
            className="text-destaque shrink-0 text-[13px] underline underline-offset-4"
          >
            {ativo ? 'Desligar' : 'Definir'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="border-borda bg-superficie flex flex-col gap-3 rounded-xl border p-4">
      <p className="text-[15px] font-medium">Escolha um PIN de 6 dígitos</p>

      {[
        { valor: pin, mudar: setPin, rotulo: 'PIN' },
        { valor: confirmacao, mudar: setConfirmacao, rotulo: 'Repita o PIN' },
      ].map((campo) => (
        <label key={campo.rotulo} className="flex flex-col gap-1.5">
          <span className="text-texto-suave text-[13px]">{campo.rotulo}</span>
          <input
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            autoComplete="off"
            value={campo.valor}
            onChange={(e) => campo.mudar(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="border-borda bg-superficie-alta focus:border-destaque min-h-12 rounded-xl border px-3.5 text-center text-xl tracking-[0.4em] outline-none"
          />
        </label>
      ))}

      {erro && <Aviso tom="ruim">{erro}</Aviso>}

      <p className="text-texto-suave text-[13px] leading-relaxed">
        Seis dígitos protegem contra quem pega seu celular por um minuto — não contra quem o leva
        embora. Para isso vale a senha.
      </p>

      <div className="flex gap-2">
        <Botao variante="secundario" onClick={() => setDefinindo(false)}>
          Cancelar
        </Botao>
        <Botao onClick={() => void salvar()}>Salvar</Botao>
      </div>
    </div>
  );
}

// ─── Convites ──────────────────────────────────────────────────────────────

function Convites() {
  const [convites, setConvites] = useState<Convite[] | null>(null);
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      setConvites(await chamar<Convite[]>('/api/convites'));
    } catch (e) {
      setErro(e instanceof ErroDaApi ? e.message : 'Não consegui carregar os convites.');
    }
  }, []);

  useEffect(() => void carregar(), [carregar]);

  async function criar() {
    setCriando(true);
    setErro(null);
    try {
      await chamar('/api/convites', {
        metodo: 'POST',
        corpo: { usos: 1, validadeEmDias: 7 },
      });
      await carregar();
    } catch (e) {
      setErro(e instanceof ErroDaApi ? e.message : 'Não consegui criar o convite.');
    } finally {
      setCriando(false);
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <Botao onClick={() => void criar()} carregando={criando}>
        Gerar convite
      </Botao>

      {erro && <Aviso tom="ruim">{erro}</Aviso>}

      <div className="flex flex-col gap-2">
        {convites?.map((c) => (
          <div key={c.id} className="border-borda bg-superficie rounded-xl border p-4">
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(c.codigo).then(() => setCopiado(c.id));
              }}
              className="w-full text-left"
            >
              <p
                className={`font-mono text-lg tracking-wider ${c.vale ? '' : 'text-texto-suave line-through'}`}
              >
                {c.codigo}
              </p>
            </button>
            <p className="text-texto-suave mt-1 text-[13px]">
              {copiado === c.id
                ? 'Copiado!'
                : c.usadoPor.length > 0
                  ? `Usado por ${c.usadoPor.map((u) => u.nome).join(', ')}`
                  : c.vale
                    ? `${c.usosRestantes} uso(s) · vence em ${new Date(c.expiraEm).toLocaleDateString('pt-BR')}`
                    : 'Não vale mais'}
            </p>
          </div>
        ))}
        {convites?.length === 0 && (
          <p className="text-texto-suave text-sm">Nenhum convite ainda.</p>
        )}
      </div>

      <p className="text-texto-suave text-[13px] leading-relaxed">
        Mande o código junto com o endereço da rede. Sem um código válido, ninguém cria conta — é
        isso que mantém a rede fechada.
      </p>
    </section>
  );
}

// ─── Membros ───────────────────────────────────────────────────────────────

function Membros({ souAdmin, meuId }: { souAdmin: boolean; meuId: string }) {
  const [membros, setMembros] = useState<Membro[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      setMembros(await chamar<Membro[]>('/api/membros'));
    } catch (e) {
      setErro(e instanceof ErroDaApi ? e.message : 'Não consegui carregar os membros.');
    }
  }, []);

  useEffect(() => void carregar(), [carregar]);

  async function alternar(membro: Membro) {
    const acao = membro.ativo ? 'desativar' : 'reativar';
    if (membro.ativo && !window.confirm(`Desativar ${membro.nome}? Ele perde o acesso na hora.`)) {
      return;
    }

    try {
      await chamar(`/api/membros/${membro.id}/${acao}`, { metodo: 'POST' });
      await carregar();
    } catch (e) {
      setErro(e instanceof ErroDaApi ? e.message : 'Não consegui fazer isso.');
    }
  }

  return (
    <section className="flex flex-col gap-4">
      {erro && <Aviso tom="ruim">{erro}</Aviso>}

      <div className="flex flex-col gap-2">
        {membros?.map((m) => (
          <div key={m.id} className="border-borda bg-superficie rounded-xl border p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[15px] font-medium">
                  {m.nome}
                  {m.papel === 'ADMIN' && (
                    <span className="text-destaque ml-2 text-xs">administra</span>
                  )}
                </p>
                <p className="text-texto-suave mt-0.5 text-[13px]">
                  @{m.apelido}
                  {!m.ativo && ' · desativado'}
                </p>
              </div>
              {souAdmin && m.id !== meuId && (
                <button
                  type="button"
                  onClick={() => void alternar(m)}
                  className={`shrink-0 text-[13px] underline underline-offset-4 ${
                    m.ativo ? 'text-ruim' : 'text-bom'
                  }`}
                >
                  {m.ativo ? 'Desativar' : 'Reativar'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
