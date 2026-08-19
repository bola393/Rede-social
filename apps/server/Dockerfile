# ═══════════════════════════════════════════════════════════════════════════
#  Imagem do servidor
#
#  Debian slim, e não Alpine: o `argon2` (que protege as senhas) é código
#  nativo, e as versões pré-compiladas dele são feitas para a libc do Debian.
#  No Alpine ele teria que ser compilado do zero a cada build — lento, e uma
#  fonte de erros bem difíceis de entender.
# ═══════════════════════════════════════════════════════════════════════════

FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
# Build de container não tem terminal interativo. Sem isto, o pnpm se recusa a
# limpar o node_modules ao instalar só as dependências de produção, e para com
# um ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY.
ENV CI=true
RUN corepack enable && \
    apt-get update && \
    apt-get install -y --no-install-recommends openssl ca-certificates && \
    rm -rf /var/lib/apt/lists/*
WORKDIR /app


# ─── Dependências ──────────────────────────────────────────────────────────
# Só os package.json primeiro. Assim o Docker reaproveita esta camada inteira
# enquanto as dependências não mudarem, mesmo que o código mude o tempo todo.
FROM base AS dependencias
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/server/package.json apps/server/
COPY packages/shared/package.json packages/shared/
COPY packages/crypto/package.json packages/crypto/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile


# ─── Build ─────────────────────────────────────────────────────────────────
FROM dependencias AS build
COPY . .
RUN pnpm --filter @rede/server db:generate && \
    pnpm --filter @rede/server build


# ─── Dependências de produção ──────────────────────────────────────────────
# Refeitas sem as de desenvolvimento, para a imagem final não carregar
# TypeScript, vitest e companhia.
FROM dependencias AS dependencias-producao
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod


# ─── Imagem final ──────────────────────────────────────────────────────────
FROM base AS producao
ENV NODE_ENV=production

# O `--chown=node:node` não é detalhe: o container roda como `node`, e o CLI do
# Prisma precisa escrever dentro de node_modules ao aplicar as migrações. Sem
# isto ele falha com "Can't write to ... please make sure you install prisma
# with the right permissions", que não deixa nada claro sobre a causa real.
COPY --from=dependencias-producao --chown=node:node /app/node_modules ./node_modules
COPY --from=dependencias-producao --chown=node:node /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=build --chown=node:node /app/apps/server/dist ./apps/server/dist
COPY --from=build --chown=node:node /app/apps/server/prisma ./apps/server/prisma
# O cliente gerado do Prisma, junto com o binário que fala com o Postgres.
COPY --from=build --chown=node:node /app/apps/server/gerado ./apps/server/gerado

WORKDIR /app/apps/server

# Não rodar como root. Se algum dia alguém escapar do processo do Node, que
# caia num usuário sem poder nenhum.
USER node

EXPOSE 3000

# O Docker reinicia o container sozinho se isto começar a falhar.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORTA_SERVIDOR||3000)+'/api/saude').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Aplica as migrações pendentes e só então sobe.
#
# Assim uma atualização do projeto nunca exige que você rode comando de banco
# na mão: você clica no INICIAR.bat e o resto acontece. O `migrate deploy` só
# aplica migrações já existentes — ele nunca cria nem apaga nada por conta
# própria, que é justamente o que se quer em produção.
#
# Se uma migração falhar, o servidor não sobe. É de propósito: melhor a rede
# fora do ar com um erro claro no registro do que no ar com o banco em meio
# caminho.
CMD ["sh", "-c", "npx prisma migrate deploy && exec node dist/index.js"]
