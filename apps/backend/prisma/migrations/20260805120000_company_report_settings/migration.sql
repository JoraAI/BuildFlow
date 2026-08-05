-- RPT-C2: Add report_settings JSON to companies
ALTER TABLE "companies" ADD COLUMN "report_settings" JSONB;
