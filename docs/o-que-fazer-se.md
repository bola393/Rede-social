# O que fazer se…

Receitas para os apuros. Procure o seu caso pelo título.

> **Antes de tudo:** rode o `DIAGNOSTICO.bat`. Ele resolve a maioria dos casos
> sozinho, dizendo o comando exato.

---

## …a rede não abre no celular

Confira, nesta ordem:

1. **O PC está ligado?** Rede caseira só existe com a máquina acordada.
2. **O Tailscale está conectado nos dois?** Abra o app no celular — precisa
   dizer "Connected".
3. **A rede está no ar?** No PC, `DIAGNOSTICO.bat`.
4. **O endereço está certo?** Tem que ser o `https://...ts.net` completo. O IP
   da rede local (`192.168...`) **não serve** — sem HTTPS o Android bloqueia
   câmera e microfone.

---

## …o PC reiniciou sozinho

Se o `CONFIGURAR-PC.bat` já rodou, a rede volta sozinha junto com o Docker.
Espere uns dois minutos e confira com o `DIAGNOSTICO.bat`.

Se não voltou, clique no `INICIAR.bat`.

Para o Windows parar de reiniciar de madrugada, rode o `CONFIGURAR-PC.bat` como
administrador.

---

## …o certificado venceu

O navegador mostra "sua conexão não é particular", e câmera e microfone param de
funcionar.

```bash
pnpm cert
pnpm parar && pnpm iniciar
```

O certificado vale 90 dias. O `DIAGNOSTICO.bat` avisa com 15 dias de folga.

---

## …o `pnpm cert` dá erro

As três causas, em ordem de frequência:

1. **O HTTPS não está ligado na conta do Tailscale.** Entre em
   https://login.tailscale.com/admin/dns e ligue "HTTPS Certificates".
2. **O DOMINIO no `.env` não bate com esta máquina.** Confira com
   `tailscale status`.
3. **Falta permissão de administrador.** Abra o terminal com o botão direito →
   "Executar como administrador".

---

## …esqueci a senha da minha conta

Aqui a resposta é dura, e é melhor saber antes: **não existe recuperação de
senha que devolva as conversas.** É o preço da criptografia ponta-a-ponta — o
servidor não guarda nenhuma chave capaz de abrir o seu histórico.

O que dá para fazer:

- **Você ainda está destravado em outro aparelho?** É o melhor caso: dá para
  seguir usando por lá.
- **Você tem a frase de 24 palavras?** Ela é o que vai reabrir o histórico num
  aparelho novo. A tela que aceita a frase chega na Fase 2, junto com as
  conversas — antes disso não há histórico para recuperar. Guarde o papel.
- **Nenhum dos dois?** Quem administra a rede pode criar uma conta nova para
  você. As conversas antigas ficam perdidas — não há como contornar.

---

## …perdi o celular

De outro aparelho já conectado, entre em **Ajustes → Meus aparelhos** e revogue
o que sumiu.

A sessão dele cai na hora, e ele para de conseguir renovar o acesso.

A partir da Fase 2, revogar também **gira a chave** das conversas de que aquele
aparelho participava, cortando o acesso ao que vier depois. Por enquanto, o que
a revogação garante é o corte da sessão.

O que ele já tinha baixado antes continua com ele — não há como apagar
remotamente algo que já saiu do seu alcance. Se o celular estava sem bloqueio de
tela, troque também a sua senha.

---

## …preciso restaurar um backup

```bash
pnpm restaurar
```

Ele mostra qual backup vai usar, avisa que isso apaga o banco atual, e só
continua depois que você digitar `RESTAURAR`.

Para escolher outro backup:

```bash
pnpm restaurar banco-2026-08-15
```

> **Se as fotos do feed voltarem quebradas:** o `.env` desta máquina tem um
> `MEDIA_ENCRYPTION_KEY` diferente do original. Recupere o `.env` que estava
> junto do backup.

---

## …o PC morreu de vez

O notebook tem a cópia. No notebook:

1. Instale Docker, Node e Tailscale (mesmo passo a passo).
2. Baixe o projeto.
3. Copie para lá a pasta `backups` **e o arquivo `.env`** do PC antigo.
4. Ajuste o `DOMINIO` no `.env` para o nome do notebook no Tailscale.
5. `pnpm cert`
6. `pnpm iniciar`
7. `pnpm restaurar`

Os celulares acham a máquina nova sozinhos — desde que você atualize o endereço
neles.

---

## …ainda não existe nenhuma conta na rede

O primeiro convite não pode sair de dentro do app: não há ninguém para criá-lo. Ele sai
pelo terminal, no PC que hospeda a rede:

```bash
pnpm convite
```

**Quem se cadastrar com esse código administra a rede** — gera os próximos convites,
remove membros, e por aí vai. Use você mesmo.

---

## …quero convidar mais alguém

Em **Ajustes → Convites**, gere um código. Escolha para quantas pessoas ele vale
e por quantos dias.

Mande o código junto com o endereço da rede. A pessoa se cadastra com ele.

> Convite é a única porta de entrada. Sem um código válido, ninguém cria conta —
> é isso que mantém a rede fechada.

---

## …quero remover alguém

Em **Ajustes → Membros**, remova a pessoa.

Ela perde o acesso na hora: a conta é desativada e todas as sessões dela caem.
A partir da Fase 2, as conversas de que ela participava também **giram para uma
chave nova**, para que ela não leia o que vier depois.

O que ela já tinha lido, ela já leu. Isso não tem como desfazer em lugar nenhum
— nem aqui, nem no WhatsApp.

---

## …a rede ficou lenta

```bash
pnpm registros
```

Procure por mensagens de erro repetidas. As causas mais comuns:

- **Disco cheio.** Vídeos ocupam muito. Confira o espaço livre do PC.
- **Backups acumulados.** O `.env` controla quantos dias manter em
  `BACKUP_RETENCAO_DIAS`.
- **O projeto está em `C:\` e não dentro do WSL2.** Isso deixa tudo lento.
  Veja o [passo 3 da instalação](instalacao-windows.md).

---

## …quero apagar tudo e recomeçar

**Isto apaga todas as mensagens, fotos e contas, sem volta.**

```bash
pnpm parar
docker compose -f infra/docker-compose.yml --env-file .env down -v
pnpm iniciar
```

O `-v` é o que apaga os dados. Sem ele, os containers somem mas o banco fica.

---

## …nada disso resolveu

Junte estas três coisas e abra uma issue no repositório:

```bash
pnpm doutor                              # o diagnóstico completo
pnpm registros                           # os últimos registros do servidor
docker compose -f infra/docker-compose.yml --env-file .env ps
```

**Antes de colar em qualquer lugar público, apague:** o conteúdo do `.env`,
qualquer senha e o nome completo do seu endereço `.ts.net`.
