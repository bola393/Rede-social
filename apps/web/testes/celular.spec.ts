import { expect, test, type Page } from '@playwright/test';

/**
 * A rede aberta num celular Android simulado.
 *
 * A tela da Fase 0 é um diagnóstico, então o que testamos é justamente isto:
 * ela conta a verdade quando está tudo bem, e conta a verdade — com instrução
 * do que fazer — quando não está.
 */

const saudeBoa = {
  ok: true,
  nome: 'Nossa Rede',
  versao: '0.1.0',
  noArHa: 3_600,
  banco: 'ok',
  contextoSeguro: true,
};

/** Responde ao `/api/saude` sem precisar de servidor nem de banco. */
async function fingirServidor(pagina: Page, resposta: unknown, status = 200): Promise<void> {
  await pagina.route('**/api/saude', async (rota) => {
    await rota.fulfill({ status, contentType: 'application/json', body: JSON.stringify(resposta) });
  });
}

test('cabe na tela do celular, sem rolagem lateral', async ({ page }) => {
  await fingirServidor(page, saudeBoa);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Nossa Rede' })).toBeVisible();

  const { largura, larguraDaTela } = await page.evaluate(() => ({
    largura: document.documentElement.scrollWidth,
    larguraDaTela: window.innerWidth,
  }));

  // Rolagem horizontal em celular é o defeito de layout mais comum e o mais
  // irritante de usar.
  expect(largura).toBeLessThanOrEqual(larguraDaTela);
});

test('mostra tudo certo quando o servidor e o banco respondem', async ({ page }) => {
  await fingirServidor(page, saudeBoa);
  await page.goto('/');

  await expect(page.getByText('Tudo pronto por aqui.')).toBeVisible();
  await expect(page.getByText('no ar há 1 h')).toBeVisible();
  await expect(page.getByText('Respondendo.')).toBeVisible();
  await expect(page.getByLabel('com problema')).toHaveCount(0);
});

test('explica o que fazer quando o servidor não responde', async ({ page }) => {
  await page.route('**/api/saude', (rota) => rota.abort('connectionrefused'));
  await page.goto('/');

  await expect(page.getByText('Não consegui falar com o servidor.')).toBeVisible();
  // O diagnóstico só vale se disser o próximo passo.
  await expect(page.getByText(/INICIAR\.bat/)).toBeVisible();
  await expect(page.getByText(/Tailscale/)).toBeVisible();
});

test('avisa quando o banco caiu mas o servidor está de pé', async ({ page }) => {
  await fingirServidor(page, { ...saudeBoa, ok: false, banco: 'fora' }, 503);
  await page.goto('/');

  await expect(page.getByText('O servidor está de pé, mas o banco não responde.')).toBeVisible();
  await expect(page.getByText(/docker compose/)).toBeVisible();
});

test('a criptografia roda de verdade dentro do navegador', async ({ page }) => {
  await fingirServidor(page, saudeBoa);
  await page.goto('/');

  // Não é um "ok" decorativo: a tela cifra e decifra uma mensagem de teste com
  // o libsodium. Se o WebAssembly estivesse bloqueado, isto falharia.
  await expect(page.getByText(/Cifrou e decifrou neste aparelho em \d+ ms/)).toBeVisible();
});

test('libera câmera e microfone quando a permissão é dada', async ({ page }) => {
  await fingirServidor(page, saudeBoa);
  await page.goto('/');

  await page.getByRole('button', { name: 'Testar câmera e microfone' }).click();

  await expect(page.getByText(/Liberados \(2 faixas\)/)).toBeVisible({ timeout: 15_000 });
});

test('grava áudio em Opus, como uma mensagem de voz', async ({ page }) => {
  await fingirServidor(page, saudeBoa);
  await page.goto('/');

  // Prova antecipada da Fase 3: o formato que vamos usar para as mensagens de
  // áudio funciona neste navegador, com este microfone.
  const bytes = await page.evaluate(async () => {
    const fluxo = await navigator.mediaDevices.getUserMedia({ audio: true });
    const gravador = new MediaRecorder(fluxo, { mimeType: 'audio/webm;codecs=opus' });
    const pedacos: Blob[] = [];

    gravador.ondataavailable = (evento) => pedacos.push(evento.data);
    gravador.start();
    await new Promise((pronto) => setTimeout(pronto, 800));
    await new Promise<void>((pronto) => {
      gravador.onstop = () => pronto();
      gravador.stop();
    });

    fluxo.getTracks().forEach((faixa) => faixa.stop());
    return new Blob(pedacos).size;
  });

  expect(bytes).toBeGreaterThan(1_000);
});

test('completa uma chamada de vídeo WebRTC', async ({ page }) => {
  await fingirServidor(page, saudeBoa);
  await page.goto('/');

  // Prova antecipada da Fase 5: os dois lados conectam e a mídia atravessa.
  // Aqui ambos estão no mesmo aparelho, então isto valida o WebRTC em si —
  // não o TURN, que só é exercitado entre redes diferentes de verdade.
  const resultado = await page.evaluate(async () => {
    const fluxo = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    const daqui = new RTCPeerConnection();
    const dali = new RTCPeerConnection();

    daqui.onicecandidate = (e) => e.candidate && void dali.addIceCandidate(e.candidate);
    dali.onicecandidate = (e) => e.candidate && void daqui.addIceCandidate(e.candidate);
    fluxo.getTracks().forEach((faixa) => daqui.addTrack(faixa, fluxo));

    const recebeuMidia = new Promise<boolean>((pronto) => {
      dali.ontrack = () => pronto(true);
    });

    await daqui.setLocalDescription(await daqui.createOffer());
    await dali.setRemoteDescription(daqui.localDescription!);
    await dali.setLocalDescription(await dali.createAnswer());
    await daqui.setRemoteDescription(dali.localDescription!);

    await recebeuMidia;
    await new Promise<void>((pronto) => {
      const conferir = setInterval(() => {
        if (daqui.connectionState === 'connected') {
          clearInterval(conferir);
          pronto();
        }
      }, 50);
      setTimeout(() => {
        clearInterval(conferir);
        pronto();
      }, 15_000);
    });

    const estado = daqui.connectionState;
    fluxo.getTracks().forEach((faixa) => faixa.stop());
    daqui.close();
    dali.close();
    return estado;
  });

  expect(resultado).toBe('connected');
});

test('retrato da tela, para acompanhar como está ficando', async ({ page }) => {
  await fingirServidor(page, saudeBoa);
  await page.goto('/');
  await expect(page.getByText(/Cifrou e decifrou/)).toBeVisible();

  await page.screenshot({ path: 'retratos/fase-0-celular.png', fullPage: true });
});
