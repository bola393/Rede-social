import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { cinza, lerEnv, raiz, rodar, verde, vermelho } from './comum.js';

/**
 * `pnpm cert` — busca o certificado HTTPS do Tailscale.
 *
 * ## Por que isto existe
 *
 * O Android bloqueia câmera e microfone em páginas sem HTTPS. Não é um aviso
 * que dá para ignorar: `getUserMedia` simplesmente não existe, e mensagem de
 * áudio, foto e chamada de vídeo ficam impossíveis.
 *
 * Certificado para uma máquina dentro de casa costuma ser um problema chato —
 * ou você usa um autoassinado e instala em cada aparelho na mão, ou expõe o PC
 * na internet para conseguir um de verdade.
 *
 * O Tailscale resolve isso de um jeito elegante: ele mantém o domínio
 * `.ts.net`, então consegue provar à Let's Encrypt, por desafio de DNS, que
 * aquele nome é seu. O certificado que sai daqui é **legítimo** — os
 * navegadores confiam nele sem que você instale nada em lugar nenhum.
 *
 * Vale por 90 dias. O `pnpm doutor` avisa quando estiver perto de vencer.
 */

const PASTA = join(raiz, 'infra', 'certs');

async function principal(): Promise<void> {
  const env = lerEnv();
  const dominio = env.DOMINIO;

  if (!dominio || dominio.includes('mude-para')) {
    console.error(
      [
        '',
        vermelho('Falta definir o DOMINIO no arquivo .env.'),
        '',
        'Para descobrir o nome desta máquina no Tailscale, rode:',
        '',
        '    tailscale status',
        '',
        'A primeira linha mostra algo como:',
        '',
        cinza('    100.x.y.z   pc-do-joao   voce@   linux   -'),
        '',
        'O endereço completo junta o nome da máquina com o da sua rede:',
        cinza('    pc-do-joao.tail1234.ts.net'),
        '',
        'Para ver o nome completo:  tailscale status --json',
        '(procure por "DNSName")',
        '',
      ].join('\n'),
    );
    process.exit(1);
  }

  if ((env.MODO_TLS ?? 'tailscale') !== 'tailscale') {
    console.log(
      [
        '',
        `O MODO_TLS está como "${env.MODO_TLS}", não "tailscale".`,
        '',
        'Nesse modo o Caddy pede e renova o certificado sozinho — não há nada',
        'para fazer aqui. Se você quis usar o Tailscale, troque o MODO_TLS no',
        '.env e rode de novo.',
        '',
      ].join('\n'),
    );
    return;
  }

  mkdirSync(PASTA, { recursive: true });

  console.log(`Pedindo o certificado para ${dominio}...`);
  console.log(cinza('(pode levar alguns segundos — o Tailscale conversa com a Let’s Encrypt)'));
  console.log('');

  const resultado = await rodar(
    'tailscale',
    ['cert', '--cert-file', join(PASTA, 'cert.pem'), '--key-file', join(PASTA, 'key.pem'), dominio],
    { timeoutMs: 120_000 },
  );

  if (!resultado.ok) {
    console.error(
      [
        '',
        vermelho('Não consegui buscar o certificado.'),
        '',
        cinza(resultado.saida.split('\n').slice(0, 6).join('\n')),
        '',
        'As três causas mais comuns:',
        '',
        '  1. O HTTPS não está ligado na sua conta do Tailscale.',
        '     Entre em https://login.tailscale.com/admin/dns e ligue',
        '     "HTTPS Certificates" (é gratuito).',
        '',
        '  2. O nome no DOMINIO não é o desta máquina.',
        '     Confira com: tailscale status',
        '',
        '  3. No Windows, o comando precisa rodar como administrador.',
        '     Abra o terminal com o botão direito → "Executar como',
        '     administrador" e tente de novo.',
        '',
      ].join('\n'),
    );
    process.exit(1);
  }

  const certificado = join(PASTA, 'cert.pem');
  if (!existsSync(certificado)) {
    console.error(vermelho('O comando terminou sem erro, mas o arquivo não apareceu.'));
    process.exit(1);
  }

  console.log(verde(`Certificado guardado em infra/certs/ para ${dominio}.`));
  console.log('');
  console.log('Agora reinicie a rede para ele entrar em uso:');
  console.log('');
  console.log('    pnpm parar && pnpm iniciar');
  console.log('');
  console.log(cinza('(no Windows: PARAR.bat e depois INICIAR.bat)'));
  console.log('');
}

void principal();
