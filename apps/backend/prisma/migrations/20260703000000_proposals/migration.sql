-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'SENT', 'WON', 'LOST', 'ARCHIVED');

-- AlterTable
ALTER TABLE "projects" ADD COLUMN "is_temporary" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "projects" ADD COLUMN "proposal_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "projects_proposal_id_key" ON "projects"("proposal_id");
CREATE INDEX "projects_is_temporary_idx" ON "projects"("is_temporary");

-- CreateTable
CREATE TABLE "proposals" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "client_name" TEXT NOT NULL,
    "client_contact" TEXT,
    "project_type" "ProjectType" NOT NULL,
    "status" "ProposalStatus" NOT NULL DEFAULT 'DRAFT',
    "temporary_project_id" UUID NOT NULL,
    "promoted_project_id" UUID,
    "valid_until" DATE,
    "notes" TEXT,
    "rejection_reason" TEXT,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proposals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "proposals_temporary_project_id_key" ON "proposals"("temporary_project_id");
CREATE UNIQUE INDEX "proposals_promoted_project_id_key" ON "proposals"("promoted_project_id");
CREATE INDEX "proposals_company_id_idx" ON "proposals"("company_id");
CREATE INDEX "proposals_status_idx" ON "proposals"("status");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "proposals" ADD CONSTRAINT "proposals_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_temporary_project_id_fkey" FOREIGN KEY ("temporary_project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_promoted_project_id_fkey" FOREIGN KEY ("promoted_project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
