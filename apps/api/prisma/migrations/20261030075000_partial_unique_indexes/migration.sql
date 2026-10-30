-- Enforce at the database level: at most ONE active site assignment per worker.
-- Backstops the application transaction that completes a transfer, so two
-- concurrent approvals can never create duplicate active assignments.
CREATE UNIQUE INDEX "uq_active_assignment_per_worker"
  ON "WorkerSiteAssignment" ("workerId")
  WHERE ("active" = true);

-- Enforce at the database level: at most ONE non-terminal (open) transfer
-- request per worker (the "one pending request at a time" rule).
CREATE UNIQUE INDEX "uq_open_transfer_per_worker"
  ON "SiteTransferRequest" ("workerId")
  WHERE ("status" IN (
    'PENDING_WORKER_RESPONSE',
    'PENDING_CURRENT_CONTRACTOR',
    'PENDING_DESTINATION_CONTRACTOR'
  ));
