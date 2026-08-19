/*
  Warnings:

  - You are about to drop the column `cofreCifrado` on the `Aparelho` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Convite" DROP CONSTRAINT "Convite_criadoPorId_fkey";

-- AlterTable
ALTER TABLE "Aparelho" DROP COLUMN "cofreCifrado";

-- AlterTable
ALTER TABLE "Convite" ALTER COLUMN "criadoPorId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Convite" ADD CONSTRAINT "Convite_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
