/*
  Warnings:

  - You are about to drop the column `hk_applied_by` on the `customers` table. All the data in the column will be lost.
  - You are about to drop the column `hk_approved_by` on the `customers` table. All the data in the column will be lost.
  - You are about to drop the column `hk_change_reason` on the `customers` table. All the data in the column will be lost.
  - You are about to drop the column `hk_effective_from` on the `customers` table. All the data in the column will be lost.
  - You are about to drop the column `hk_factor_bps` on the `customers` table. All the data in the column will be lost.
  - You are about to drop the column `hk_pricing_enabled` on the `customers` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "process_nature" AS ENUM ('IN_HOUSE', 'OUTSOURCED');

-- CreateEnum
CREATE TYPE "sales_order_type" AS ENUM ('FORMAL', 'SAMPLE', 'MOLD', 'STOCK_PREP');

-- CreateEnum
CREATE TYPE "charge_mode" AS ENUM ('CHARGED', 'FREE', 'PARTIAL', 'DEFERRED', 'DEPOSIT', 'INTERNAL');

-- CreateEnum
CREATE TYPE "sales_order_status" AS ENUM ('DRAFT', 'MANAGER_REVIEW', 'FINANCE_REVIEW', 'GM_REVIEW', 'CROSS_REVIEW', 'APPROVED', 'EXECUTING', 'COMPLETED', 'CLOSED', 'REJECTED', 'VOID');

-- CreateEnum
CREATE TYPE "stock_prep_status" AS ENUM ('PRODUCING', 'STOCKED', 'CONSUMED');

-- CreateEnum
CREATE TYPE "order_change_type" AS ENUM ('QUANTITY', 'DELIVERY', 'SHIP_TO', 'PACKING', 'CANCEL');

-- CreateEnum
CREATE TYPE "order_change_status" AS ENUM ('SUBMITTED', 'REVIEWING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "track_node_status" AS ENUM ('PENDING', 'ACTIVE', 'DONE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "bom_production_type" AS ENUM ('BATCH', 'MOLD');

-- CreateEnum
CREATE TYPE "bom_request_status" AS ENUM ('DRAFT', 'SUBMITTED', 'CLAIMED', 'RETURNED', 'BOM_DONE', 'ALL_DONE', 'ORDERED');

-- CreateEnum
CREATE TYPE "shipment_status" AS ENUM ('PLANNED', 'PICKING', 'PACKED', 'SHIPPED', 'SIGNED', 'INVOICED', 'CLOSED');

-- CreateEnum
CREATE TYPE "tail_plan" AS ENUM ('REWORK', 'STOCK', 'DIRECT_STOCK', 'SCRAP');

-- CreateEnum
CREATE TYPE "statement_status" AS ENUM ('DRAFT', 'SENT', 'CONFIRMED', 'DISPUTED', 'SETTLED');

-- CreateEnum
CREATE TYPE "statement_line_type" AS ENUM ('SHIPMENT', 'INVOICE', 'RECEIPT', 'RETURN', 'ALLOWANCE');

-- CreateEnum
CREATE TYPE "invoice_kind" AS ENUM ('SPECIAL', 'GENERAL', 'EXPORT', 'PROFORMA');

-- CreateEnum
CREATE TYPE "invoice_doc_kind" AS ENUM ('INVOICE', 'CREDIT_NOTE');

-- CreateEnum
CREATE TYPE "invoice_request_status" AS ENUM ('DRAFT', 'SUBMITTED', 'REVIEWING', 'COMPLETED', 'REJECTED', 'VOID');

-- CreateEnum
CREATE TYPE "sales_return_status" AS ENUM ('REGISTERED', 'QUALITY_JUDGING', 'DISPOSITION', 'EXECUTING', 'CLOSED', 'REJECTED');

-- CreateEnum
CREATE TYPE "return_responsibility" AS ENUM ('COMPANY', 'CUSTOMER', 'SUPPLIER', 'UNDECIDED');

-- CreateEnum
CREATE TYPE "return_disposition" AS ENUM ('REFUND', 'REPLACEMENT', 'REWORK', 'CONCESSION', 'SCRAP', 'UNDECIDED');

-- CreateEnum
CREATE TYPE "customs_status" AS ENUM ('DRAFT', 'CHECKING', 'GENERATED', 'DECLARED', 'RELEASED');

-- CreateEnum
CREATE TYPE "customs_doc_kind" AS ENUM ('PROFORMA_INVOICE', 'COMMERCIAL_INVOICE', 'PACKING_LIST', 'CONTRACT', 'DATA_PACK');

-- AlterTable
ALTER TABLE "customers" DROP COLUMN "hk_applied_by",
DROP COLUMN "hk_approved_by",
DROP COLUMN "hk_change_reason",
DROP COLUMN "hk_effective_from",
DROP COLUMN "hk_factor_bps",
DROP COLUMN "hk_pricing_enabled";

-- CreateTable
CREATE TABLE "process_definitions" (
    "code" VARCHAR(8) NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "nature" "process_nature" NOT NULL,
    "production_unit" VARCHAR(32) NOT NULL,
    "department" VARCHAR(32),
    "sequence" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "process_definitions_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "warehouse_definitions" (
    "code" VARCHAR(8) NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "category" VARCHAR(32) NOT NULL,
    "lrp_included" BOOLEAN NOT NULL DEFAULT false,
    "stock_type" VARCHAR(32),
    "remark" VARCHAR(255),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouse_definitions_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "workshop_definitions" (
    "code" VARCHAR(8) NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "unit_name" VARCHAR(32) NOT NULL,
    "remark" VARCHAR(255),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workshop_definitions_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "sales_orders" (
    "id" UUID NOT NULL,
    "doc_no" VARCHAR(32) NOT NULL,
    "customer_id" UUID NOT NULL,
    "order_type" "sales_order_type" NOT NULL,
    "charge_mode" "charge_mode" NOT NULL,
    "customer_po_no" VARCHAR(64),
    "customer_po_file" VARCHAR(255),
    "currency" VARCHAR(8) NOT NULL DEFAULT 'CNY',
    "tax_rate_bps" INTEGER NOT NULL DEFAULT 1300,
    "internal_due_date" TIMESTAMP(3),
    "cost_owner" VARCHAR(64),
    "free_reason" VARCHAR(255),
    "estimated_cost_minor" BIGINT,
    "status" "sales_order_status" NOT NULL DEFAULT 'DRAFT',
    "submitted_at" TIMESTAMP(3),
    "submitted_by" VARCHAR(32),
    "approved_at" TIMESTAMP(3),
    "reject_reason" VARCHAR(500),
    "stocked_qty" DECIMAL(18,6),
    "stock_status" "stock_prep_status",
    "created_by" VARCHAR(32),
    "updated_by" VARCHAR(32),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version_lock" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "sales_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_order_lines" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "quotation_id" UUID,
    "quotation_item_id" UUID,
    "cost_analysis_id" UUID,
    "product_name" VARCHAR(128) NOT NULL,
    "drawing_no" VARCHAR(128) NOT NULL,
    "drawing_version_id" UUID,
    "revision" VARCHAR(32),
    "item_code" VARCHAR(16),
    "bom_request_no" VARCHAR(32),
    "quantity" DECIMAL(18,6) NOT NULL,
    "unit_price_minor" BIGINT NOT NULL,
    "delivery_date" TIMESTAMP(3),
    "remark" VARCHAR(255),

    CONSTRAINT "sales_order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_consumptions" (
    "id" UUID NOT NULL,
    "stock_order_id" UUID NOT NULL,
    "order_line_id" UUID NOT NULL,
    "consumed_qty" DECIMAL(18,6) NOT NULL,
    "stock_unit_cost_minor" BIGINT NOT NULL,
    "produce_qty" DECIMAL(18,6) NOT NULL,
    "produce_unit_cost_minor" BIGINT NOT NULL,
    "blended_unit_cost_minor" BIGINT NOT NULL,
    "currency" VARCHAR(8) NOT NULL DEFAULT 'CNY',
    "created_by" VARCHAR(32),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_consumptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_change_requests" (
    "id" UUID NOT NULL,
    "request_no" VARCHAR(32) NOT NULL,
    "order_id" UUID NOT NULL,
    "order_line_id" UUID,
    "change_type" "order_change_type" NOT NULL,
    "origin" VARCHAR(16) NOT NULL,
    "urgent" BOOLEAN NOT NULL DEFAULT false,
    "before_value" VARCHAR(255) NOT NULL,
    "after_value" VARCHAR(255) NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "cost_owner" VARCHAR(64),
    "status" "order_change_status" NOT NULL DEFAULT 'SUBMITTED',
    "submitted_by" VARCHAR(32) NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "handled_by" VARCHAR(32),
    "handled_at" TIMESTAMP(3),
    "reject_reason" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version_lock" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "order_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_tracking_nodes" (
    "id" UUID NOT NULL,
    "order_line_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "process_code" VARCHAR(8),
    "node" VARCHAR(64) NOT NULL,
    "phase" VARCHAR(32) NOT NULL,
    "department" VARCHAR(32) NOT NULL,
    "status" "track_node_status" NOT NULL DEFAULT 'PENDING',
    "qty_in" DECIMAL(18,6),
    "qty_ok" DECIMAL(18,6),
    "qty_ng" DECIMAL(18,6),
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "remark" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_tracking_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bom_requests" (
    "id" UUID NOT NULL,
    "doc_no" VARCHAR(32) NOT NULL,
    "customer_id" UUID NOT NULL,
    "quotation_id" UUID,
    "quotation_item_id" UUID,
    "customer_po_no" VARCHAR(64),
    "product_name" VARCHAR(128) NOT NULL,
    "drawing_no" VARCHAR(128) NOT NULL,
    "drawing_version_id" UUID,
    "drawing_version" VARCHAR(32) NOT NULL,
    "material" VARCHAR(64) NOT NULL,
    "surface_treatment" VARCHAR(64) NOT NULL,
    "inspection" VARCHAR(128) NOT NULL,
    "packing" VARCHAR(128) NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "target_delivery_date" TIMESTAMP(3),
    "production_type" "bom_production_type" NOT NULL,
    "from_sample_no" VARCHAR(32),
    "special_requirement" VARCHAR(500),
    "status" "bom_request_status" NOT NULL DEFAULT 'DRAFT',
    "owner_user_code" VARCHAR(32) NOT NULL,
    "submitted_at" TIMESTAMP(3),
    "claimed_at" TIMESTAMP(3),
    "claimed_by" VARCHAR(32),
    "returned_ms" BIGINT NOT NULL DEFAULT 0,
    "returned_at" TIMESTAMP(3),
    "return_reason" VARCHAR(500),
    "bom_ready" BOOLEAN NOT NULL DEFAULT false,
    "program_ready" BOOLEAN NOT NULL DEFAULT false,
    "bom_ready_at" TIMESTAMP(3),
    "program_ready_at" TIMESTAMP(3),
    "product_code" VARCHAR(16),
    "created_by" VARCHAR(32),
    "updated_by" VARCHAR(32),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version_lock" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "bom_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipments" (
    "id" UUID NOT NULL,
    "doc_no" VARCHAR(32) NOT NULL,
    "order_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "delivery_address_id" UUID,
    "currency" VARCHAR(8) NOT NULL DEFAULT 'CNY',
    "carrier" VARCHAR(128),
    "tracking_no" VARCHAR(64),
    "invoice_no" VARCHAR(32),
    "replaces_return_id" UUID,
    "status" "shipment_status" NOT NULL DEFAULT 'PLANNED',
    "owner_user_code" VARCHAR(32) NOT NULL,
    "packed_at" TIMESTAMP(3),
    "shipped_at" TIMESTAMP(3),
    "signed_at" TIMESTAMP(3),
    "invoiced_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "created_by" VARCHAR(32),
    "updated_by" VARCHAR(32),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version_lock" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_lines" (
    "id" UUID NOT NULL,
    "shipment_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "order_line_id" UUID NOT NULL,
    "product_name" VARCHAR(128) NOT NULL,
    "drawing_no" VARCHAR(128) NOT NULL,
    "item_code" VARCHAR(16),
    "batch_no" VARCHAR(64) NOT NULL,
    "ordered_qty" DECIMAL(18,6) NOT NULL,
    "qualified_qty" DECIMAL(18,6) NOT NULL,
    "packed_qty" DECIMAL(18,6) NOT NULL,
    "shipped_qty" DECIMAL(18,6) NOT NULL,
    "unit_price_minor" BIGINT NOT NULL,
    "tail_plan" "tail_plan",
    "tail_resolved_qty" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "tail_approved_by" VARCHAR(32),
    "tail_approved_at" TIMESTAMP(3),
    "tail_remark" VARCHAR(500),

    CONSTRAINT "shipment_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "statements" (
    "id" UUID NOT NULL,
    "doc_no" VARCHAR(32) NOT NULL,
    "customer_id" UUID NOT NULL,
    "period_from" DATE NOT NULL,
    "period_to" DATE NOT NULL,
    "currency" VARCHAR(8) NOT NULL DEFAULT 'CNY',
    "version" INTEGER NOT NULL DEFAULT 1,
    "opening_balance_minor" BIGINT NOT NULL,
    "shipped_amount_minor" BIGINT NOT NULL,
    "invoiced_amount_minor" BIGINT NOT NULL,
    "received_amount_minor" BIGINT NOT NULL,
    "return_amount_minor" BIGINT NOT NULL,
    "closing_balance_minor" BIGINT NOT NULL,
    "difference_amount_minor" BIGINT NOT NULL,
    "difference_note" VARCHAR(500),
    "overdue_amount_minor" BIGINT NOT NULL,
    "status" "statement_status" NOT NULL DEFAULT 'DRAFT',
    "owner_user_code" VARCHAR(32) NOT NULL,
    "sent_at" TIMESTAMP(3),
    "confirmed_at" TIMESTAMP(3),
    "created_by" VARCHAR(32),
    "updated_by" VARCHAR(32),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version_lock" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "statements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "statement_lines" (
    "id" UUID NOT NULL,
    "statement_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "occurred_at" DATE NOT NULL,
    "type" "statement_line_type" NOT NULL,
    "doc_no" VARCHAR(32) NOT NULL,
    "product_name" VARCHAR(128),
    "quantity" DECIMAL(18,6),
    "amount_minor" BIGINT NOT NULL,
    "matched" BOOLEAN NOT NULL DEFAULT false,
    "remark" VARCHAR(255),

    CONSTRAINT "statement_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_requests" (
    "id" UUID NOT NULL,
    "doc_no" VARCHAR(32) NOT NULL,
    "kind" "invoice_doc_kind" NOT NULL DEFAULT 'INVOICE',
    "original_id" UUID,
    "customer_id" UUID NOT NULL,
    "invoice_kind" "invoice_kind" NOT NULL,
    "statement_id" UUID,
    "currency" VARCHAR(8) NOT NULL DEFAULT 'CNY',
    "amount_ex_tax_minor" BIGINT NOT NULL,
    "tax_amount_minor" BIGINT NOT NULL,
    "amount_inc_tax_minor" BIGINT NOT NULL,
    "title" VARCHAR(191) NOT NULL,
    "tax_no" VARCHAR(64) NOT NULL,
    "bank_account" VARCHAR(191),
    "address" VARCHAR(255),
    "delivery_method" VARCHAR(32) NOT NULL,
    "delivery_target" VARCHAR(191) NOT NULL,
    "amount_matched" BOOLEAN NOT NULL DEFAULT true,
    "match_note" VARCHAR(500),
    "expected_payment_date" TIMESTAMP(3),
    "status" "invoice_request_status" NOT NULL DEFAULT 'DRAFT',
    "owner_user_code" VARCHAR(32) NOT NULL,
    "submitted_at" TIMESTAMP(3),
    "invoice_no" VARCHAR(64),
    "issued_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "signed_at" TIMESTAMP(3),
    "reason_text" VARCHAR(500),
    "created_by" VARCHAR(32),
    "updated_by" VARCHAR(32),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version_lock" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "invoice_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_request_lines" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "shipment_id" UUID,
    "shipment_no" VARCHAR(32) NOT NULL,
    "product_name" VARCHAR(128) NOT NULL,
    "drawing_no" VARCHAR(128) NOT NULL,
    "quantity" DECIMAL(18,6) NOT NULL,
    "unit_price_minor" BIGINT NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "tax_rate_bps" INTEGER NOT NULL,
    "tax_amount_minor" BIGINT NOT NULL,

    CONSTRAINT "invoice_request_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_returns" (
    "id" UUID NOT NULL,
    "doc_no" VARCHAR(32) NOT NULL,
    "order_id" UUID NOT NULL,
    "shipment_id" UUID,
    "customer_id" UUID NOT NULL,
    "currency" VARCHAR(8) NOT NULL DEFAULT 'CNY',
    "reason" VARCHAR(500) NOT NULL,
    "eight_d_no" VARCHAR(32),
    "eight_d_required" BOOLEAN NOT NULL DEFAULT false,
    "status" "sales_return_status" NOT NULL DEFAULT 'REGISTERED',
    "owner_user_code" VARCHAR(32) NOT NULL,
    "complaint_at" TIMESTAMP(3) NOT NULL,
    "responded_at" TIMESTAMP(3),
    "judged_at" TIMESTAMP(3),
    "judged_by" VARCHAR(32),
    "approved_at" TIMESTAMP(3),
    "approved_by" VARCHAR(32),
    "closed_at" TIMESTAMP(3),
    "need_finance_approval" BOOLEAN NOT NULL DEFAULT false,
    "reject_reason" VARCHAR(500),
    "created_by" VARCHAR(32),
    "updated_by" VARCHAR(32),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version_lock" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "sales_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_return_lines" (
    "id" UUID NOT NULL,
    "return_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "shipment_line_id" UUID,
    "order_line_id" UUID,
    "product_name" VARCHAR(128) NOT NULL,
    "drawing_no" VARCHAR(128) NOT NULL,
    "batch_no" VARCHAR(64) NOT NULL,
    "return_qty" DECIMAL(18,6) NOT NULL,
    "unit_price_minor" BIGINT NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "responsibility" "return_responsibility" NOT NULL DEFAULT 'UNDECIDED',
    "disposition" "return_disposition" NOT NULL DEFAULT 'UNDECIDED',
    "disposition_note" VARCHAR(500),
    "allowance_minor" BIGINT,
    "received_at" TIMESTAMP(3),
    "received_qty" DECIMAL(18,6),
    "settled_by_credit_note" BOOLEAN NOT NULL DEFAULT false,
    "credit_note_doc_no" VARCHAR(32),

    CONSTRAINT "sales_return_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customs_dossiers" (
    "id" UUID NOT NULL,
    "doc_no" VARCHAR(32) NOT NULL,
    "shipment_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "trade_mode" VARCHAR(32) NOT NULL,
    "incoterm" VARCHAR(32) NOT NULL,
    "port_of_loading" VARCHAR(64) NOT NULL,
    "destination" VARCHAR(128) NOT NULL,
    "destination_port_code" VARCHAR(16),
    "shipping_marks" VARCHAR(500),
    "hs_code" VARCHAR(16) NOT NULL,
    "goods_name_cn" VARCHAR(128) NOT NULL,
    "goods_name_en" VARCHAR(128),
    "quantity" DECIMAL(18,6) NOT NULL,
    "unit" VARCHAR(16) NOT NULL,
    "net_weight" DECIMAL(18,3) NOT NULL,
    "gross_weight" DECIMAL(18,3) NOT NULL,
    "packages" INTEGER NOT NULL,
    "currency" VARCHAR(8) NOT NULL,
    "unit_price_minor" BIGINT NOT NULL,
    "total_amount_minor" BIGINT NOT NULL,
    "exchange_rate" DECIMAL(18,6) NOT NULL,
    "status" "customs_status" NOT NULL DEFAULT 'DRAFT',
    "owner_user_code" VARCHAR(32) NOT NULL,
    "checked_by" VARCHAR(32),
    "checked_at" TIMESTAMP(3),
    "declaration_version" INTEGER NOT NULL DEFAULT 0,
    "declared_at" TIMESTAMP(3),
    "released_at" TIMESTAMP(3),
    "created_by" VARCHAR(32),
    "updated_by" VARCHAR(32),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version_lock" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "customs_dossiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customs_documents" (
    "id" UUID NOT NULL,
    "dossier_id" UUID NOT NULL,
    "kind" "customs_doc_kind" NOT NULL,
    "version" INTEGER NOT NULL,
    "object_key" VARCHAR(512),
    "file_name" VARCHAR(256),
    "exchange_rate" DECIMAL(18,6) NOT NULL,
    "currency" VARCHAR(8) NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generated_by" VARCHAR(32) NOT NULL,

    CONSTRAINT "customs_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customs_declarations" (
    "id" UUID NOT NULL,
    "dossier_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "declared_at" TIMESTAMP(3) NOT NULL,
    "declared_by" VARCHAR(32) NOT NULL,
    "receipt_no" VARCHAR(64),
    "receipt_at" TIMESTAMP(3),

    CONSTRAINT "customs_declarations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customs_declaration_lines" (
    "id" UUID NOT NULL,
    "declaration_id" UUID NOT NULL,
    "kind" "customs_doc_kind" NOT NULL,
    "version" INTEGER NOT NULL,

    CONSTRAINT "customs_declaration_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customs_corrections" (
    "id" UUID NOT NULL,
    "dossier_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "resulting_declaration_version" INTEGER NOT NULL,
    "created_by" VARCHAR(32) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customs_corrections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customs_correction_lines" (
    "id" UUID NOT NULL,
    "correction_id" UUID NOT NULL,
    "kind" "customs_doc_kind" NOT NULL,
    "from_version" INTEGER NOT NULL,
    "to_version" INTEGER NOT NULL,

    CONSTRAINT "customs_correction_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "process_definitions_nature_sequence_idx" ON "process_definitions"("nature", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "sales_orders_doc_no_key" ON "sales_orders"("doc_no");

-- CreateIndex
CREATE INDEX "sales_orders_customer_id_order_type_status_idx" ON "sales_orders"("customer_id", "order_type", "status");

-- CreateIndex
CREATE INDEX "sales_orders_status_submitted_at_idx" ON "sales_orders"("status", "submitted_at");

-- CreateIndex
CREATE INDEX "sales_order_lines_drawing_no_idx" ON "sales_order_lines"("drawing_no");

-- CreateIndex
CREATE UNIQUE INDEX "sales_order_lines_order_id_sequence_key" ON "sales_order_lines"("order_id", "sequence");

-- CreateIndex
CREATE INDEX "stock_consumptions_stock_order_id_idx" ON "stock_consumptions"("stock_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_consumptions_order_line_id_stock_order_id_key" ON "stock_consumptions"("order_line_id", "stock_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_change_requests_request_no_key" ON "order_change_requests"("request_no");

-- CreateIndex
CREATE INDEX "order_change_requests_order_id_status_idx" ON "order_change_requests"("order_id", "status");

-- CreateIndex
CREATE INDEX "order_tracking_nodes_status_idx" ON "order_tracking_nodes"("status");

-- CreateIndex
CREATE UNIQUE INDEX "order_tracking_nodes_order_line_id_sequence_key" ON "order_tracking_nodes"("order_line_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "bom_requests_doc_no_key" ON "bom_requests"("doc_no");

-- CreateIndex
CREATE INDEX "bom_requests_customer_id_status_idx" ON "bom_requests"("customer_id", "status");

-- CreateIndex
CREATE INDEX "bom_requests_status_submitted_at_idx" ON "bom_requests"("status", "submitted_at");

-- CreateIndex
CREATE INDEX "bom_requests_drawing_no_idx" ON "bom_requests"("drawing_no");

-- CreateIndex
CREATE UNIQUE INDEX "shipments_doc_no_key" ON "shipments"("doc_no");

-- CreateIndex
CREATE INDEX "shipments_customer_id_status_idx" ON "shipments"("customer_id", "status");

-- CreateIndex
CREATE INDEX "shipments_order_id_idx" ON "shipments"("order_id");

-- CreateIndex
CREATE INDEX "shipments_status_shipped_at_idx" ON "shipments"("status", "shipped_at");

-- CreateIndex
CREATE INDEX "shipment_lines_order_line_id_idx" ON "shipment_lines"("order_line_id");

-- CreateIndex
CREATE INDEX "shipment_lines_drawing_no_idx" ON "shipment_lines"("drawing_no");

-- CreateIndex
CREATE UNIQUE INDEX "shipment_lines_shipment_id_sequence_key" ON "shipment_lines"("shipment_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "statements_doc_no_key" ON "statements"("doc_no");

-- CreateIndex
CREATE INDEX "statements_customer_id_status_idx" ON "statements"("customer_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "statements_customer_id_period_from_period_to_version_key" ON "statements"("customer_id", "period_from", "period_to", "version");

-- CreateIndex
CREATE INDEX "statement_lines_doc_no_idx" ON "statement_lines"("doc_no");

-- CreateIndex
CREATE UNIQUE INDEX "statement_lines_statement_id_sequence_key" ON "statement_lines"("statement_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_requests_doc_no_key" ON "invoice_requests"("doc_no");

-- CreateIndex
CREATE INDEX "invoice_requests_customer_id_status_idx" ON "invoice_requests"("customer_id", "status");

-- CreateIndex
CREATE INDEX "invoice_requests_status_issued_at_idx" ON "invoice_requests"("status", "issued_at");

-- CreateIndex
CREATE INDEX "invoice_requests_original_id_idx" ON "invoice_requests"("original_id");

-- CreateIndex
CREATE INDEX "invoice_request_lines_shipment_id_idx" ON "invoice_request_lines"("shipment_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_request_lines_invoice_id_sequence_key" ON "invoice_request_lines"("invoice_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "sales_returns_doc_no_key" ON "sales_returns"("doc_no");

-- CreateIndex
CREATE INDEX "sales_returns_customer_id_status_idx" ON "sales_returns"("customer_id", "status");

-- CreateIndex
CREATE INDEX "sales_returns_order_id_idx" ON "sales_returns"("order_id");

-- CreateIndex
CREATE INDEX "sales_returns_shipment_id_idx" ON "sales_returns"("shipment_id");

-- CreateIndex
CREATE INDEX "sales_returns_customer_id_closed_at_idx" ON "sales_returns"("customer_id", "closed_at");

-- CreateIndex
CREATE INDEX "sales_return_lines_shipment_line_id_idx" ON "sales_return_lines"("shipment_line_id");

-- CreateIndex
CREATE INDEX "sales_return_lines_order_line_id_idx" ON "sales_return_lines"("order_line_id");

-- CreateIndex
CREATE INDEX "sales_return_lines_batch_no_idx" ON "sales_return_lines"("batch_no");

-- CreateIndex
CREATE UNIQUE INDEX "sales_return_lines_return_id_sequence_key" ON "sales_return_lines"("return_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "customs_dossiers_doc_no_key" ON "customs_dossiers"("doc_no");

-- CreateIndex
CREATE INDEX "customs_dossiers_customer_id_status_idx" ON "customs_dossiers"("customer_id", "status");

-- CreateIndex
CREATE INDEX "customs_dossiers_shipment_id_idx" ON "customs_dossiers"("shipment_id");

-- CreateIndex
CREATE INDEX "customs_dossiers_order_id_idx" ON "customs_dossiers"("order_id");

-- CreateIndex
CREATE INDEX "customs_documents_dossier_id_kind_idx" ON "customs_documents"("dossier_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "customs_documents_dossier_id_kind_version_key" ON "customs_documents"("dossier_id", "kind", "version");

-- CreateIndex
CREATE UNIQUE INDEX "customs_declarations_dossier_id_version_key" ON "customs_declarations"("dossier_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "customs_declaration_lines_declaration_id_kind_key" ON "customs_declaration_lines"("declaration_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "customs_corrections_dossier_id_sequence_key" ON "customs_corrections"("dossier_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "customs_correction_lines_correction_id_kind_key" ON "customs_correction_lines"("correction_id", "kind");

-- AddForeignKey
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "sales_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_consumptions" ADD CONSTRAINT "stock_consumptions_stock_order_id_fkey" FOREIGN KEY ("stock_order_id") REFERENCES "sales_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_consumptions" ADD CONSTRAINT "stock_consumptions_order_line_id_fkey" FOREIGN KEY ("order_line_id") REFERENCES "sales_order_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_change_requests" ADD CONSTRAINT "order_change_requests_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "sales_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_tracking_nodes" ADD CONSTRAINT "order_tracking_nodes_order_line_id_fkey" FOREIGN KEY ("order_line_id") REFERENCES "sales_order_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_lines" ADD CONSTRAINT "shipment_lines_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "statement_lines" ADD CONSTRAINT "statement_lines_statement_id_fkey" FOREIGN KEY ("statement_id") REFERENCES "statements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_requests" ADD CONSTRAINT "invoice_requests_original_id_fkey" FOREIGN KEY ("original_id") REFERENCES "invoice_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_request_lines" ADD CONSTRAINT "invoice_request_lines_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoice_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_return_lines" ADD CONSTRAINT "sales_return_lines_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "sales_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customs_documents" ADD CONSTRAINT "customs_documents_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "customs_dossiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customs_declarations" ADD CONSTRAINT "customs_declarations_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "customs_dossiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customs_declaration_lines" ADD CONSTRAINT "customs_declaration_lines_declaration_id_fkey" FOREIGN KEY ("declaration_id") REFERENCES "customs_declarations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customs_corrections" ADD CONSTRAINT "customs_corrections_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "customs_dossiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customs_correction_lines" ADD CONSTRAINT "customs_correction_lines_correction_id_fkey" FOREIGN KEY ("correction_id") REFERENCES "customs_corrections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
