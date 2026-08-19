# Migrando para uma VPS

Quando a rede deixar de ser experiência e virar coisa de que vocês dependem,
este é o caminho.

O projeto foi feito desde o primeiro dia para essa mudança ser curta: nenhum
endereço está escrito no código, o armazenamento fica atrás de uma camada
trocável, e **é o mesmo `docker-compose` dos dois lados**. Só o `.env` muda.

---

## Quando vale a pena

O que uma VPS resolve e o PC de casa não:

- **Queda de luz e de internet.** É o que mais derruba servidor caseiro, e
  ter duas máquinas em casa não ajuda — mesma tomada, mesmo provedor.
- **Ficar de pé 24 horas** sem depender de ninguém lembrar de ligar o PC.
- **Internet simétrica.** Link residencial tem upload baixo, e é justamente o
  upload que importa quando o servidor está mandando vídeo para os celulares.

O que ela custa: **R$ 30 a R$ 60 por mês**, e seus dados passam a morar numa
máquina que você aluga em vez de uma que você toca. Como tudo é criptografado
ponta-a-ponta, o provedor não consegue ler as conversas — mas ele tem acesso
físico à máquina, e vale saber disso.

---

## O que contratar

O suficiente para vocês e a família:

| Recurso | Mínimo | Confortável |
| --- | --- | --- |
| Memória | 2 GB | 4 GB |
| Processador | 1 núcleo | 2 núcleos |
| Disco | 40 GB | 80 GB |
| Sistema | Ubuntu 24.04 LTS | Ubuntu 24.04 LTS |

Escolha um data center **no Brasil** — a distância aumenta o atraso das
chamadas de vídeo, e isso se percebe na conversa.

Provedores comuns: Hetzner, DigitalOcean, Vultr, Contabo, Hostinger.

---

## Passo 1 — Um domínio

Registre um domínio (uns R$ 40 por ano no Registro.br) e aponte um subdomínio
para o IP da VPS:

```
Tipo: A
Nome: rede
Valor: 203.0.113.45     ← o IP da sua VPS
```

Fica `rede.seudominio.com.br`.

> **Dá para continuar no Tailscale**, sem domínio nenhum, mantendo o
> `MODO_TLS=tailscale`. Você perde só a possibilidade de acessar sem o
> Tailscale instalado.

---

## Passo 2 — Preparar a VPS

Conecte por SSH e rode:

```bash
# Docker
curl -fsSL https://get.docker.com | sh

# Node e pnpm
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo corepack enable

# Firewall: só o necessário fica aberto
sudo ufw allow 22/tcp       # SSH
sudo ufw allow 80,443/tcp   # a rede
sudo ufw allow 3478/udp     # TURN
sudo ufw allow 49160:49200/udp  # mídia das chamadas
sudo ufw enable
```

**Antes de sair do SSH, endureça o acesso:** desative login por senha e use
chave. Uma VPS com senha fraca é varrida por robôs em questão de horas.

```bash
sudo sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo systemctl restart ssh
```

---

## Passo 3 — Levar o projeto e os dados

Na VPS:

```bash
git clone https://github.com/bola393/Rede-social.git
cd Rede-social
pnpm install
```

Do PC antigo, mande o backup **e o `.env`**:

```bash
# no PC de casa
pnpm backup
scp -r backups/ usuario@203.0.113.45:~/Rede-social/
scp .env usuario@203.0.113.45:~/Rede-social/.env
```

> **O `.env` é indispensável.** Ele tem o `MEDIA_ENCRYPTION_KEY`, que abre as
> mídias do feed. Sem ele, as conversas voltam mas as fotos não.

---

## Passo 4 — Ajustar a configuração

Na VPS, edite o `.env` e troque **apenas** estas linhas:

```diff
- DOMINIO=pc-do-joao.tail1a2b3c.ts.net
+ DOMINIO=rede.seudominio.com.br

- MODO_TLS=tailscale
+ MODO_TLS=letsencrypt

+ EMAIL_LETSENCRYPT=voce@gmail.com

+ TURN_REALM=rede.seudominio.com.br
```

**Não troque mais nada.** Especialmente não os segredos: trocar o
`MEDIA_ENCRYPTION_KEY` torna as mídias do feed ilegíveis, sem volta.

Também ajuste o destino do backup, para a VPS mandar cópia para casa:

```diff
- BACKUP_DESTINO=notebook.seu-tailnet.ts.net
+ BACKUP_DESTINO=
```

---

## Passo 5 — Subir e restaurar

```bash
pnpm iniciar
pnpm restaurar
pnpm parar && pnpm iniciar
```

O Caddy percebe que agora existe um domínio público e pede o certificado à
Let's Encrypt sozinho — nenhuma configuração a mais.

Confira:

```bash
pnpm doutor
```

---

## Passo 6 — Apontar os celulares

O app pergunta o endereço do servidor na primeira abertura, e ele fica em
**Ajustes → Servidor**. Troque para `https://rede.seudominio.com.br` em cada
aparelho.

**Não precisa reinstalar o APK.** Foi por isso que o endereço não ficou fixo no
build.

Como as chaves privadas vivem nos aparelhos, **todo o histórico continua
legível** depois da mudança.

---

## Passo 7 — Backup na direção contrária

Agora quem guarda cópia é a sua casa. Na VPS, agende:

```bash
crontab -e
```

```cron
0 4 * * * cd ~/Rede-social && pnpm backup >> backups/registro.txt 2>&1
```

E mantenha o Tailscale rodando na VPS e no PC de casa, com
`BACKUP_DESTINO` apontando para o PC. Assim a cópia vem para uma máquina que é
fisicamente sua.

---

## Depois de migrar

O PC de casa pode ser desligado. **Guarde o último backup dele** por algumas
semanas, até ter certeza de que está tudo certo na VPS.

Quando for desativar de vez:

```bash
pnpm parar
docker compose -f infra/docker-compose.yml --env-file .env down -v
```

---

## Uma coisa que muda de verdade

Em casa, o servidor era fisicamente seu. Numa VPS, ele roda numa máquina de
outra pessoa.

Isso não expõe as conversas — elas são cifradas nos aparelhos, e o servidor
nunca teve como lê-las. Mas o provedor tem acesso ao disco, e portanto aos
**metadados**: quem tem conta, quem conversa com quem, e quando.

Para a maioria das famílias essa troca vale muito a pena. Vale fazer a escolha
sabendo o que ela é.
