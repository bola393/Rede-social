import { useState } from 'react';
import { ErroDaApi } from '../nucleo/api.js';
import { useSessao } from '../nucleo/sessao.js';
import { Aviso, Botao, Cabecalho, Campo, Tela } from '../pecas/basicas.js';
import { nomeDesteAparelho } from './Cadastro.js';

export function Entrar({
  aoQuererCadastrar,
  aoQuererDiagnostico,
}: {
  aoQuererCadastrar: () => void;
  aoQuererDiagnostico: () => void;
}) {
  const { entrar } = useSessao();

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);
    setEnviando(true);

    try {
      await entrar(email.trim(), senha, nomeDesteAparelho());
    } catch (e) {
      setErro(
        e instanceof ErroDaApi
          ? e.message
          : 'Não consegui falar com o servidor. Confira se o PC está ligado e o Tailscale conectado.',
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Tela>
      <Cabecalho titulo="Entrar" />

      <form onSubmit={(e) => void enviar(e)} className="flex flex-col gap-4">
        <Campo
          rotulo="E-mail"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          autoCapitalize="none"
          required
        />

        <Campo
          rotulo="Senha"
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          autoComplete="current-password"
          required
        />

        {erro && <Aviso tom="ruim">{erro}</Aviso>}

        <Botao type="submit" carregando={enviando}>
          Entrar
        </Botao>
      </form>

      <button
        type="button"
        onClick={aoQuererCadastrar}
        className="text-texto-suave text-sm underline underline-offset-4"
      >
        Tenho um convite e quero criar minha conta
      </button>

      {/*
        O diagnóstico fica alcançável SEM login de propósito. É justamente
        quando não se consegue entrar — servidor fora, certificado vencido,
        Tailscale desconectado — que ele é necessário. Escondê-lo atrás do
        login seria trancar a chave dentro do carro.
      */}
      <button
        type="button"
        onClick={aoQuererDiagnostico}
        className="text-texto-suave text-sm underline underline-offset-4"
      >
        Algo não está funcionando?
      </button>

      <p className="text-texto-suave mt-auto text-[13px] leading-relaxed">
        Esqueceu a senha? Como as conversas são criptografadas ponta-a-ponta, ninguém — nem o
        servidor — consegue recuperá-las por você. Se tiver a frase de 24 palavras, dá para voltar
        por ela.
      </p>
    </Tela>
  );
}
