import { X509Certificate } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  amarelo,
  cinza,
  lerEnv,
  negrito,
  noWindows,
  raiz,
  rodar,
  verde,
  vermelho,
} from './comum.js';

/**
 * `pnpm doutor` — descobre por que a rede não está funcionando.
 *
 * A regra deste arquivo: **toda falha diz o que fazer**. "Docker não está
 * rodando" não ajuda ninguém; "abra o Docker Desktop pelo menu Iniciar e espere
 * a baleia ficar verde" ajuda.
 *
 * Ele roda sem a rede estar de pé — é exatamente aí que alguém precisa dele.
 */

type Estado = 'bom' | 'atencao' | 'ruim' | 'pulado';

interface Achado {
  titulo: string;
  estado: Estado;
  detalhe: string;
  comoResolver?: string[];
}

const env = lerEnv();
const achados: Achado[] = [];

function registrar(achado: Achado): Achado {
  achados.push(achado);
  return achado;
}

// ─── Docker ────────────────────────────────────────────────────────────────

async function conferirDocker(): Promise<boolean> {
  const versao = await rodar('docker', ['--version']);
  if (!versao.ok) {
    registrar({
      titulo: 'Docker',
      estado: 'ruim',
      detalhe: 'Não encontrei o Docker nesta máquina.',
      comoResolver: [
        'Baixe o Docker Desktop em https://docker.com/products/docker-desktop',
        'Instale, reinicie o computador e abra o Docker Desktop.',
        'O passo a passo com telas está em docs/instalacao-windows.md',
      ],
    });
    return false;
  }

  // `docker --version` responde mesmo com o serviço parado. Só `docker info`
  // prova que o motor está de pé.
  const info = await rodar('docker', ['info', '--format', '{{.ServerVersion}}']);
  if (!info.ok) {
    registrar({
      titulo: 'Docker',
      estado: 'ruim',
      detalhe: 'O Docker está instalado, mas não está rodando.',
      comoResolver: [
        'Abra o Docker Desktop pelo menu Iniciar.',
        'Espere o ícone da baleia, no canto da barra de tarefas, ficar verde.',
        'Na primeira vez isso pode levar um ou dois minutos.',
      ],
    });
    return false;
  }

  registrar({
    titulo: 'Docker',
    estado: 'bom',
    detalhe: `Rodando (motor ${info.saida.trim()}).`,
  });
  return true;
}

// ─── Configuração ──────────────────────────────────────────────────────────

function conferirEnv(): boolean {
  if (!existsSync(join(raiz, '.env'))) {
    registrar({
      titulo: 'Configuração',
      estado: 'ruim',
      detalhe: 'O arquivo .env ainda não existe.',
      comoResolver: ['Rode: pnpm preparar'],
    });
    return false;
  }

  const obrigatorios = ['JWT_SECRET', 'COOKIE_SECRET', 'MEDIA_ENCRYPTION_KEY', 'POSTGRES_PASSWORD'];
  const faltando = obrigatorios.filter((chave) => !env[chave]);

  if (faltando.length > 0) {
    registrar({
      titulo: 'Configuração',
      estado: 'ruim',
      detalhe: `Faltam segredos no .env: ${faltando.join(', ')}.`,
      comoResolver: ['Rode: pnpm preparar', '(ele preenche só o que falta, sem mexer no resto)'],
    });
    return false;
  }

  const dominio = env.DOMINIO ?? '';
  if (!dominio || dominio.includes('mude-para')) {
    registrar({
      titulo: 'Configuração',
      estado: 'ruim',
      detalhe: 'O DOMINIO ainda está com o valor de exemplo.',
      comoResolver: [
        'Rode: tailscale status',
        'Copie o nome desta máquina (algo como pc-do-joao.tail1234.ts.net).',
        'Abra o arquivo .env e ponha esse nome em DOMINIO.',
      ],
    });
    return false;
  }

  registrar({ titulo: 'Configuração', estado: 'bom', detalhe: `Rede em ${dominio}.` });
  return true;
}

// ─── Tailscale ─────────────────────────────────────────────────────────────

async function conferirTailscale(): Promise<void> {
  if ((env.MODO_TLS ?? 'tailscale') !== 'tailscale') {
    registrar({
      titulo: 'Tailscale',
      estado: 'pulado',
      detalhe: 'Não usado — esta instalação usa certificado da Let’s Encrypt.',
    });
    return;
  }

  const status = await rodar('tailscale', ['status']);
  if (!status.ok) {
    registrar({
      titulo: 'Tailscale',
      estado: 'ruim',
      detalhe: 'Não consegui falar com o Tailscale.',
      comoResolver: [
        'Se ainda não instalou: https://tailscale.com/download',
        'Se já instalou, abra o Tailscale e confira se você está conectado.',
        'Sem ele, os celulares não alcançam esta máquina fora de casa.',
      ],
    });
    return;
  }

  if (status.saida.includes('Logged out') || status.saida.includes('stopped')) {
    registrar({
      titulo: 'Tailscale',
      estado: 'ruim',
      detalhe: 'O Tailscale está instalado, mas desconectado.',
      comoResolver: ['Abra o Tailscale e clique em Connect.'],
    });
    return;
  }

  registrar({ titulo: 'Tailscale', estado: 'bom', detalhe: 'Conectado.' });
}

// ─── Certificado ───────────────────────────────────────────────────────────

function conferirCertificado(): void {
  if ((env.MODO_TLS ?? 'tailscale') !== 'tailscale') {
    registrar({
      titulo: 'Certificado HTTPS',
      estado: 'pulado',
      detalhe: 'O Caddy cuida sozinho quando o modo é letsencrypt.',
    });
    return;
  }

  const caminho = join(raiz, 'infra', 'certs', 'cert.pem');
  if (!existsSync(caminho)) {
    registrar({
      titulo: 'Certificado HTTPS',
      estado: 'ruim',
      detalhe: 'Ainda não busquei o certificado do Tailscale.',
      comoResolver: [
        'Rode: pnpm cert',
        '',
        'Sem HTTPS, o Android bloqueia câmera e microfone — então áudio,',
        'fotos e chamadas de vídeo não vão funcionar.',
      ],
    });
    return;
  }

  try {
    const cert = new X509Certificate(readFileSync(caminho));
    const vence = new Date(cert.validTo);
    const diasQueFaltam = Math.floor((vence.getTime() - Date.now()) / 86_400_000);

    if (diasQueFaltam < 0) {
      registrar({
        titulo: 'Certificado HTTPS',
        estado: 'ruim',
        detalhe: `Venceu há ${Math.abs(diasQueFaltam)} dias.`,
        comoResolver: ['Rode: pnpm cert', 'Depois: PARAR.bat e INICIAR.bat'],
      });
      return;
    }

    if (diasQueFaltam < 15) {
      registrar({
        titulo: 'Certificado HTTPS',
        estado: 'atencao',
        detalhe: `Vence em ${diasQueFaltam} dias (${cert.subject.replace('CN=', '')}).`,
        comoResolver: ['Vale renovar agora: pnpm cert'],
      });
      return;
    }

    registrar({
      titulo: 'Certificado HTTPS',
      estado: 'bom',
      detalhe: `Válido por mais ${diasQueFaltam} dias.`,
    });
  } catch {
    registrar({
      titulo: 'Certificado HTTPS',
      estado: 'ruim',
      detalhe: 'O arquivo do certificado existe, mas não consegui lê-lo.',
      comoResolver: ['Apague a pasta infra/certs e rode: pnpm cert'],
    });
  }
}

// ─── A rede em si ──────────────────────────────────────────────────────────

async function conferirContainers(): Promise<void> {
  const resultado = await rodar('docker', [
    'compose',
    '-f',
    join(raiz, 'infra', 'docker-compose.yml'),
    '--env-file',
    join(raiz, '.env'),
    'ps',
    '--format',
    '{{.Service}} {{.State}}',
  ]);

  if (!resultado.ok || !resultado.saida.trim()) {
    registrar({
      titulo: 'A rede',
      estado: 'atencao',
      detalhe: 'Nenhuma parte da rede está no ar.',
      comoResolver: [
        noWindows ? 'Clique duas vezes em INICIAR.bat' : 'Rode: pnpm iniciar',
        'Na primeira vez demora alguns minutos: o Docker precisa montar tudo.',
      ],
    });
    return;
  }

  const servicos = resultado.saida
    .trim()
    .split('\n')
    .map((linha) => linha.trim().split(/\s+/))
    .filter((partes): partes is [string, string] => partes.length >= 2);

  const parados = servicos.filter(([, estado]) => estado !== 'running');

  if (parados.length > 0) {
    registrar({
      titulo: 'A rede',
      estado: 'ruim',
      detalhe: `Fora do ar: ${parados.map(([nome]) => nome).join(', ')}.`,
      comoResolver: [
        `Veja o que aconteceu: docker compose -f infra/docker-compose.yml logs ${parados[0]?.[0] ?? ''}`,
      ],
    });
    return;
  }

  registrar({
    titulo: 'A rede',
    estado: 'bom',
    detalhe: `No ar: ${servicos.map(([nome]) => nome).join(', ')}.`,
  });
}

async function conferirServidor(): Promise<void> {
  const dominio = env.DOMINIO;
  const enderecos = [
    `https://${dominio}/api/saude`,
    `http://localhost:${env.PORTA_SERVIDOR ?? 3000}/api/saude`,
  ];

  for (const endereco of enderecos) {
    try {
      const controle = new AbortController();
      const prazo = setTimeout(() => controle.abort(), 5_000);
      const resposta = await fetch(endereco, { signal: controle.signal });
      clearTimeout(prazo);

      const corpo = (await resposta.json()) as { banco?: string; nome?: string };

      registrar({
        titulo: 'Servidor',
        estado: corpo.banco === 'ok' ? 'bom' : 'ruim',
        detalhe:
          corpo.banco === 'ok'
            ? `"${corpo.nome}" respondendo em ${endereco.replace('/api/saude', '')}.`
            : 'O servidor responde, mas o banco de dados não.',
        ...(corpo.banco === 'ok'
          ? {}
          : {
              comoResolver: ['Rode: docker compose -f infra/docker-compose.yml restart postgres'],
            }),
      });
      return;
    } catch {
      // Tenta o próximo endereço.
    }
  }

  registrar({
    titulo: 'Servidor',
    estado: 'ruim',
    detalhe: 'Não respondeu em nenhum endereço.',
    comoResolver: [
      'Se a rede está no ar mas o servidor não responde, veja o registro:',
      'docker compose -f infra/docker-compose.yml logs servidor --tail 50',
    ],
  });
}

// ─── Backup ────────────────────────────────────────────────────────────────

function conferirBackup(): void {
  const pasta = join(raiz, env.BACKUP_DIR?.replace('./', '') ?? 'backups');

  if (!existsSync(pasta)) {
    registrar({
      titulo: 'Backup',
      estado: 'atencao',
      detalhe: 'Nenhum backup foi feito ainda.',
      comoResolver: [
        'Rode: pnpm backup',
        '',
        'Com criptografia ponta-a-ponta, o backup é a ÚNICA cópia que existe.',
        'O servidor não consegue reconstruir mensagem nenhuma.',
      ],
    });
    return;
  }

  const arquivos = readdirSync(pasta)
    .filter((nome) => nome.endsWith('.dump'))
    .map((nome) => ({ nome, quando: statSync(join(pasta, nome)).mtime }))
    .sort((a, b) => b.quando.getTime() - a.quando.getTime());

  const maisNovo = arquivos[0];
  if (!maisNovo) {
    registrar({
      titulo: 'Backup',
      estado: 'atencao',
      detalhe: 'A pasta de backups existe, mas está vazia.',
      comoResolver: ['Rode: pnpm backup'],
    });
    return;
  }

  const diasAtras = Math.floor((Date.now() - maisNovo.quando.getTime()) / 86_400_000);

  registrar({
    titulo: 'Backup',
    estado: diasAtras > 7 ? 'atencao' : 'bom',
    detalhe:
      diasAtras === 0
        ? `O mais recente é de hoje (${arquivos.length} guardados).`
        : `O mais recente é de ${diasAtras} dia${diasAtras > 1 ? 's' : ''} atrás.`,
    ...(diasAtras > 7 ? { comoResolver: ['Rode: pnpm backup'] } : {}),
  });
}

// ─── Saída ─────────────────────────────────────────────────────────────────

function imprimir(): number {
  const simbolo: Record<Estado, string> = {
    bom: verde('  ok  '),
    atencao: amarelo(' aviso'),
    ruim: vermelho(' erro '),
    pulado: cinza('  --  '),
  };

  console.log('');
  console.log(negrito('  Diagnóstico da rede'));
  console.log(cinza('  ─────────────────────────────────────────────────────────'));
  console.log('');

  for (const achado of achados) {
    console.log(`  ${simbolo[achado.estado]}  ${negrito(achado.titulo)}`);
    console.log(`          ${cinza(achado.detalhe)}`);

    if (achado.comoResolver) {
      console.log('');
      for (const linha of achado.comoResolver) {
        console.log(linha ? `          ${linha}` : '');
      }
    }
    console.log('');
  }

  const erros = achados.filter((a) => a.estado === 'ruim').length;
  const avisos = achados.filter((a) => a.estado === 'atencao').length;

  console.log(cinza('  ─────────────────────────────────────────────────────────'));
  if (erros === 0 && avisos === 0) {
    console.log(`  ${verde('Está tudo certo.')}`);
    if (env.DOMINIO) {
      console.log(cinza(`  Abra no celular: https://${env.DOMINIO}`));
    }
  } else {
    const partes = [];
    if (erros > 0) partes.push(vermelho(`${erros} ${erros === 1 ? 'erro' : 'erros'}`));
    if (avisos > 0) partes.push(amarelo(`${avisos} ${avisos === 1 ? 'aviso' : 'avisos'}`));
    console.log(`  ${partes.join(' e ')}. Resolva de cima para baixo — o primeiro`);
    console.log('  problema costuma ser a causa dos de baixo.');
  }
  console.log('');

  return erros > 0 ? 1 : 0;
}

async function principal(): Promise<void> {
  const temDocker = await conferirDocker();
  const temConfig = conferirEnv();

  await conferirTailscale();
  conferirCertificado();

  if (temDocker && temConfig) {
    await conferirContainers();
    await conferirServidor();
  }

  conferirBackup();

  process.exit(imprimir());
}

void principal();
