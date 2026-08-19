import { useEffect, useState } from 'react';
import { ErroDaApi } from '../nucleo/api.js';
import { useSessao } from '../nucleo/sessao.js';
import { medirForca, prepararMedidor, type Forca } from '../nucleo/forca-da-senha.js';
import { Aviso, Botao, Cabecalho, Campo, Tela } from '../pecas/basicas.js';

/**
 * Criar conta.
 *
 * Duas coisas acontecem aqui que não acontecem num cadastro comum:
 *
 * 1. **O par de chaves nasce neste aparelho**, antes de qualquer coisa ir para
 *    a rede. O servidor recebe só a parte pública.
 * 2. **A frase de recuperação é mostrada uma única vez**, e a tela não deixa
 *    seguir sem confirmar que foi anotada. É chato de propósito: quem pular
 *    esse passo perde o histórico no dia em que trocar de celular.
 */
/** Os campos que esta tela sabe destacar sozinha. */
const CAMPOS_DESENHADOS = ['convite', 'apelido', 'email', 'senha'];

export function Cadastro({ aoQuererEntrar }: { aoQuererEntrar: () => void }) {
  const { cadastrar } = useSessao();

  const [convite, setConvite] = useState('');
  const [nome, setNome] = useState('');
  const [apelido, setApelido] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [forca, setForca] = useState<Forca | null>(null);
  const [erro, setErro] = useState<{ mensagem: string; campo?: string } | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(prepararMedidor, []);

  // Medir a cada tecla travaria a digitação — o zxcvbn não é barato. Esperar a
  // pessoa parar por um instante dá o mesmo resultado sem o engasgo.
  useEffect(() => {
    if (!senha) {
      setForca(null);
      return;
    }
    const relogio = setTimeout(() => void medirForca(senha).then(setForca), 250);
    return () => clearTimeout(relogio);
  }, [senha]);

  // Sugere um apelido a partir do nome, mas para de sugerir assim que a pessoa
  // digitar o dela.
  const [apelidoTocado, setApelidoTocado] = useState(false);
  useEffect(() => {
    if (apelidoTocado) return;
    setApelido(
      nome
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .slice(0, 24),
    );
  }, [nome, apelidoTocado]);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);

    if (senha.length < 12) {
      setErro({ mensagem: 'A senha precisa de pelo menos 12 caracteres.', campo: 'senha' });
      return;
    }
    if (forca && !forca.aceitavel) {
      setErro({
        mensagem:
          forca.conselho ??
          `Essa senha cairia em ${forca.tempoParaQuebrar}. Tente uma frase com três ou quatro palavras.`,
        campo: 'senha',
      });
      return;
    }

    setEnviando(true);
    try {
      await cadastrar({
        convite: convite.trim(),
        email: email.trim(),
        apelido: apelido.trim(),
        nome: nome.trim(),
        senha,
        nomeDoAparelho: nomeDesteAparelho(),
      });
      // Daqui em diante quem manda é o roteador: ele vê a frase pendente na
      // sessão e mostra a tela dela.
    } catch (e) {
      setErro(
        e instanceof ErroDaApi
          ? { mensagem: e.message, ...(e.campo ? { campo: e.campo } : {}) }
          : { mensagem: 'Não consegui falar com o servidor. Ele está ligado?' },
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Tela>
      <Cabecalho
        titulo="Criar sua conta"
        descricao="Esta rede é fechada. Você precisa do código de convite de quem te chamou."
      />

      <form onSubmit={(e) => void enviar(e)} className="flex flex-col gap-4">
        <Campo
          rotulo="Código do convite"
          value={convite}
          onChange={(e) => setConvite(e.target.value.toUpperCase())}
          placeholder="ABCD-EFGH-JKMN"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          required
          erro={erro?.campo === 'convite' ? erro.mensagem : undefined}
        />

        <Campo
          rotulo="Seu nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ana"
          autoComplete="name"
          required
        />

        <Campo
          rotulo="Apelido"
          value={apelido}
          onChange={(e) => {
            setApelidoTocado(true);
            setApelido(e.target.value.toLowerCase());
          }}
          placeholder="ana"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          dica="É como as pessoas vão te encontrar. Só letras sem acento, números e _"
          erro={erro?.campo === 'apelido' ? erro.mensagem : undefined}
        />

        <Campo
          rotulo="E-mail"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ana@exemplo.com"
          autoComplete="email"
          autoCapitalize="none"
          required
          dica="Só para entrar. Não é mostrado para ninguém."
          erro={erro?.campo === 'email' ? erro.mensagem : undefined}
        />

        <div className="flex flex-col gap-1.5">
          <Campo
            rotulo="Senha"
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoComplete="new-password"
            required
            dica={
              forca ? undefined : 'Uma frase curta funciona melhor que letras e símbolos soltos.'
            }
            erro={erro?.campo === 'senha' ? erro.mensagem : undefined}
          />
          {forca && <MedidorDeForca forca={forca} />}
        </div>

        {/*
          Mostra o erro tanto quando ele não tem campo quanto quando o campo é
          um que esta tela não desenha. Sem o segundo caso, um descompasso
          entre servidor e interface some da tela: o botão simplesmente não
          faz nada, e quem está usando não tem como saber por quê.
        */}
        {erro && !CAMPOS_DESENHADOS.includes(erro.campo ?? '') && (
          <Aviso tom="ruim">{erro.mensagem}</Aviso>
        )}

        <Botao type="submit" carregando={enviando}>
          Criar conta
        </Botao>
      </form>

      <button
        type="button"
        onClick={aoQuererEntrar}
        className="text-texto-suave text-sm underline underline-offset-4"
      >
        Já tenho conta
      </button>
    </Tela>
  );
}

function MedidorDeForca({ forca }: { forca: Forca }) {
  // As barras seguem o `aceitavel`, não a nota: uma senha que cai em três
  // horas não pode aparecer verde só porque tirou 3 de 4.
  const cores = forca.aceitavel ? 'bg-bom' : forca.nota >= 3 ? 'bg-atencao' : 'bg-ruim';

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="flex gap-1"
        role="img"
        aria-label={`Força da senha: ${forca.aceitavel ? forca.rotulo : 'fácil de quebrar'}`}
      >
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`h-1 flex-1 rounded-full ${i < forca.nota ? cores : 'bg-borda'}`}
          />
        ))}
      </div>
      <p className="text-texto-suave text-[13px]">
        {forca.aceitavel ? forca.rotulo : 'Fácil de quebrar'}
        {forca.tempoParaQuebrar && (
          <span className="text-texto-suave/70">
            {' '}
            · levaria {forca.tempoParaQuebrar} para quebrar
          </span>
        )}
      </p>
      {!forca.aceitavel && (
        <p className="text-atencao text-[13px]">
          {forca.conselho ?? 'Uma frase com três ou quatro palavras resolve.'}
        </p>
      )}
    </div>
  );
}

/** Um nome que a pessoa reconheça na lista de aparelhos. */
export function nomeDesteAparelho(): string {
  const ua = navigator.userAgent;
  const sistema = /Android/i.test(ua)
    ? 'Android'
    : /iPhone|iPad/i.test(ua)
      ? 'iPhone'
      : /Windows/i.test(ua)
        ? 'Windows'
        : /Mac/i.test(ua)
          ? 'Mac'
          : /Linux/i.test(ua)
            ? 'Linux'
            : 'Aparelho';

  const navegador = /Edg\//.test(ua)
    ? 'Edge'
    : /Chrome\//.test(ua)
      ? 'Chrome'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Safari\//.test(ua)
          ? 'Safari'
          : 'navegador';

  return `${navegador} no ${sistema}`;
}
