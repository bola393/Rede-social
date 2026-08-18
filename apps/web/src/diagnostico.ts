import { cifrarMensagem, decifrarMensagem, gerarChaveDeConversa, inicializar } from '@rede/crypto';
import { saudeSchema, type Saude } from '@rede/shared';

/**
 * As verificações da tela inicial.
 *
 * Na Fase 0 esta é a rede inteira, e o objetivo dela é um só: você abre no
 * celular e descobre, em cinco segundos, se o ambiente está de pé — antes de
 * existir qualquer funcionalidade para confundir o diagnóstico.
 *
 * Cada verificação que falha explica **o que fazer**, não só que falhou.
 */

export type Estado = 'verificando' | 'bom' | 'atencao' | 'ruim';

export interface Verificacao {
  id: string;
  titulo: string;
  estado: Estado;
  detalhe: string;
  /** O que fazer quando não está bom. */
  ajuda?: string;
}

/** Pergunta ao servidor se ele e o banco estão vivos. */
export async function verificarServidor(): Promise<[Verificacao, Verificacao, Saude | null]> {
  try {
    const resposta = await fetch('/api/saude', { cache: 'no-store' });
    const saude = saudeSchema.parse(await resposta.json());

    return [
      {
        id: 'servidor',
        titulo: 'Servidor',
        estado: 'bom',
        detalhe: `${saude.nome} · no ar há ${formatarDuracao(saude.noArHa)}`,
      },
      saude.banco === 'ok'
        ? { id: 'banco', titulo: 'Banco de dados', estado: 'bom', detalhe: 'Respondendo.' }
        : {
            id: 'banco',
            titulo: 'Banco de dados',
            estado: 'ruim',
            detalhe: 'O servidor está de pé, mas o banco não responde.',
            ajuda: 'No PC, rode: docker compose -f infra/docker-compose.yml restart postgres',
          },
      saude,
    ];
  } catch {
    return [
      {
        id: 'servidor',
        titulo: 'Servidor',
        estado: 'ruim',
        detalhe: 'Não consegui falar com o servidor.',
        ajuda:
          'Confira se o PC está ligado e se você clicou em INICIAR.bat. Se estiver fora de casa, veja se o Tailscale está conectado no celular.',
      },
      { id: 'banco', titulo: 'Banco de dados', estado: 'ruim', detalhe: 'Não deu para verificar.' },
      null,
    ];
  }
}

/**
 * Confere se a página está num "contexto seguro".
 *
 * Esta é a verificação mais importante da tela, e a que mais confunde quem está
 * começando. Sem HTTPS, o Android **bloqueia câmera e microfone** — então
 * áudio, foto e chamada de vídeo simplesmente não abrem, sem erro nenhum que
 * explique o motivo.
 *
 * `localhost` é a exceção: o navegador confia nele mesmo sem certificado.
 */
export function verificarContextoSeguro(): Verificacao {
  if (window.isSecureContext) {
    const local = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    return {
      id: 'seguro',
      titulo: 'Conexão segura',
      estado: 'bom',
      detalhe: local ? 'localhost — vale como seguro.' : `HTTPS em ${location.hostname}`,
    };
  }

  return {
    id: 'seguro',
    titulo: 'Conexão segura',
    estado: 'ruim',
    detalhe: `Você está em ${location.protocol}//${location.hostname} — sem HTTPS.`,
    ajuda:
      'Áudio, fotos e chamadas não vão funcionar assim. Acesse pelo endereço do Tailscale (algo como https://seu-pc.ts.net), não pelo IP da rede local.',
  };
}

/**
 * Roda uma cifragem de verdade no navegador.
 *
 * Não é enfeite: o libsodium é WebAssembly, e a política de segurança da página
 * precisa permitir `wasm-unsafe-eval` para ele carregar. Se essa configuração
 * estiver errada, é aqui que se descobre — e não lá na frente, quando alguém
 * tentar mandar a primeira mensagem.
 */
export async function verificarCriptografia(): Promise<Verificacao> {
  try {
    const comeco = performance.now();
    await inicializar();

    const chave = gerarChaveDeConversa();
    const contexto = {
      conversaId: 'diagnostico',
      remetenteId: 'diagnostico',
      epoca: chave.epoca,
      momento: Date.now(),
    };
    const original = 'teste de ponta a ponta';
    const aberto = decifrarMensagem(cifrarMensagem(original, chave, contexto), chave, contexto);

    if (aberto !== original) {
      return {
        id: 'cripto',
        titulo: 'Criptografia',
        estado: 'ruim',
        detalhe: 'A cifragem carregou, mas o texto não voltou igual.',
        ajuda: 'Isso não deveria acontecer. Vale abrir uma issue no repositório.',
      };
    }

    return {
      id: 'cripto',
      titulo: 'Criptografia',
      estado: 'bom',
      detalhe: `Cifrou e decifrou neste aparelho em ${Math.round(performance.now() - comeco)} ms.`,
    };
  } catch (erro) {
    return {
      id: 'cripto',
      titulo: 'Criptografia',
      estado: 'ruim',
      detalhe: erro instanceof Error ? erro.message : 'Não consegui carregar a criptografia.',
      ajuda: 'O navegador pode estar bloqueando WebAssembly. Tente o Chrome atualizado.',
    };
  }
}

/**
 * Pede câmera e microfone de verdade.
 *
 * Fica atrás de um botão de propósito: pedir permissão sozinho, assim que a
 * página abre, é o tipo de coisa que faz a pessoa negar por reflexo — e uma
 * permissão negada no Android é chata de reverter.
 */
export async function verificarCameraEMicrofone(): Promise<Verificacao> {
  if (!navigator.mediaDevices?.getUserMedia) {
    return {
      id: 'midia',
      titulo: 'Câmera e microfone',
      estado: 'ruim',
      detalhe: 'Este navegador não oferece acesso a câmera e microfone.',
      ajuda: 'Quase sempre é falta de HTTPS. Confira a verificação de conexão segura acima.',
    };
  }

  try {
    const fluxo = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    const faixas = fluxo.getTracks();
    // Soltar já: câmera acesa sem necessidade queima bateria e acende a luzinha,
    // o que assusta com razão.
    faixas.forEach((faixa) => faixa.stop());

    return {
      id: 'midia',
      titulo: 'Câmera e microfone',
      estado: 'bom',
      detalhe: `Liberados (${faixas.length} faixas). Áudio, vídeo e chamadas vão funcionar.`,
    };
  } catch (erro) {
    const negado = erro instanceof DOMException && erro.name === 'NotAllowedError';

    return {
      id: 'midia',
      titulo: 'Câmera e microfone',
      estado: negado ? 'atencao' : 'ruim',
      detalhe: negado ? 'Você negou a permissão.' : 'Não consegui acessar.',
      ajuda: negado
        ? 'Sem isso, mensagem de áudio e chamada não funcionam. No Chrome do Android: toque no cadeado ao lado do endereço → Permissões.'
        : 'Confira se outro aplicativo não está usando a câmera.',
    };
  }
}

/** Diz se dá para instalar como app na tela inicial. */
export function verificarInstalavel(instalavel: boolean): Verificacao {
  const jaInstalado = window.matchMedia('(display-mode: standalone)').matches;

  if (jaInstalado) {
    return {
      id: 'app',
      titulo: 'Instalado',
      estado: 'bom',
      detalhe: 'Você está usando pela tela inicial, como um app.',
    };
  }

  if (instalavel) {
    return {
      id: 'app',
      titulo: 'Instalar como app',
      estado: 'atencao',
      detalhe: 'Dá para instalar na tela inicial.',
      ajuda: 'No Chrome do Android: menu (⋮) → "Instalar aplicativo".',
    };
  }

  return {
    id: 'app',
    titulo: 'Instalar como app',
    estado: 'bom',
    detalhe: 'O APK do Android chega na Fase 6. Por ora, dá para usar pelo navegador.',
  };
}

function formatarDuracao(segundos: number): string {
  if (segundos < 60) return `${segundos}s`;
  if (segundos < 3_600) return `${Math.floor(segundos / 60)} min`;
  if (segundos < 86_400) return `${Math.floor(segundos / 3_600)} h`;
  return `${Math.floor(segundos / 86_400)} dias`;
}
