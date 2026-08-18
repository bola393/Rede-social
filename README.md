# Nossa Rede

Uma rede social privada, criptografada, para você e as pessoas em quem você confia.

Não é um produto público. Ninguém entra sem convite, e as conversas são protegidas com
criptografia **ponta-a-ponta** — nem o servidor consegue lê-las, mesmo sendo seu.

## O que ela tem

| Recurso | Estado |
| --- | --- |
| Acesso só por convite, com senha pessoal | Fase 1 |
| Chat individual e em grupo, criptografado ponta-a-ponta | Fase 2 |
| Mensagens de áudio | Fase 3 |
| Fotos e vídeos | Fase 3 |
| Mensagens temporárias, que somem sozinhas | Fase 3 |
| Feed com posts, reações e comentários | Fase 4 |
| Chamadas de voz e de vídeo | Fase 5 |
| App para Android (APK) | Fase 6 |

**Fase atual: 0 — fundação.** A rede sobe, responde por HTTPS e você já consegue abrir no
celular. Os recursos vêm nas fases seguintes.

## Nunca usou Docker? Comece por aqui

Leia **[docs/instalacao-windows.md](docs/instalacao-windows.md)**. É um passo a passo do
zero, escrito para quem nunca mexeu com isso: o que baixar, onde clicar, o que deve aparecer
na tela e o que fazer quando der errado.

Se aparecer alguma palavra estranha (container, WSL2, TURN, ponta-a-ponta), o
**[glossário](docs/glossario.md)** explica cada uma em português simples.

## O dia a dia, depois de instalado

Você não precisa de terminal para usar:

| O que você quer | O que fazer |
| --- | --- |
| Ligar a rede | Clique duas vezes em `INICIAR.bat` |
| Desligar a rede | Clique duas vezes em `PARAR.bat` |
| Descobrir por que algo não funciona | Clique duas vezes em `DIAGNOSTICO.bat` |

O diagnóstico confere tudo que costuma dar errado — Docker ligado, Tailscale conectado,
certificado no prazo, banco respondendo, backup recente — e escreve em português o que houve
e o comando exato que resolve.

Deu algum problema específico? **[docs/o-que-fazer-se.md](docs/o-que-fazer-se.md)** tem as
receitas prontas: o PC reiniciou, o certificado venceu, esqueci a senha, preciso restaurar o
backup, quero convidar mais uma pessoa.

## Para quem for mexer no código

```bash
pnpm install          # instala tudo
pnpm preparar         # cria o .env e sorteia as senhas e segredos
pnpm dev              # Postgres em container, servidor e web com recarga automática
pnpm test             # roda os testes
pnpm lint             # confere o estilo do código
pnpm typecheck        # confere os tipos
```

Para subir a rede inteira do jeito que ela roda de verdade (igual à VPS):

```bash
docker compose -f infra/docker-compose.yml up -d
```

### Como o projeto é organizado

```
apps/server      Servidor: Fastify + Socket.IO + Prisma + PostgreSQL
apps/web         Interface: React + Vite (é também um PWA instalável)
apps/mobile      Capacitor — empacota a interface num APK de Android
packages/shared  Tipos e validações usados pelo servidor e pela interface
packages/crypto  Toda a criptografia ponta-a-ponta, isolada e testada à parte
infra/           Docker Compose, Caddy (HTTPS) e coturn (chamadas)
scripts/         Backup, restauração, diagnóstico e configuração do PC
docs/            Documentação, toda em português
```

O pacote `crypto` fica separado de propósito: é o código mais crítico do projeto, então
precisa de testes próprios, sem depender de tela nenhuma.

## Três coisas que você precisa saber

**1. O backup é a única cópia que existe.** Como as mensagens são criptografadas com chaves
que só existem nos aparelhos, o servidor não consegue reconstruir nada. Perdeu o banco sem
backup, perdeu para sempre. Por isso o backup é automático — e por isso vale testar a
restauração uma vez, com calma, antes de precisar dela com pressa.

**2. Perder a senha e a frase de recuperação significa perder o histórico.** Não existe
"esqueci minha senha" que devolva as conversas. No cadastro, cada pessoa recebe uma frase de
24 palavras: é ela que salva o dia numa troca de celular. Guarde no papel.

**3. Mensagem temporária protege contra descuido, não contra má-fé.** O app bloqueia captura
de tela no Android, mas ninguém consegue impedir que alguém fotografe a tela com outro
celular. Vale para o WhatsApp, para o Signal e vale aqui também.

Mais detalhes em **[docs/seguranca.md](docs/seguranca.md)**.

## Licença

Uso pessoal. Sem garantia de nenhum tipo.
