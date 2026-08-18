# Instalando a rede no seu PC

Passo a passo do zero. Não presumo que você já saiba nada disto — se aparecer
uma palavra estranha, o [glossário](glossario.md) explica.

Reserve **uma hora** para a primeira vez. Boa parte é esperar download.

---

## O que você vai instalar

| Programa | Para quê | Grátis? |
| --- | --- | --- |
| Docker Desktop | Roda a rede em caixinhas isoladas, sem bagunçar seu Windows | Sim |
| Tailscale | Dá HTTPS de verdade e deixa os celulares acessarem de qualquer lugar | Sim |
| Node.js | Necessário para os comandos do projeto | Sim |
| Git | Baixa e atualiza o código | Sim |

---

## Passo 1 — Docker Desktop

1. Baixe em **https://docker.com/products/docker-desktop** (botão "Download for
   Windows").
2. Abra o instalador. Deixe marcada a opção **"Use WSL 2 instead of Hyper-V"**.
3. **Reinicie o computador** quando ele pedir. Não pule isso — o WSL2 só entra
   em funcionamento depois.
4. Abra o Docker Desktop pelo menu Iniciar. Na primeira vez ele demora e pode
   pedir para instalar algo do Windows; aceite.

**Como saber que deu certo:** no canto direito da barra de tarefas aparece um
ícone de baleia. Passe o mouse em cima: deve dizer *"Docker Desktop is
running"*.

> **Se aparecer "WSL 2 installation is incomplete":** abra o PowerShell como
> administrador e rode `wsl --install`, depois reinicie.

---

## Passo 2 — Node.js e pnpm

1. Baixe em **https://nodejs.org** — a versão **LTS**, o botão da esquerda.
2. Instale clicando "Avançar" em tudo.
3. Abra o **PowerShell** (menu Iniciar, digite "powershell") e rode:

```powershell
node --version
```

Deve aparecer algo como `v22.x.x`. Agora ative o pnpm, que é o gerenciador que
este projeto usa:

```powershell
corepack enable
```

---

## Passo 3 — Baixar o projeto no lugar certo

**Este é o passo em que quase todo mundo tropeça.** Leia com atenção.

O Docker no Windows roda dentro do WSL2, que é um Linux embutido. Quando o
projeto fica em `C:\`, cada leitura de arquivo atravessa a fronteira entre os
dois sistemas — e isso é **lento a ponto de atrapalhar**: o que levaria 2
segundos passa a levar 40. Pior, a detecção automática de mudanças em arquivos
simplesmente não funciona.

Então o projeto vai morar **dentro do WSL2**.

Abra o PowerShell e rode:

```powershell
wsl
```

O texto do terminal muda — agora você está no Linux. Rode:

```bash
sudo apt update && sudo apt install -y git
cd ~
git clone https://github.com/bola393/Rede-social.git
cd Rede-social
```

> **Na primeira vez que usar o `wsl`,** ele pede para criar um usuário e uma
> senha. Escolha algo simples que você lembre — é só do Linux interno, não tem
> a ver com sua conta do Windows nem com a senha da rede.

Para abrir essa pasta pelo Explorador de Arquivos do Windows, digite na barra
de endereço:

```
\\wsl$\Ubuntu\home\SEU-USUARIO\Rede-social
```

Vale criar um atalho dela na área de trabalho — é ali que ficam o `INICIAR.bat`
e os outros arquivos de clique duplo.

---

## Passo 4 — Instalar o projeto

Ainda no terminal do WSL, dentro da pasta:

```bash
corepack enable
pnpm install
pnpm preparar
```

O `pnpm preparar` cria o arquivo de configuração e **sorteia todas as senhas e
segredos** automaticamente. Você não precisa inventar nenhuma senha.

---

## Passo 5 — Tailscale

O Tailscale é o que faz a rede funcionar direito. Ele resolve dois problemas de
uma vez:

- **HTTPS de verdade.** Sem HTTPS, o Android bloqueia câmera e microfone — ou
  seja, mensagem de áudio, foto e chamada de vídeo simplesmente não abrem.
- **Acesso de qualquer lugar.** Vocês se conectam do 4G, da casa da sogra, de
  onde for, sem abrir nenhuma porta no roteador.

### No PC

1. Baixe em **https://tailscale.com/download** e instale.
2. Abra e clique em **Log in**. Crie uma conta (dá para entrar com o Google).
3. Deixe conectado.

### Ligue o HTTPS na sua conta

1. Entre em **https://login.tailscale.com/admin/dns**
2. Confira se **MagicDNS** está ligado.
3. Logo abaixo, ligue **HTTPS Certificates**.

Sem esse passo, o `pnpm cert` do próximo passo vai falhar.

### Descubra o endereço da sua rede

No terminal do WSL:

```bash
tailscale status
```

Vai aparecer uma linha como:

```
100.101.102.103   pc-do-joao   voce@gmail.com   windows   -
```

O endereço completo junta o nome da máquina com o nome da sua rede Tailscale.
Para ver ele inteiro:

```bash
tailscale status --json | grep DNSName
```

Algo como `pc-do-joao.tail1a2b3c.ts.net.` — **sem o ponto final**.

### Ponha esse endereço na configuração

Abra o arquivo `.env` (está na pasta do projeto) e troque a linha:

```
DOMINIO=mude-para-o-seu-nome.ts.net
```

por:

```
DOMINIO=pc-do-joao.tail1a2b3c.ts.net
```

Para abrir o arquivo pelo Bloco de Notas do Windows, use o Explorador no
caminho `\\wsl$\Ubuntu\...` que você anotou antes.

### Busque o certificado

```bash
pnpm cert
```

Se der certo, ele diz onde guardou o certificado. Se falhar, a mensagem explica
qual das três causas comuns é a sua.

### Nos celulares

Instale o app **Tailscale** (Play Store) em cada celular e entre com **a mesma
conta**. Só isso — não precisa configurar mais nada.

---

## Passo 6 — Ligar

Pelo Explorador de Arquivos, na pasta do projeto, clique duas vezes em:

```
INICIAR.bat
```

A primeira vez demora **vários minutos**: o Docker está montando tudo. As
próximas levam segundos.

Quando terminar, ele mostra o endereço para abrir no celular.

---

## Passo 7 — Conferir

Clique duas vezes em `DIAGNOSTICO.bat`. Ele confere tudo e escreve, em
português, o que estiver errado e o comando que resolve.

Depois, **abra no celular** o endereço `https://seu-pc.tail1a2b3c.ts.net`
(com o Tailscale conectado nele). Você deve ver a tela de diagnóstico, toda
verde. Toque em **"Testar câmera e microfone"** e permita — é a prova de que o
HTTPS está correto.

---

## Passo 8 — Deixar o PC preparado

Clique com o botão direito em `CONFIGURAR-PC.bat` → **Executar como
administrador**.

Ele ajusta o que atrapalha um PC que precisa ficar disponível:

- impede o computador de dormir (a tela ainda apaga, e tudo bem);
- ajusta o Windows Update para **não reiniciar de madrugada**;
- agenda o **backup automático diário** às 4h.

Cada mudança é explicada na tela, e o final mostra como desfazer.

---

## O dia a dia

| O que você quer | O que fazer |
| --- | --- |
| Ligar a rede | `INICIAR.bat` |
| Desligar | `PARAR.bat` |
| Ver se está tudo certo | `DIAGNOSTICO.bat` |
| Fazer backup agora | terminal: `pnpm backup` |
| Ver o que o servidor está fazendo | terminal: `pnpm registros` |

---

## Uma limitação que vale saber desde já

**PC desligado ou dormindo = rede fora do ar.** Não chega mensagem, não toca
chamada. O `CONFIGURAR-PC.bat` resolve as quedas bobas, mas queda de luz e
queda de internet derrubam tudo — e o notebook, na mesma casa, não salva: ele
está na mesma tomada e no mesmo provedor.

Enquanto vocês estiverem testando, isso é perfeitamente aceitável. Quando a
rede virar coisa séria, o caminho é a [migração para uma VPS](migracao-vps.md).

---

## Deu errado?

Rode o `DIAGNOSTICO.bat` primeiro — ele resolve a maioria dos casos sozinho.

Se ele não ajudar, veja o [o-que-fazer-se.md](o-que-fazer-se.md), que tem
receita pronta para os problemas mais comuns.
