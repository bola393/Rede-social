import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  chaveMestraDaFrase,
  gerarFraseDeRecuperacao,
  inicializar,
  partePublica,
  type Identidade,
} from '@rede/crypto';
import { chamar, guardarAcesso, retomarSessao } from './api.js';
import {
  criarIdentidade,
  destravarComSenha,
  esquecerTudo,
  identidadeAtual,
  temIdentidade,
  trancar as trancarCofre,
} from './cofre.js';

/**
 * Quem está usando o app, e se as chaves dele estão destravadas.
 *
 * São **dois estados diferentes**, e confundi-los seria um bug feio:
 *
 * - **sessão** é o servidor reconhecer você (o token). Sobrevive a fechar a aba.
 * - **destravado** é a chave privada estar aberta na memória deste aparelho.
 *   Some ao recarregar a página, e volta com a senha ou o PIN.
 *
 * Dá para estar logado e trancado ao mesmo tempo: é exatamente o que acontece
 * ao voltar para o app depois de um tempo.
 */

export interface Eu {
  id: string;
  email: string;
  apelido: string;
  nome: string;
  avatar?: string | null;
  papel: 'ADMIN' | 'MEMBRO';
  aparelhoId: string;
}

interface Cadastro {
  convite: string;
  email: string;
  apelido: string;
  nome: string;
  senha: string;
  nomeDoAparelho: string;
}

interface Contexto {
  eu: Eu | null;
  destravado: boolean;
  carregando: boolean;
  /**
   * Preenchida logo após o cadastro, e limpa quando a pessoa confirma que
   * anotou. Enquanto tiver valor, o roteador não deixa entrar no app.
   *
   * Mora aqui, e não dentro da tela de cadastro, porque o cadastro também
   * atualiza `eu` — e o roteador reagia a isso indo direto para o app, pulando
   * a frase. Como ela é a única forma de recuperar o histórico, pular era o
   * pior desfecho possível.
   */
  fraseParaAnotar: string | null;
  confirmarQueAnotou: () => void;
  cadastrar: (dados: Cadastro) => Promise<void>;
  entrar: (email: string, senha: string, nomeDoAparelho: string) => Promise<void>;
  destravar: (senha: string) => Promise<boolean>;
  aoDestravar: (identidade: Identidade) => void;
  sair: () => Promise<void>;
  trancar: () => void;
}

const ContextoDaSessao = createContext<Contexto | null>(null);

export function ProvedorDaSessao({ children }: { children: React.ReactNode }) {
  const [eu, setEu] = useState<Eu | null>(null);
  const [destravado, setDestravado] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [fraseParaAnotar, setFraseParaAnotar] = useState<string | null>(null);

  // Ao abrir o app: o cookie de renovação pode devolver a sessão. As chaves,
  // porém, continuam trancadas — é a senha ou o PIN que as abre.
  useEffect(() => {
    void (async () => {
      try {
        if (await retomarSessao()) {
          setEu(await chamar<Eu>('/api/acesso/eu'));
          setDestravado(identidadeAtual() !== null);
        }
      } catch {
        // Sem sessão. A tela de entrada aparece, e está tudo certo.
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  const cadastrar = useCallback(async (dados: Cadastro) => {
    await inicializar();

    // As chaves nascem AQUI, no aparelho, antes de qualquer coisa ir para a
    // rede. O servidor recebe só a parte pública.
    const identidade = await criarIdentidade(dados.senha);
    const frase = gerarFraseDeRecuperacao();

    const resposta = await chamar<{ acesso: string; eu: Eu }>('/api/acesso/cadastrar', {
      metodo: 'POST',
      corpo: {
        ...dados,
        identidade: partePublica(identidade),
        chaveDeRecuperacao: chaveMestraDaFrase(frase).publica,
      },
    });

    // A frase entra no estado ANTES de `eu`: assim, quando o roteador reagir
    // ao login, a tela da frase já é a que está marcada para aparecer.
    setFraseParaAnotar(frase);
    guardarAcesso(resposta.acesso);
    setEu(resposta.eu);
    setDestravado(true);
  }, []);

  const confirmarQueAnotou = useCallback(() => setFraseParaAnotar(null), []);

  const entrar = useCallback(async (email: string, senha: string, nomeDoAparelho: string) => {
    const resposta = await chamar<{ acesso: string; eu: Eu }>('/api/acesso/entrar', {
      metodo: 'POST',
      corpo: { email, senha, nomeDoAparelho },
    });

    guardarAcesso(resposta.acesso);
    setEu(resposta.eu);

    // Este aparelho já tem chaves? Então é só destravá-las com a mesma senha.
    if (await temIdentidade()) {
      setDestravado((await destravarComSenha(senha)) !== null);
      return;
    }

    // Aparelho novo: gera chaves próprias e registra as públicas.
    const identidade = await criarIdentidade(senha);
    await chamar('/api/acesso/aparelho/chaves', {
      metodo: 'POST',
      corpo: { ...partePublica(identidade), nome: nomeDoAparelho },
    });
    setDestravado(true);
  }, []);

  const destravar = useCallback(async (senha: string) => {
    const identidade = await destravarComSenha(senha);
    setDestravado(identidade !== null);
    return identidade !== null;
  }, []);

  const aoDestravar = useCallback((_identidade: Identidade) => {
    setDestravado(true);
  }, []);

  const sair = useCallback(async () => {
    try {
      await chamar('/api/acesso/sair', { metodo: 'POST' });
    } finally {
      guardarAcesso(null);
      // Apaga as chaves deste aparelho. Sair num computador emprestado tem que
      // deixar de fato nada para trás.
      await esquecerTudo();
      setEu(null);
      setDestravado(false);
      setFraseParaAnotar(null);
    }
  }, []);

  const trancar = useCallback(() => {
    trancarCofre();
    setDestravado(false);
  }, []);

  const valor = useMemo(
    () => ({
      eu,
      destravado,
      carregando,
      fraseParaAnotar,
      confirmarQueAnotou,
      cadastrar,
      entrar,
      destravar,
      aoDestravar,
      sair,
      trancar,
    }),
    [
      eu,
      destravado,
      carregando,
      fraseParaAnotar,
      confirmarQueAnotou,
      cadastrar,
      entrar,
      destravar,
      aoDestravar,
      sair,
      trancar,
    ],
  );

  return <ContextoDaSessao.Provider value={valor}>{children}</ContextoDaSessao.Provider>;
}

export function useSessao(): Contexto {
  const contexto = useContext(ContextoDaSessao);
  if (!contexto) throw new Error('useSessao precisa estar dentro de <ProvedorDaSessao>.');
  return contexto;
}
