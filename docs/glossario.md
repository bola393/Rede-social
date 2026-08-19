# Glossário

As palavras estranhas que aparecem neste projeto, em português simples.

---

## Docker

Um jeito de rodar programas dentro de **caixinhas isoladas**. Cada caixinha traz
tudo de que o programa precisa e não enxerga o resto do seu computador.

Por que isso importa aqui: o banco de dados desta rede precisa do PostgreSQL
numa versão específica, com uma configuração específica. Sem Docker, você
instalaria isso no Windows na mão, e qualquer atualização poderia quebrar. Com
Docker, tudo vive numa caixinha — e apagar a caixinha não deixa vestígio.

**Container** é uma dessas caixinhas rodando. Esta rede usa quatro: banco,
servidor, interface e o servidor de chamadas.

**Imagem** é o molde de onde a caixinha nasce. Baixar uma imagem é como baixar
um programa; criar um container é como abri-lo.

**Docker Compose** é o arquivo que descreve as quatro caixinhas de uma vez, para
subirem juntas com um comando só.

---

## WSL2

*Windows Subsystem for Linux 2* — um **Linux completo rodando dentro do
Windows**. O Docker o usa por baixo dos panos.

Por que você precisa saber que ele existe: o projeto deve ficar **dentro** do
WSL2, não em `C:\`. Arquivos que atravessam a fronteira entre Windows e Linux
são lidos muito devagar, e a detecção de mudanças para de funcionar. É o
tropeço mais comum de quem começa.

---

## Tailscale

Uma **rede privada entre os seus aparelhos**. Depois de instalado no PC e nos
celulares, com a mesma conta, eles se enxergam como se estivessem todos na mesma
casa — mesmo que um esteja no 4G do outro lado da cidade.

Ele resolve dois problemas aqui:

1. **Ninguém precisa mexer no roteador.** Sem abrir portas, sem expor o PC na
   internet.
2. **HTTPS de verdade** — veja abaixo por que isso é essencial.

---

## HTTPS e "contexto seguro"

HTTPS é o cadeado que aparece do lado do endereço no navegador. Ele cifra o que
trafega entre o aparelho e o servidor.

**Aqui ele não é opcional.** O Android se recusa a dar acesso a câmera e
microfone para páginas sem HTTPS. Não é um aviso que dá para ignorar: a função
que pede a câmera nem existe. Sem HTTPS, mensagem de áudio, foto e chamada de
vídeo ficam impossíveis.

Os navegadores chamam de **contexto seguro** uma página servida por HTTPS (ou
aberta em `localhost`, que é a única exceção).

---

## Certificado

O arquivo que prova ao navegador que aquele endereço é mesmo quem diz ser. Sem
ele, o navegador mostra a tela vermelha de "sua conexão não é particular".

Certificado para uma máquina dentro de casa costuma ser complicado. O Tailscale
resolve: como ele é o dono do domínio `.ts.net`, consegue pedir um certificado
**legítimo** à Let's Encrypt para o nome da sua máquina. O navegador aceita sem
que você instale nada.

Vale 90 dias. O `pnpm cert` renova, e o `pnpm doutor` avisa quando estiver perto.

---

## Criptografia ponta-a-ponta (E2EE)

A mensagem é fechada no aparelho de quem escreve e só abre no aparelho de quem
recebe. **Nem o servidor consegue ler** — mesmo sendo seu, mesmo com acesso
total ao banco de dados.

É o mesmo princípio do WhatsApp e do Signal.

O preço disso, que é real:

- a notificação não mostra o texto, só "Nova mensagem de Ana";
- a busca acontece no aparelho, não no servidor;
- **quem perde a senha e a frase de recuperação perde o histórico.** Não existe
  "esqueci minha senha" que devolva as conversas.

---

## Frase de recuperação

24 palavras em português, sorteadas no seu cadastro e mostradas **uma vez só**.

Dessas palavras nasce, sempre igual, uma chave capaz de reabrir o seu histórico
num aparelho novo. É o que salva o dia quando o celular quebra.

Quem tem a frase tem acesso a tudo, para sempre, e não dá para trocá-la depois.
**Escreva no papel. Guarde longe do computador. Não tire foto.**

---

## Chave pública e chave privada

Um par de chaves que funcionam em conjunto:

- A **pública** você pode espalhar. Serve para as pessoas te mandarem segredos.
- A **privada** nunca sai do seu aparelho. É a única capaz de abrir o que foi
  fechado com a pública.

Pense num cadeado aberto que você distribui (pública) e na única chave que o
abre, que fica com você (privada).

O servidor desta rede só conhece as chaves públicas.

---

## Argon2id

O processo que transforma a sua senha numa chave. Ele é **lento de propósito**.

Meio segundo de espera ao destravar o app é irrelevante para você. Para quem
está tentando adivinhar sua senha por força bruta, esse meio segundo por
tentativa transforma dias de trabalho em séculos.

---

## WebRTC

A tecnologia que faz as chamadas de voz e vídeo funcionarem direto no navegador,
**sem passar por servidor nenhum** quando os aparelhos conseguem se achar. O
áudio e o vídeo já saem criptografados de fábrica.

---

## STUN e TURN

Dois ajudantes das chamadas.

**STUN** ajuda cada aparelho a descobrir qual é o próprio endereço visto de
fora. Na maioria dos casos isso basta para os dois se acharem.

**TURN** é o plano B: quando os aparelhos não conseguem conexão direta (comum em
4G de operadora), ele **repassa** os pacotes de um para o outro. Ele não
consegue ver nem ouvir nada — o conteúdo já chega cifrado nele. É um carteiro,
não um leitor.

Nesta rede o TURN é o `coturn`. Com o Tailscale ligado, quase nunca é preciso.

---

## Backup e `pg_dump`

`pg_dump` é o programa que tira um **retrato coerente** do banco de dados, mesmo
com ele em funcionamento.

Copiar a pasta do banco no braço não serve: o banco está escrevendo enquanto
você copia, e a cópia pode não abrir — ou abrir corrompida em silêncio, que é
pior.

Aqui o backup é ainda mais importante do que o normal: com criptografia
ponta-a-ponta, **ele é a única cópia que existe**.

---

## VPS

*Virtual Private Server* — um computador alugado num data center, ligado 24
horas por dia, com internet e energia muito mais confiáveis que as de uma casa.

Custa uns R$ 30 a R$ 60 por mês. É para onde a rede vai quando o projeto deixar
de ser experiência e passar a ser coisa de que vocês dependem.

---

## Monorepo

Vários projetos relacionados num repositório só. Aqui são o servidor, a
interface, o app e as bibliotecas compartilhadas — todos juntos, para que uma
mudança que afeta os dois lados seja feita de uma vez e nunca fiquem
desencontrados.

---

## PWA

*Progressive Web App* — um site que dá para instalar na tela inicial e usar como
se fosse um aplicativo.

Esta rede já é um PWA. Na Fase 6 ela ganha também um **APK**, que é o arquivo de
instalação de app do Android de verdade, com acesso a biometria e notificações.
