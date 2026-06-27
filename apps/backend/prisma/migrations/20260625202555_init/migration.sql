-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'PM', 'SUPERVISOR', 'ACCOUNTANT');

-- CreateEnum
CREATE TYPE "ProjectType" AS ENUM ('HEAVY', 'LARGE', 'MID', 'MINI');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('PLANNING', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'DELAYED', 'ON_HOLD');

-- CreateEnum
CREATE TYPE "DependencyType" AS ENUM ('FS', 'SS', 'FF', 'SF');

-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('LABOUR', 'MATERIAL', 'EQUIPMENT', 'SUBCONTRACTOR');

-- CreateEnum
CREATE TYPE "CostType" AS ENUM ('MATERIAL', 'LABOUR', 'EQUIPMENT', 'SUBCONTRACTOR', 'MISC');

-- CreateEnum
CREATE TYPE "EstimateStatus" AS ENUM ('DRAFT', 'REVIEWED', 'APPROVED', 'REJECTED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PAID', 'OVERDUE');

-- CreateEnum
CREATE TYPE "BillStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID', 'REJECTED');

-- CreateEnum
CREATE TYPE "BillCategory" AS ENUM ('MATERIAL', 'LABOUR', 'EQUIPMENT', 'SUBCONTRACTOR', 'OTHER');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'IMAGE', 'FILE');

-- CreateEnum
CREATE TYPE "TaskConstraintType" AS ENUM ('ASAP', 'ALAP', 'MUST_START_ON', 'MUST_FINISH_ON', 'START_NO_EARLIER_THAN', 'START_NO_LATER_THAN');

-- CreateTable
CREATE TABLE "companies" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "gstin" TEXT NOT NULL,
    "pan" TEXT NOT NULL,
    "address" TEXT,
    "logo_url" TEXT,
    "state" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'PM',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notification_prefs" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "ProjectType" NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'PLANNING',
    "client_name" TEXT NOT NULL,
    "client_contact" TEXT,
    "location_lat" DOUBLE PRECISION,
    "location_lng" DOUBLE PRECISION,
    "location_address" TEXT,
    "start_date" DATE,
    "end_date" DATE,
    "budget" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wbs_items" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "parent_id" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "order_index" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "wbs_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "wbs_id" UUID,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "start_date" DATE,
    "end_date" DATE,
    "duration_days" INTEGER NOT NULL DEFAULT 1,
    "progress_pct" INTEGER NOT NULL DEFAULT 0,
    "status" "TaskStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "assigned_to" UUID,
    "constraint_type" "TaskConstraintType",
    "is_milestone" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_predecessors" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "predecessor_id" UUID NOT NULL,
    "type" "DependencyType" NOT NULL DEFAULT 'FS',
    "lag_days" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "task_predecessors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resources" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ResourceType" NOT NULL,
    "unit" TEXT NOT NULL,
    "rate" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "gst_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "hsn_sac_code" TEXT,
    "brand_or_spec" TEXT,
    "category" TEXT,
    "last_rate_updated_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_resources" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "resource_id" UUID NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit" TEXT NOT NULL,
    "rate" DECIMAL(12,2) NOT NULL,
    "total_cost" DECIMAL(14,2) NOT NULL DEFAULT 0,

    CONSTRAINT "task_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boq_items" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "wbs_id" UUID,
    "item_code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "rate" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "category" TEXT,
    "estimate_item_id" UUID,
    "is_superseded" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "boq_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimates" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "EstimateStatus" NOT NULL DEFAULT 'DRAFT',
    "total_material_cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_labour_cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_equipment_cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_subcontractor_cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_misc_cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "overhead_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "overhead_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "contingency_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "contingency_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "profit_margin_pct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "profit_margin_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "gst_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "grand_total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "rejection_reason" TEXT,
    "approved_by" UUID,
    "approved_at" TIMESTAMP(3),
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "estimates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimate_sections" (
    "id" UUID NOT NULL,
    "estimate_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,

    CONSTRAINT "estimate_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimate_items" (
    "id" UUID NOT NULL,
    "estimate_id" UUID NOT NULL,
    "section_id" UUID NOT NULL,
    "wbs_item_id" UUID,
    "item_code" TEXT,
    "description" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "resource_id" UUID,
    "rate" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "type" "CostType" NOT NULL DEFAULT 'MISC',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estimate_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_analyses" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "description" TEXT,
    "total_rate" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "stale" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_analysis_components" (
    "id" UUID NOT NULL,
    "rate_analysis_id" UUID NOT NULL,
    "resource_id" UUID,
    "misc_name" TEXT,
    "quantity_per_unit" DECIMAL(12,4) NOT NULL,
    "unit" TEXT NOT NULL,
    "rate" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "type" "CostType" NOT NULL DEFAULT 'MISC',

    CONSTRAINT "rate_analysis_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_price_history" (
    "id" UUID NOT NULL,
    "resource_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "rate" DECIMAL(12,2) NOT NULL,
    "effective_date" DATE NOT NULL,
    "notes" TEXT,
    "recorded_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_price_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_reports" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "reported_by" UUID NOT NULL,
    "report_date" DATE NOT NULL,
    "weather" TEXT,
    "work_done" TEXT,
    "issues" TEXT,
    "photos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "workers_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_usages" (
    "id" UUID NOT NULL,
    "daily_report_id" UUID NOT NULL,
    "resource_id" UUID NOT NULL,
    "quantity_used" DECIMAL(12,3) NOT NULL,
    "notes" TEXT,

    CONSTRAINT "material_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendances" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "check_in_at" TIMESTAMP(3) NOT NULL,
    "check_out_at" TIMESTAMP(3),
    "check_in_lat" DOUBLE PRECISION NOT NULL,
    "check_in_lng" DOUBLE PRECISION NOT NULL,
    "distance_from_site" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "within_fence" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,

    CONSTRAINT "attendances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "client_name" TEXT NOT NULL,
    "client_gstin" TEXT,
    "invoice_date" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "gst_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "gst_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "cgst_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "sgst_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "igst_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tds_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "tds_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "paid_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "notes" TEXT,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_line_items" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "boq_item_id" UUID,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit" TEXT NOT NULL,
    "rate" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "gst_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "hsn_sac_code" TEXT,

    CONSTRAINT "invoice_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bills" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "bill_number" TEXT NOT NULL,
    "vendor_name" TEXT NOT NULL,
    "vendor_gstin" TEXT,
    "bill_date" DATE NOT NULL,
    "due_date" DATE,
    "status" "BillStatus" NOT NULL DEFAULT 'PENDING',
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "gst_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "tds_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "tds_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "category" "BillCategory" NOT NULL DEFAULT 'OTHER',
    "attachment_url" TEXT,
    "approved_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "project_id" UUID,
    "entry_date" DATE NOT NULL,
    "description" TEXT,
    "reference" TEXT,
    "debit_account" TEXT NOT NULL,
    "credit_account" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "project_id" UUID,
    "message" TEXT NOT NULL,
    "message_type" "MessageType" NOT NULL DEFAULT 'TEXT',
    "file_url" TEXT,
    "is_bot" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "reference_id" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "oldValue" JSONB,
    "new_value" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "companies_gstin_key" ON "companies"("gstin");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_company_id_idx" ON "users"("company_id");

-- CreateIndex
CREATE INDEX "projects_company_id_idx" ON "projects"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "projects_company_id_code_key" ON "projects"("company_id", "code");

-- CreateIndex
CREATE INDEX "wbs_items_project_id_idx" ON "wbs_items"("project_id");

-- CreateIndex
CREATE INDEX "wbs_items_parent_id_idx" ON "wbs_items"("parent_id");

-- CreateIndex
CREATE INDEX "tasks_project_id_idx" ON "tasks"("project_id");

-- CreateIndex
CREATE INDEX "tasks_wbs_id_idx" ON "tasks"("wbs_id");

-- CreateIndex
CREATE INDEX "tasks_status_idx" ON "tasks"("status");

-- CreateIndex
CREATE UNIQUE INDEX "task_predecessors_task_id_predecessor_id_key" ON "task_predecessors"("task_id", "predecessor_id");

-- CreateIndex
CREATE INDEX "resources_company_id_idx" ON "resources"("company_id");

-- CreateIndex
CREATE INDEX "resources_type_idx" ON "resources"("type");

-- CreateIndex
CREATE UNIQUE INDEX "resources_company_id_name_type_key" ON "resources"("company_id", "name", "type");

-- CreateIndex
CREATE UNIQUE INDEX "task_resources_task_id_resource_id_key" ON "task_resources"("task_id", "resource_id");

-- CreateIndex
CREATE UNIQUE INDEX "boq_items_estimate_item_id_key" ON "boq_items"("estimate_item_id");

-- CreateIndex
CREATE INDEX "boq_items_project_id_idx" ON "boq_items"("project_id");

-- CreateIndex
CREATE INDEX "boq_items_category_idx" ON "boq_items"("category");

-- CreateIndex
CREATE INDEX "estimates_project_id_idx" ON "estimates"("project_id");

-- CreateIndex
CREATE INDEX "estimates_company_id_idx" ON "estimates"("company_id");

-- CreateIndex
CREATE INDEX "estimates_status_idx" ON "estimates"("status");

-- CreateIndex
CREATE INDEX "estimate_sections_estimate_id_idx" ON "estimate_sections"("estimate_id");

-- CreateIndex
CREATE INDEX "estimate_items_estimate_id_idx" ON "estimate_items"("estimate_id");

-- CreateIndex
CREATE INDEX "estimate_items_section_id_idx" ON "estimate_items"("section_id");

-- CreateIndex
CREATE INDEX "estimate_items_type_idx" ON "estimate_items"("type");

-- CreateIndex
CREATE INDEX "rate_analyses_company_id_idx" ON "rate_analyses"("company_id");

-- CreateIndex
CREATE INDEX "rate_analysis_components_rate_analysis_id_idx" ON "rate_analysis_components"("rate_analysis_id");

-- CreateIndex
CREATE INDEX "material_price_history_resource_id_idx" ON "material_price_history"("resource_id");

-- CreateIndex
CREATE INDEX "material_price_history_company_id_idx" ON "material_price_history"("company_id");

-- CreateIndex
CREATE INDEX "daily_reports_project_id_idx" ON "daily_reports"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "daily_reports_project_id_report_date_key" ON "daily_reports"("project_id", "report_date");

-- CreateIndex
CREATE INDEX "material_usages_daily_report_id_idx" ON "material_usages"("daily_report_id");

-- CreateIndex
CREATE INDEX "attendances_project_id_idx" ON "attendances"("project_id");

-- CreateIndex
CREATE INDEX "attendances_user_id_idx" ON "attendances"("user_id");

-- CreateIndex
CREATE INDEX "attendances_check_in_at_idx" ON "attendances"("check_in_at");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoice_number_key" ON "invoices"("invoice_number");

-- CreateIndex
CREATE INDEX "invoices_project_id_idx" ON "invoices"("project_id");

-- CreateIndex
CREATE INDEX "invoices_company_id_idx" ON "invoices"("company_id");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE INDEX "invoice_line_items_invoice_id_idx" ON "invoice_line_items"("invoice_id");

-- CreateIndex
CREATE INDEX "bills_project_id_idx" ON "bills"("project_id");

-- CreateIndex
CREATE INDEX "bills_status_idx" ON "bills"("status");

-- CreateIndex
CREATE UNIQUE INDEX "bills_company_id_bill_number_key" ON "bills"("company_id", "bill_number");

-- CreateIndex
CREATE INDEX "journal_entries_company_id_idx" ON "journal_entries"("company_id");

-- CreateIndex
CREATE INDEX "journal_entries_project_id_idx" ON "journal_entries"("project_id");

-- CreateIndex
CREATE INDEX "chat_messages_company_id_idx" ON "chat_messages"("company_id");

-- CreateIndex
CREATE INDEX "chat_messages_project_id_idx" ON "chat_messages"("project_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "notifications_is_read_idx" ON "notifications"("is_read");

-- CreateIndex
CREATE INDEX "audit_logs_company_id_idx" ON "audit_logs"("company_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wbs_items" ADD CONSTRAINT "wbs_items_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wbs_items" ADD CONSTRAINT "wbs_items_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "wbs_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_wbs_id_fkey" FOREIGN KEY ("wbs_id") REFERENCES "wbs_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_predecessors" ADD CONSTRAINT "task_predecessors_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_predecessors" ADD CONSTRAINT "task_predecessors_predecessor_id_fkey" FOREIGN KEY ("predecessor_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_resources" ADD CONSTRAINT "task_resources_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_resources" ADD CONSTRAINT "task_resources_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boq_items" ADD CONSTRAINT "boq_items_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boq_items" ADD CONSTRAINT "boq_items_wbs_id_fkey" FOREIGN KEY ("wbs_id") REFERENCES "wbs_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boq_items" ADD CONSTRAINT "boq_items_estimate_item_id_fkey" FOREIGN KEY ("estimate_item_id") REFERENCES "estimate_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_sections" ADD CONSTRAINT "estimate_sections_estimate_id_fkey" FOREIGN KEY ("estimate_id") REFERENCES "estimates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_items" ADD CONSTRAINT "estimate_items_estimate_id_fkey" FOREIGN KEY ("estimate_id") REFERENCES "estimates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_items" ADD CONSTRAINT "estimate_items_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "estimate_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_items" ADD CONSTRAINT "estimate_items_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_analyses" ADD CONSTRAINT "rate_analyses_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_analysis_components" ADD CONSTRAINT "rate_analysis_components_rate_analysis_id_fkey" FOREIGN KEY ("rate_analysis_id") REFERENCES "rate_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_analysis_components" ADD CONSTRAINT "rate_analysis_components_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_price_history" ADD CONSTRAINT "material_price_history_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_price_history" ADD CONSTRAINT "material_price_history_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_price_history" ADD CONSTRAINT "material_price_history_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_reports" ADD CONSTRAINT "daily_reports_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_reports" ADD CONSTRAINT "daily_reports_reported_by_fkey" FOREIGN KEY ("reported_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_usages" ADD CONSTRAINT "material_usages_daily_report_id_fkey" FOREIGN KEY ("daily_report_id") REFERENCES "daily_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_usages" ADD CONSTRAINT "material_usages_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_boq_item_id_fkey" FOREIGN KEY ("boq_item_id") REFERENCES "boq_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
