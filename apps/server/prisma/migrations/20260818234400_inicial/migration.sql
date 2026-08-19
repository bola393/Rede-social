-- CreateEnum
CREATE TYPE "Papel" AS ENUM ('ADMIN', 'MEMBRO');

-- CreateEnum
CREATE TYPE "Visibilidade" AS ENUM ('SO_EU', 'CASAL', 'CIRCULO', 'TODOS');

-- CreateEnum
CREATE TYPE "TipoDeMidia" AS ENUM ('IMAGEM', 'VIDEO', 'AUDIO', 'ARQUIVO');

-- CreateEnum
CREATE TYPE "TipoDeConversa" AS ENUM ('DIRETA', 'GRUPO');

-- CreateEnum
CREATE TYPE "ModoDeExpiracao" AS ENUM ('APOS_ENVIO', 'APOS_LEITURA');

-- CreateEnum
CREATE TYPE "TipoDeMensagem" AS ENUM ('TEXTO', 'AUDIO', 'IMAGEM', 'VIDEO', 'ARQUIVO', 'SISTEMA');

-- CreateEnum
CREATE TYPE "TipoDeChamada" AS ENUM ('VOZ', 'VIDEO');

-- CreateEnum
CREATE TYPE "StatusDaChamada" AS ENUM ('TOCANDO', 'EM_ANDAMENTO', 'ENCERRADA', 'RECUSADA', 'PERDIDA', 'FALHOU');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "apelido" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "avatar" TEXT,
    "senhaHash" TEXT NOT NULL,
    "papel" "Papel" NOT NULL DEFAULT 'MEMBRO',
    "chaveDeRecuperacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vistoPorUltimoEm" TIMESTAMP(3),
    "desativadoEm" TIMESTAMP(3),
    "conviteUsadoId" TEXT,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Aparelho" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "chavePublicaDeAssinatura" TEXT NOT NULL,
    "chavePublicaDeTroca" TEXT NOT NULL,
    "cofreCifrado" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usadoEm" TIMESTAMP(3),
    "revogadoEm" TIMESTAMP(3),
    "motivoRevogacao" TEXT,

    CONSTRAINT "Aparelho_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sessao" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "aparelhoId" TEXT,
    "tokenHash" TEXT NOT NULL,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revogadoEm" TIMESTAMP(3),
    "descricao" TEXT,

    CONSTRAINT "Sessao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Convite" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "criadoPorId" TEXT NOT NULL,
    "usosRestantes" INTEGER NOT NULL DEFAULT 1,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revogadoEm" TIMESTAMP(3),
    "observacao" TEXT,

    CONSTRAINT "Convite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Circulo" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cor" TEXT NOT NULL DEFAULT '#7c8cff',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Circulo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembroDoCirculo" (
    "circuloId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "entrouEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembroDoCirculo_pkey" PRIMARY KEY ("circuloId","usuarioId")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "corpo" TEXT NOT NULL,
    "visibilidade" "Visibilidade" NOT NULL DEFAULT 'TODOS',
    "circuloId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editadoEm" TIMESTAMP(3),
    "expiraEm" TIMESTAMP(3),

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comentario" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "corpo" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comentario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reacao" (
    "postId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reacao_pkey" PRIMARY KEY ("postId","usuarioId")
);

-- CreateTable
CREATE TABLE "Midia" (
    "id" TEXT NOT NULL,
    "donoId" TEXT NOT NULL,
    "tipo" "TipoDeMidia" NOT NULL,
    "chaveDeArmazenamento" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "tamanhoEmBytes" INTEGER NOT NULL,
    "nonce" TEXT,
    "largura" INTEGER,
    "altura" INTEGER,
    "duracaoEmMs" INTEGER,
    "ondaSonora" INTEGER[],
    "postId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiraEm" TIMESTAMP(3),

    CONSTRAINT "Midia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversa" (
    "id" TEXT NOT NULL,
    "tipo" "TipoDeConversa" NOT NULL,
    "titulo" TEXT,
    "avatar" TEXT,
    "epocaAtual" INTEGER NOT NULL DEFAULT 1,
    "expiraEmSegundos" INTEGER,
    "modoDeExpiracao" "ModoDeExpiracao" NOT NULL DEFAULT 'APOS_LEITURA',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimaAtividadeEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conversa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembroDaConversa" (
    "conversaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "admin" BOOLEAN NOT NULL DEFAULT false,
    "entrouEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "saiuEm" TIMESTAMP(3),
    "leuAte" TIMESTAMP(3),
    "silenciadoAte" TIMESTAMP(3),

    CONSTRAINT "MembroDaConversa_pkey" PRIMARY KEY ("conversaId","usuarioId")
);

-- CreateTable
CREATE TABLE "ChaveDeConversa" (
    "id" TEXT NOT NULL,
    "conversaId" TEXT NOT NULL,
    "aparelhoId" TEXT,
    "usuarioIdDeRecuperacao" TEXT,
    "epoca" INTEGER NOT NULL,
    "selada" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChaveDeConversa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mensagem" (
    "id" TEXT NOT NULL,
    "conversaId" TEXT NOT NULL,
    "remetenteId" TEXT NOT NULL,
    "tipo" "TipoDeMensagem" NOT NULL DEFAULT 'TEXTO',
    "epoca" INTEGER NOT NULL,
    "cifrado" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "midiaId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editadoEm" TIMESTAMP(3),
    "expiraEm" TIMESTAMP(3),
    "expiraEmSegundos" INTEGER,
    "modoDeExpiracao" "ModoDeExpiracao",
    "verUmaVez" BOOLEAN NOT NULL DEFAULT false,
    "apagadaEm" TIMESTAMP(3),

    CONSTRAINT "Mensagem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recibo" (
    "mensagemId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "entregueEm" TIMESTAMP(3),
    "lidoEm" TIMESTAMP(3),

    CONSTRAINT "Recibo_pkey" PRIMARY KEY ("mensagemId","usuarioId")
);

-- CreateTable
CREATE TABLE "Chamada" (
    "id" TEXT NOT NULL,
    "conversaId" TEXT NOT NULL,
    "iniciadaPorId" TEXT NOT NULL,
    "tipo" "TipoDeChamada" NOT NULL,
    "status" "StatusDaChamada" NOT NULL DEFAULT 'TOCANDO',
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atendidaEm" TIMESTAMP(3),
    "encerradaEm" TIMESTAMP(3),

    CONSTRAINT "Chamada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Registro" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT,
    "acao" TEXT NOT NULL,
    "detalhe" JSONB,
    "endereco" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Registro_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_apelido_key" ON "Usuario"("apelido");

-- CreateIndex
CREATE INDEX "Usuario_desativadoEm_idx" ON "Usuario"("desativadoEm");

-- CreateIndex
CREATE INDEX "Aparelho_usuarioId_revogadoEm_idx" ON "Aparelho"("usuarioId", "revogadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "Sessao_tokenHash_key" ON "Sessao"("tokenHash");

-- CreateIndex
CREATE INDEX "Sessao_usuarioId_revogadoEm_idx" ON "Sessao"("usuarioId", "revogadoEm");

-- CreateIndex
CREATE INDEX "Sessao_expiraEm_idx" ON "Sessao"("expiraEm");

-- CreateIndex
CREATE UNIQUE INDEX "Convite_codigo_key" ON "Convite"("codigo");

-- CreateIndex
CREATE INDEX "Convite_expiraEm_idx" ON "Convite"("expiraEm");

-- CreateIndex
CREATE UNIQUE INDEX "Circulo_nome_key" ON "Circulo"("nome");

-- CreateIndex
CREATE INDEX "MembroDoCirculo_usuarioId_idx" ON "MembroDoCirculo"("usuarioId");

-- CreateIndex
CREATE INDEX "Post_criadoEm_idx" ON "Post"("criadoEm");

-- CreateIndex
CREATE INDEX "Post_expiraEm_idx" ON "Post"("expiraEm");

-- CreateIndex
CREATE INDEX "Post_autorId_criadoEm_idx" ON "Post"("autorId", "criadoEm");

-- CreateIndex
CREATE INDEX "Comentario_postId_criadoEm_idx" ON "Comentario"("postId", "criadoEm");

-- CreateIndex
CREATE INDEX "Reacao_postId_idx" ON "Reacao"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "Midia_chaveDeArmazenamento_key" ON "Midia"("chaveDeArmazenamento");

-- CreateIndex
CREATE INDEX "Midia_postId_idx" ON "Midia"("postId");

-- CreateIndex
CREATE INDEX "Midia_expiraEm_idx" ON "Midia"("expiraEm");

-- CreateIndex
CREATE INDEX "Conversa_ultimaAtividadeEm_idx" ON "Conversa"("ultimaAtividadeEm");

-- CreateIndex
CREATE INDEX "MembroDaConversa_usuarioId_saiuEm_idx" ON "MembroDaConversa"("usuarioId", "saiuEm");

-- CreateIndex
CREATE INDEX "ChaveDeConversa_conversaId_epoca_idx" ON "ChaveDeConversa"("conversaId", "epoca");

-- CreateIndex
CREATE INDEX "ChaveDeConversa_usuarioIdDeRecuperacao_idx" ON "ChaveDeConversa"("usuarioIdDeRecuperacao");

-- CreateIndex
CREATE UNIQUE INDEX "ChaveDeConversa_conversaId_aparelhoId_epoca_key" ON "ChaveDeConversa"("conversaId", "aparelhoId", "epoca");

-- CreateIndex
CREATE UNIQUE INDEX "Mensagem_midiaId_key" ON "Mensagem"("midiaId");

-- CreateIndex
CREATE INDEX "Mensagem_conversaId_criadoEm_idx" ON "Mensagem"("conversaId", "criadoEm");

-- CreateIndex
CREATE INDEX "Mensagem_expiraEm_idx" ON "Mensagem"("expiraEm");

-- CreateIndex
CREATE INDEX "Recibo_usuarioId_idx" ON "Recibo"("usuarioId");

-- CreateIndex
CREATE INDEX "Chamada_conversaId_criadaEm_idx" ON "Chamada"("conversaId", "criadaEm");

-- CreateIndex
CREATE INDEX "Registro_criadoEm_idx" ON "Registro"("criadoEm");

-- CreateIndex
CREATE INDEX "Registro_usuarioId_criadoEm_idx" ON "Registro"("usuarioId", "criadoEm");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_conviteUsadoId_fkey" FOREIGN KEY ("conviteUsadoId") REFERENCES "Convite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Aparelho" ADD CONSTRAINT "Aparelho_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sessao" ADD CONSTRAINT "Sessao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sessao" ADD CONSTRAINT "Sessao_aparelhoId_fkey" FOREIGN KEY ("aparelhoId") REFERENCES "Aparelho"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Convite" ADD CONSTRAINT "Convite_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembroDoCirculo" ADD CONSTRAINT "MembroDoCirculo_circuloId_fkey" FOREIGN KEY ("circuloId") REFERENCES "Circulo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembroDoCirculo" ADD CONSTRAINT "MembroDoCirculo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_circuloId_fkey" FOREIGN KEY ("circuloId") REFERENCES "Circulo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comentario" ADD CONSTRAINT "Comentario_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comentario" ADD CONSTRAINT "Comentario_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reacao" ADD CONSTRAINT "Reacao_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reacao" ADD CONSTRAINT "Reacao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Midia" ADD CONSTRAINT "Midia_donoId_fkey" FOREIGN KEY ("donoId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Midia" ADD CONSTRAINT "Midia_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembroDaConversa" ADD CONSTRAINT "MembroDaConversa_conversaId_fkey" FOREIGN KEY ("conversaId") REFERENCES "Conversa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembroDaConversa" ADD CONSTRAINT "MembroDaConversa_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChaveDeConversa" ADD CONSTRAINT "ChaveDeConversa_conversaId_fkey" FOREIGN KEY ("conversaId") REFERENCES "Conversa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChaveDeConversa" ADD CONSTRAINT "ChaveDeConversa_aparelhoId_fkey" FOREIGN KEY ("aparelhoId") REFERENCES "Aparelho"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mensagem" ADD CONSTRAINT "Mensagem_conversaId_fkey" FOREIGN KEY ("conversaId") REFERENCES "Conversa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mensagem" ADD CONSTRAINT "Mensagem_remetenteId_fkey" FOREIGN KEY ("remetenteId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mensagem" ADD CONSTRAINT "Mensagem_midiaId_fkey" FOREIGN KEY ("midiaId") REFERENCES "Midia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recibo" ADD CONSTRAINT "Recibo_mensagemId_fkey" FOREIGN KEY ("mensagemId") REFERENCES "Mensagem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recibo" ADD CONSTRAINT "Recibo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chamada" ADD CONSTRAINT "Chamada_conversaId_fkey" FOREIGN KEY ("conversaId") REFERENCES "Conversa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chamada" ADD CONSTRAINT "Chamada_iniciadaPorId_fkey" FOREIGN KEY ("iniciadaPorId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registro" ADD CONSTRAINT "Registro_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
