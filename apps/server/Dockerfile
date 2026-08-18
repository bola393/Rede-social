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

COPY --from=dependencias-producao /app/node_modules ./node_modules
COPY --from=dependencias-producao /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/apps/server/prisma ./apps/server/prisma
# O cliente gerado do Prisma, que sabe falar com o nosso schema.
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma

WORKDIR /app/apps/server

# Não rodar como root. Se algum dia alguém escapar do processo do Node, que
# caia num usuário sem poder nenhum.
USER node

EXPOSE 3000

# O Docker reinicia o container sozinho se isto começar a falhar.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORTA_SERVIDOR||3000)+'/api/saude').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
