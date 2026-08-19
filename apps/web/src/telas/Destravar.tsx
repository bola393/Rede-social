import { useEffect, useRef, useState } from 'react';
import { destravarComPin, temPin, ERROS_ATE_PEDIR_SENHA } from '../nucleo/cofre.js';
import { useSessao } from '../nucleo/sessao.js';
import { Aviso, Botao, Cabecalho, Campo, Tela } from '../pecas/basicas.js';

/**
 * A tela que aparece quando você está logado mas as chaves estão trancadas.
 *
 * Acontece toda vez que o app é reaberto: a sessão volta pelo cookie, mas a
 * chave privada mora só na memória, e memória some. Isso é a proteção
 * funcionando — quem pegar seu celular destravado ainda esbarra aqui.
 */
export function Destravar() {
  const { destravar, aoDestravar, sair, eu } = useSessao();

  const [usarPin, setUsarPin] = useState(false);
  const [pin, setPin] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [tentando, setTentando] = useState(false);
  const campoDoPin = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void temPin().then((tem) => {
      setUsarPin(tem);
      if (tem) setTimeout(() => campoDoPin.current?.focus(), 50);
    });
  }, []);

  async function tentarPin(valor: string) {
    setTentando(true);
    setErro(null);

    try {
      const r = await destravarComPin(valor);

      if (r.identidade) {
        aoDestravar(r.identidade);
        return;
      }

      setPin('');

      if (r.pinDescartado) {
        setUsarPin(false);
        setErro('Muitas tentativas. Por segurança, agora só a senha destrava.');
        return;
      }

      setErro(
        `PIN incorreto. ${r.tentativasQueRestam} ${
          r.tentativasQueRestam === 1 ? 'tentativa restante' : 'tentativas restantes'
        }.`,
      );
    } finally {
      setTentando(false);
    }
  }

  async function tentarSenha(evento: React.FormEvent) {
    evento.preventDefault();
    setTentando(true);
    setErro(null);

    try {
      if (!(await destravar(senha))) {
        setSenha('');
        setErro('Senha incorreta.');
      }
    } finally {
      setTentando(false);
    }
  }

  return (
    <Tela>
      <Cabecalho
        titulo={eu ? `Oi, ${eu.nome.split(' ')[0]}` : 'Destravar'}
        descricao={
          usarPin
            ? 'Digite seu PIN para abrir suas conversas.'
            : 'Digite sua senha para abrir suas conversas.'
        }
      />

      {usarPin ? (
        <div className="flex flex-col gap-4">
          <input
            ref={campoDoPin}
            // inputMode numérico faz o Android abrir o teclado de números.
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            maxLength={6}
            value={pin}
            onChange={(e) => {
              const so = e.target.value.replace(/\D/g, '').slice(0, 6);
              setPin(so);
              // Seis dígitos: tenta sozinho, sem precisar de botão.
              if (so.length === 6) void tentarPin(so);
            }}
            disabled={tentando}
            aria-label="PIN de 6 dígitos"
            className="border-borda bg-superficie focus:border-destaque min-h-16 rounded-xl border text-center text-3xl tracking-[0.5em] outline-none disabled:opacity-50"
          />

          {erro && <Aviso tom="ruim">{erro}</Aviso>}

          <button
            type="button"
            onClick={() => {
              setUsarPin(false);
              setErro(null);
            }}
            className="text-texto-suave text-sm underline underline-offset-4"
          >
            Usar a senha
          </button>

          <p className="text-texto-suave text-[13px] leading-relaxed">
            O PIN protege contra quem pega seu celular por um minuto. Depois de{' '}
            {ERROS_ATE_PEDIR_SENHA} erros ele é descartado e volta a valer só a senha.
          </p>
        </div>
      ) : (
        <form onSubmit={(e) => void tentarSenha(e)} className="flex flex-col gap-4">
          <Campo
            rotulo="Senha"
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoComplete="current-password"
            autoFocus
            required
          />

          {erro && <Aviso tom="ruim">{erro}</Aviso>}

          <Botao type="submit" carregando={tentando}>
            Destravar
          </Botao>
        </form>
      )}

      <button
        type="button"
        onClick={() => void sair()}
        className="text-texto-suave mt-auto text-sm underline underline-offset-4"
      >
        Sair desta conta
      </button>
    </Tela>
  );
}
