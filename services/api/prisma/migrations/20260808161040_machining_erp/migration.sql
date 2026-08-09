-- CreateEnum
CREATE TYPE "login_audience" AS ENUM ('INTERNAL', 'PORTAL');

-- CreateEnum
CREATE TYPE "employment_status" AS ENUM ('ACTIVE', 'LEFT');

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('PENDING', 'ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "request_status" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "password_reset_status" AS ENUM ('SUBMITTED', 'RESET_DONE', 'REJECTED');

-- CreateEnum
CREATE TYPE "number_reset_policy" AS ENUM ('NONE', 'DAILY', 'MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "timeline_node_status" AS ENUM ('PENDING', 'IN_PROGRESS', 'DONE', 'ABNORMAL');

-- CreateEnum
CREATE TYPE "approval_task_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "approval_instance_status" AS ENUM ('RUNNING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "data_scope_type" AS ENUM ('ALL', 'DEPARTMENT', 'DEPARTMENT_AND_BELOW', 'SELF', 'ASSIGNED_CUSTOMERS');

-- CreateEnum
CREATE TYPE "customer_region" AS ENUM ('DOMESTIC', 'OVERSEAS');

-- CreateEnum
CREATE TYPE "customer_status" AS ENUM ('DRAFT', 'PENDING', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "payment_term" AS ENUM ('DEPOSIT_THEN_BALANCE', 'CASH_BEFORE_SHIPMENT', 'NET_30', 'NET_60', 'NET_90');

-- CreateEnum
CREATE TYPE "invoice_type" AS ENUM ('GENERAL', 'SPECIAL');

-- CreateEnum
CREATE TYPE "settlement_method" AS ENUM ('CASH', 'NOTE');

-- CreateEnum
CREATE TYPE "drawing_source" AS ENUM ('QUOTATION', 'ECN', 'ENGINEERING');

-- CreateEnum
CREATE TYPE "cost_analysis_status" AS ENUM ('DRAFT', 'COMPLETED', 'LOCKED');

-- CreateEnum
CREATE TYPE "quotation_status" AS ENUM ('DRAFT', 'IN_REVIEW', 'EFFECTIVE', 'WON', 'LOST', 'EXPIRED');

-- CreateEnum
CREATE TYPE "quote_change_status" AS ENUM ('SUBMITTED', 'REVISED', 'REJECTED');

-- CreateTable
CREATE TABLE "departments" (
    "id" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "short_name" VARCHAR(32),
    "parent_id" UUID,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" VARCHAR(32),
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" VARCHAR(32),
    "deleted_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issued_user_codes" (
    "code" VARCHAR(32) NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" VARCHAR(32) NOT NULL DEFAULT 'ACCOUNT_REQUEST',
    "note" VARCHAR(255),

    CONSTRAINT "issued_user_codes_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "user_code" VARCHAR(32) NOT NULL,
    "account" VARCHAR(32),
    "audience" "login_audience" NOT NULL DEFAULT 'INTERNAL',
    "former_account" VARCHAR(32),
    "account_released_at" TIMESTAMP(3),
    "display_name" VARCHAR(64) NOT NULL,
    "department_id" UUID,
    "contact" VARCHAR(64),
    "email" VARCHAR(128),
    "password_hash" VARCHAR(255) NOT NULL,
    "status" "user_status" NOT NULL DEFAULT 'ACTIVE',
    "employment_status" "employment_status" NOT NULL DEFAULT 'ACTIVE',
    "left_at" TIMESTAMP(3),
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" VARCHAR(32),
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" VARCHAR(32),
    "deleted_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "code" VARCHAR(48) NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "description" VARCHAR(255),
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" VARCHAR(32),
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" VARCHAR(32),
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "category" VARCHAR(32) NOT NULL,
    "description" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "granted_by" VARCHAR(32),

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "granted_by" VARCHAR(32),

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "data_scopes" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "role_id" UUID,
    "resource" VARCHAR(48) NOT NULL,
    "type" "data_scope_type" NOT NULL,
    "values" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_scopes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_id" VARCHAR(64) NOT NULL,
    "audience" "login_audience" NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "ip" VARCHAR(64),
    "user_agent" VARCHAR(255),

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_attempts" (
    "id" UUID NOT NULL,
    "audience" "login_audience" NOT NULL,
    "account" VARCHAR(32) NOT NULL,
    "failure_count" INTEGER NOT NULL DEFAULT 0,
    "last_failed_at" TIMESTAMP(3),
    "locked_until" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "captcha_challenges" (
    "id" UUID NOT NULL,
    "code" VARCHAR(16) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "ip" VARCHAR(64),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "captcha_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_requests" (
    "id" UUID NOT NULL,
    "request_no" VARCHAR(32) NOT NULL,
    "employee_name" VARCHAR(64) NOT NULL,
    "department" VARCHAR(64) NOT NULL,
    "department_id" UUID,
    "account" VARCHAR(32) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "contact" VARCHAR(64),
    "reason" VARCHAR(500),
    "user_code" VARCHAR(32) NOT NULL,
    "reused_from" VARCHAR(128),
    "status" "request_status" NOT NULL DEFAULT 'SUBMITTED',
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMP(3),
    "decided_by" VARCHAR(32),
    "reject_reason" VARCHAR(500),
    "approved_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "account_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_requests" (
    "id" UUID NOT NULL,
    "request_no" VARCHAR(32) NOT NULL,
    "audience" "login_audience" NOT NULL,
    "account" VARCHAR(32) NOT NULL,
    "applicant_name" VARCHAR(64) NOT NULL,
    "department" VARCHAR(64) NOT NULL,
    "contact" VARCHAR(64) NOT NULL,
    "reason" VARCHAR(500),
    "status" "password_reset_status" NOT NULL DEFAULT 'SUBMITTED',
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "handled_at" TIMESTAMP(3),
    "handled_by" VARCHAR(32),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "password_reset_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doc_number_rules" (
    "id" UUID NOT NULL,
    "doc_type" VARCHAR(32) NOT NULL,
    "prefix" VARCHAR(16) NOT NULL,
    "date_pattern" VARCHAR(16) NOT NULL DEFAULT 'yyyyMMdd',
    "padding" INTEGER NOT NULL DEFAULT 4,
    "reset_policy" "number_reset_policy" NOT NULL DEFAULT 'DAILY',
    "separator" VARCHAR(4) NOT NULL DEFAULT '',
    "description" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doc_number_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doc_number_sequences" (
    "id" UUID NOT NULL,
    "doc_type" VARCHAR(32) NOT NULL,
    "period_key" VARCHAR(16) NOT NULL,
    "last_value" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doc_number_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_user_code" VARCHAR(32),
    "action" VARCHAR(64) NOT NULL,
    "entity_type" VARCHAR(64) NOT NULL,
    "entity_id" VARCHAR(64),
    "before" JSONB,
    "after" JSONB,
    "ip" VARCHAR(64),
    "trace_id" VARCHAR(64),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doc_timelines" (
    "id" UUID NOT NULL,
    "doc_type" VARCHAR(32) NOT NULL,
    "doc_id" VARCHAR(64) NOT NULL,
    "node" VARCHAR(64) NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "status" "timeline_node_status" NOT NULL DEFAULT 'IN_PROGRESS',
    "entered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "left_at" TIMESTAMP(3),
    "duration_ms" BIGINT,
    "owner_user_code" VARCHAR(32),
    "owner_dept" VARCHAR(64),
    "remark" VARCHAR(500),

    CONSTRAINT "doc_timelines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "event_id" VARCHAR(64) NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "payload" JSONB NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trace_id" VARCHAR(64),
    "published_at" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" VARCHAR(500),

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_records" (
    "id" UUID NOT NULL,
    "scope" VARCHAR(64) NOT NULL,
    "key" VARCHAR(128) NOT NULL,
    "request_hash" VARCHAR(64) NOT NULL,
    "response_body" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_flows" (
    "id" UUID NOT NULL,
    "code" VARCHAR(48) NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "doc_type" VARCHAR(32) NOT NULL,
    "description" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "approval_flows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_flow_steps" (
    "id" UUID NOT NULL,
    "flow_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "role_code" VARCHAR(48) NOT NULL,
    "sla_hours" INTEGER,
    "condition" JSONB,

    CONSTRAINT "approval_flow_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_instances" (
    "id" UUID NOT NULL,
    "flow_id" UUID NOT NULL,
    "doc_type" VARCHAR(32) NOT NULL,
    "doc_id" VARCHAR(64) NOT NULL,
    "doc_no" VARCHAR(32),
    "status" "approval_instance_status" NOT NULL DEFAULT 'RUNNING',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "approval_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_tasks" (
    "id" UUID NOT NULL,
    "instance_id" UUID NOT NULL,
    "step_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "status" "approval_task_status" NOT NULL DEFAULT 'PENDING',
    "assignee_role" VARCHAR(48) NOT NULL,
    "decided_by" VARCHAR(32),
    "decided_at" TIMESTAMP(3),
    "comment" VARCHAR(500),
    "arrived_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duration_ms" BIGINT,

    CONSTRAINT "approval_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "recipient_user_code" VARCHAR(32) NOT NULL,
    "category" VARCHAR(48) NOT NULL,
    "title" VARCHAR(128) NOT NULL,
    "body" VARCHAR(1000),
    "link" VARCHAR(255),
    "doc_type" VARCHAR(32),
    "doc_id" VARCHAR(64),
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "short_name" VARCHAR(64) NOT NULL,
    "region" "customer_region" NOT NULL,
    "country" VARCHAR(64) NOT NULL,
    "english_name" VARCHAR(128),
    "english_address" VARCHAR(255),
    "owner_name" VARCHAR(64) NOT NULL,
    "owner_phone" VARCHAR(64) NOT NULL,
    "owner_email" VARCHAR(128),
    "sales_user_code" VARCHAR(32),
    "tax_no" VARCHAR(64),
    "invoice_address" VARCHAR(255) NOT NULL,
    "bank_account" VARCHAR(64),
    "bank_name" VARCHAR(128),
    "payment_term" "payment_term" NOT NULL,
    "deposit_bps" INTEGER,
    "invoice_type" "invoice_type" NOT NULL,
    "settlement" "settlement_method" NOT NULL,
    "currency" VARCHAR(8) NOT NULL DEFAULT 'CNY',
    "trade_term" VARCHAR(64),
    "level" VARCHAR(32),
    "hk_pricing_enabled" BOOLEAN NOT NULL DEFAULT false,
    "hk_factor_bps" INTEGER NOT NULL DEFAULT 10000,
    "hk_effective_from" TIMESTAMP(3),
    "hk_applied_by" VARCHAR(32),
    "hk_approved_by" VARCHAR(32),
    "hk_change_reason" VARCHAR(255),
    "status" "customer_status" NOT NULL DEFAULT 'DRAFT',
    "approved_by" VARCHAR(32),
    "approved_at" TIMESTAMP(3),
    "credit_limit_minor" BIGINT NOT NULL DEFAULT 0,
    "credit_used_minor" BIGINT NOT NULL DEFAULT 0,
    "overdue_amount_minor" BIGINT NOT NULL DEFAULT 0,
    "ar_days" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" VARCHAR(32),
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" VARCHAR(32),
    "deleted_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_delivery_addresses" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "label" VARCHAR(64) NOT NULL,
    "receiver" VARCHAR(64) NOT NULL,
    "phone" VARCHAR(64) NOT NULL,
    "address" VARCHAR(255) NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_delivery_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_change_requests" (
    "id" UUID NOT NULL,
    "request_no" VARCHAR(32) NOT NULL,
    "customer_id" UUID NOT NULL,
    "changes" JSONB NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "status" "request_status" NOT NULL DEFAULT 'SUBMITTED',
    "submitted_by" VARCHAR(32) NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_by" VARCHAR(32),
    "decided_at" TIMESTAMP(3),
    "reject_reason" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "customer_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_prices" (
    "id" UUID NOT NULL,
    "material" VARCHAR(64) NOT NULL,
    "shape" VARCHAR(32) NOT NULL,
    "unit_price_minor" BIGINT NOT NULL,
    "currency" VARCHAR(8) NOT NULL DEFAULT 'CNY',
    "effective_from" TIMESTAMP(3) NOT NULL,
    "source" VARCHAR(64) NOT NULL,
    "remark" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" VARCHAR(32),
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "material_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_rates" (
    "id" UUID NOT NULL,
    "base" VARCHAR(8) NOT NULL,
    "quote" VARCHAR(8) NOT NULL,
    "rate_micros" BIGINT NOT NULL,
    "quoted_on" TIMESTAMP(3) NOT NULL,
    "source" VARCHAR(32) NOT NULL DEFAULT 'MANUAL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" VARCHAR(32),

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drawings" (
    "id" UUID NOT NULL,
    "drawing_no" VARCHAR(64) NOT NULL,
    "customer_id" UUID,
    "title" VARCHAR(128),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" VARCHAR(32),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drawings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drawing_versions" (
    "id" UUID NOT NULL,
    "drawing_id" UUID NOT NULL,
    "revision" VARCHAR(32) NOT NULL,
    "sequence" INTEGER NOT NULL,
    "source" "drawing_source" NOT NULL DEFAULT 'QUOTATION',
    "file_key" VARCHAR(255) NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "uploaded_by" VARCHAR(32) NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "drawing_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_analyses" (
    "id" UUID NOT NULL,
    "doc_no" VARCHAR(32) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "root_id" UUID,
    "customer_id" UUID NOT NULL,
    "product_model" VARCHAR(128) NOT NULL,
    "loss_bps" INTEGER NOT NULL DEFAULT 500,
    "overhead_bps" INTEGER NOT NULL DEFAULT 500,
    "vat_bps" INTEGER NOT NULL DEFAULT 1300,
    "currency" VARCHAR(8) NOT NULL DEFAULT 'CNY',
    "process_columns" JSONB NOT NULL,
    "status" "cost_analysis_status" NOT NULL DEFAULT 'DRAFT',
    "prepared_by" VARCHAR(32) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" VARCHAR(32),
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" VARCHAR(32),
    "version_lock" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "cost_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_analysis_lines" (
    "id" UUID NOT NULL,
    "cost_analysis_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "blank_type" VARCHAR(32) NOT NULL,
    "drawing_no" VARCHAR(128) NOT NULL,
    "drawing_version_id" UUID,
    "spec" VARCHAR(64) NOT NULL,
    "revision" VARCHAR(32),
    "quantity" DECIMAL(18,6) NOT NULL DEFAULT 1,
    "material" VARCHAR(64) NOT NULL,
    "estimated_weight_kg" DECIMAL(18,6) NOT NULL,
    "net_weight_kg" DECIMAL(18,6) NOT NULL,
    "scrap_weight_kg" DECIMAL(18,6) NOT NULL,
    "scrap_unit_price_minor" BIGINT NOT NULL DEFAULT 0,
    "material_unit_price_minor" BIGINT NOT NULL,
    "material_price_overridden" BOOLEAN NOT NULL DEFAULT false,
    "material_price_source_id" UUID,
    "machining_method" VARCHAR(32) NOT NULL,
    "machining_minutes" DECIMAL(18,6) NOT NULL,
    "machining_cost_minor" BIGINT NOT NULL,
    "process_costs" JSONB NOT NULL,
    "remark" VARCHAR(255),

    CONSTRAINT "cost_analysis_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotations" (
    "id" UUID NOT NULL,
    "doc_no" VARCHAR(32) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "root_id" UUID,
    "customer_id" UUID NOT NULL,
    "cost_analysis_id" UUID NOT NULL,
    "template" VARCHAR(16) NOT NULL DEFAULT 'DOMESTIC',
    "currency" VARCHAR(8) NOT NULL DEFAULT 'CNY',
    "fx_rate_micros" BIGINT,
    "fx_quoted_on" TIMESTAMP(3),
    "mold_fee_minor" BIGINT NOT NULL DEFAULT 0,
    "terms" JSONB,
    "status" "quotation_status" NOT NULL DEFAULT 'DRAFT',
    "valid_until" TIMESTAMP(3),
    "submitted_by" VARCHAR(32),
    "submitted_at" TIMESTAMP(3),
    "approved_by" VARCHAR(32),
    "approved_at" TIMESTAMP(3),
    "reject_reason" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" VARCHAR(32),
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" VARCHAR(32),
    "version_lock" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "quotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_items" (
    "id" UUID NOT NULL,
    "quotation_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "product_name" VARCHAR(128) NOT NULL,
    "drawing_no" VARCHAR(128) NOT NULL,
    "drawing_version_id" UUID,
    "revision" VARCHAR(32),
    "material" VARCHAR(64),
    "finishing" VARCHAR(64),
    "process" VARCHAR(64),
    "cost_analysis_line_id" UUID,
    "remark" VARCHAR(255),

    CONSTRAINT "quotation_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_tiers" (
    "id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "min_quantity" DECIMAL(18,6) NOT NULL,
    "unit_price_minor" BIGINT NOT NULL,
    "unit_cost_minor" BIGINT NOT NULL,
    "label" VARCHAR(32),

    CONSTRAINT "quotation_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_change_requests" (
    "id" UUID NOT NULL,
    "request_no" VARCHAR(32) NOT NULL,
    "quotation_id" UUID NOT NULL,
    "target_prices" JSONB NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "status" "quote_change_status" NOT NULL DEFAULT 'SUBMITTED',
    "submitted_by" VARCHAR(32) NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "handled_by" VARCHAR(32),
    "handled_at" TIMESTAMP(3),
    "reject_reason" VARCHAR(500),
    "revised_cost_analysis_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version_lock" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "quote_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");

-- CreateIndex
CREATE INDEX "departments_parent_id_idx" ON "departments"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_user_code_key" ON "users"("user_code");

-- CreateIndex
CREATE INDEX "users_department_id_idx" ON "users"("department_id");

-- CreateIndex
CREATE INDEX "users_former_account_idx" ON "users"("former_account");

-- CreateIndex
CREATE UNIQUE INDEX "users_audience_account_key" ON "users"("audience", "account");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE INDEX "data_scopes_user_id_resource_idx" ON "data_scopes"("user_id", "resource");

-- CreateIndex
CREATE INDEX "data_scopes_role_id_resource_idx" ON "data_scopes"("role_id", "resource");

-- CreateIndex
CREATE UNIQUE INDEX "auth_sessions_token_id_key" ON "auth_sessions"("token_id");

-- CreateIndex
CREATE INDEX "auth_sessions_user_id_idx" ON "auth_sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "login_attempts_audience_account_key" ON "login_attempts"("audience", "account");

-- CreateIndex
CREATE INDEX "captcha_challenges_expires_at_idx" ON "captcha_challenges"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "account_requests_request_no_key" ON "account_requests"("request_no");

-- CreateIndex
CREATE UNIQUE INDEX "account_requests_user_code_key" ON "account_requests"("user_code");

-- CreateIndex
CREATE INDEX "account_requests_status_idx" ON "account_requests"("status");

-- CreateIndex
CREATE INDEX "account_requests_account_idx" ON "account_requests"("account");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_requests_request_no_key" ON "password_reset_requests"("request_no");

-- CreateIndex
CREATE INDEX "password_reset_requests_status_idx" ON "password_reset_requests"("status");

-- CreateIndex
CREATE INDEX "password_reset_requests_audience_account_idx" ON "password_reset_requests"("audience", "account");

-- CreateIndex
CREATE UNIQUE INDEX "doc_number_rules_doc_type_key" ON "doc_number_rules"("doc_type");

-- CreateIndex
CREATE UNIQUE INDEX "doc_number_sequences_doc_type_period_key_key" ON "doc_number_sequences"("doc_type", "period_key");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_user_code_idx" ON "audit_logs"("actor_user_code");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "doc_timelines_doc_type_doc_id_idx" ON "doc_timelines"("doc_type", "doc_id");

-- CreateIndex
CREATE UNIQUE INDEX "outbox_events_event_id_key" ON "outbox_events"("event_id");

-- CreateIndex
CREATE INDEX "outbox_events_published_at_idx" ON "outbox_events"("published_at");

-- CreateIndex
CREATE INDEX "outbox_events_name_idx" ON "outbox_events"("name");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_records_scope_key_key" ON "idempotency_records"("scope", "key");

-- CreateIndex
CREATE UNIQUE INDEX "approval_flows_code_key" ON "approval_flows"("code");

-- CreateIndex
CREATE UNIQUE INDEX "approval_flow_steps_flow_id_sequence_key" ON "approval_flow_steps"("flow_id", "sequence");

-- CreateIndex
CREATE INDEX "approval_instances_doc_type_doc_id_idx" ON "approval_instances"("doc_type", "doc_id");

-- CreateIndex
CREATE INDEX "approval_tasks_instance_id_idx" ON "approval_tasks"("instance_id");

-- CreateIndex
CREATE INDEX "approval_tasks_status_assignee_role_idx" ON "approval_tasks"("status", "assignee_role");

-- CreateIndex
CREATE INDEX "notifications_recipient_user_code_read_at_idx" ON "notifications"("recipient_user_code", "read_at");

-- CreateIndex
CREATE UNIQUE INDEX "customers_code_key" ON "customers"("code");

-- CreateIndex
CREATE INDEX "customers_sales_user_code_idx" ON "customers"("sales_user_code");

-- CreateIndex
CREATE INDEX "customers_status_idx" ON "customers"("status");

-- CreateIndex
CREATE INDEX "customer_delivery_addresses_customer_id_idx" ON "customer_delivery_addresses"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_change_requests_request_no_key" ON "customer_change_requests"("request_no");

-- CreateIndex
CREATE INDEX "customer_change_requests_customer_id_status_idx" ON "customer_change_requests"("customer_id", "status");

-- CreateIndex
CREATE INDEX "material_prices_material_shape_effective_from_idx" ON "material_prices"("material", "shape", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "exchange_rates_base_quote_quoted_on_key" ON "exchange_rates"("base", "quote", "quoted_on");

-- CreateIndex
CREATE INDEX "drawings_customer_id_idx" ON "drawings"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "drawings_drawing_no_customer_id_key" ON "drawings"("drawing_no", "customer_id");

-- CreateIndex
CREATE INDEX "drawing_versions_drawing_id_idx" ON "drawing_versions"("drawing_id");

-- CreateIndex
CREATE UNIQUE INDEX "drawing_versions_drawing_id_sequence_key" ON "drawing_versions"("drawing_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "cost_analyses_doc_no_key" ON "cost_analyses"("doc_no");

-- CreateIndex
CREATE INDEX "cost_analyses_customer_id_idx" ON "cost_analyses"("customer_id");

-- CreateIndex
CREATE INDEX "cost_analyses_root_id_idx" ON "cost_analyses"("root_id");

-- CreateIndex
CREATE INDEX "cost_analysis_lines_cost_analysis_id_idx" ON "cost_analysis_lines"("cost_analysis_id");

-- CreateIndex
CREATE UNIQUE INDEX "cost_analysis_lines_cost_analysis_id_sequence_key" ON "cost_analysis_lines"("cost_analysis_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "quotations_doc_no_key" ON "quotations"("doc_no");

-- CreateIndex
CREATE INDEX "quotations_customer_id_status_idx" ON "quotations"("customer_id", "status");

-- CreateIndex
CREATE INDEX "quotations_root_id_idx" ON "quotations"("root_id");

-- CreateIndex
CREATE INDEX "quotation_items_quotation_id_idx" ON "quotation_items"("quotation_id");

-- CreateIndex
CREATE UNIQUE INDEX "quotation_items_quotation_id_sequence_key" ON "quotation_items"("quotation_id", "sequence");

-- CreateIndex
CREATE INDEX "quotation_tiers_item_id_idx" ON "quotation_tiers"("item_id");

-- CreateIndex
CREATE UNIQUE INDEX "quotation_tiers_item_id_min_quantity_key" ON "quotation_tiers"("item_id", "min_quantity");

-- CreateIndex
CREATE UNIQUE INDEX "quote_change_requests_request_no_key" ON "quote_change_requests"("request_no");

-- CreateIndex
CREATE INDEX "quote_change_requests_quotation_id_status_idx" ON "quote_change_requests"("quotation_id", "status");

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_scopes" ADD CONSTRAINT "data_scopes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_scopes" ADD CONSTRAINT "data_scopes_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_flow_steps" ADD CONSTRAINT "approval_flow_steps_flow_id_fkey" FOREIGN KEY ("flow_id") REFERENCES "approval_flows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_instances" ADD CONSTRAINT "approval_instances_flow_id_fkey" FOREIGN KEY ("flow_id") REFERENCES "approval_flows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_tasks" ADD CONSTRAINT "approval_tasks_instance_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "approval_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_tasks" ADD CONSTRAINT "approval_tasks_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "approval_flow_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_delivery_addresses" ADD CONSTRAINT "customer_delivery_addresses_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_change_requests" ADD CONSTRAINT "customer_change_requests_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drawing_versions" ADD CONSTRAINT "drawing_versions_drawing_id_fkey" FOREIGN KEY ("drawing_id") REFERENCES "drawings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_analysis_lines" ADD CONSTRAINT "cost_analysis_lines_cost_analysis_id_fkey" FOREIGN KEY ("cost_analysis_id") REFERENCES "cost_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_cost_analysis_id_fkey" FOREIGN KEY ("cost_analysis_id") REFERENCES "cost_analyses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_tiers" ADD CONSTRAINT "quotation_tiers_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "quotation_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_change_requests" ADD CONSTRAINT "quote_change_requests_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
