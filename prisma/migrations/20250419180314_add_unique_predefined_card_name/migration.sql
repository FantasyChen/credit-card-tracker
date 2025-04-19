/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `PredefinedCard` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "PredefinedCard_name_key" ON "PredefinedCard"("name");
