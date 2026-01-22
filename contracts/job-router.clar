;; job-router
;; Thin orchestrator that delegates protocol-specific execution to executor contracts.
;; This contract is protocol-agnostic and validates job state + authorization only.

(use-trait sip-010-trait .sip-010-trait.sip-010-trait)
(use-trait executor-trait .executor-trait.executor-trait)

;; -------------------------
;; Constants & Errors
;; -------------------------
(define-constant STATUS-OPEN u0)
(define-constant STATUS-EXECUTED u1)

(define-constant ERR-JOB-NOT-FOUND (err u300))
(define-constant ERR-INVALID-STATUS (err u301))
(define-constant ERR-NOT-AGENT (err u302))
(define-constant ERR-EXPIRED (err u306))
(define-constant ERR-EXECUTION-FAILED (err u309))
(define-constant ERR-EXECUTOR-MISMATCH (err u310))

;; -------------------------
;; Public API
;; -------------------------

;; Generic execution function - delegates to executor contract
(define-public (execute-job
  (job-id uint)
  (executor <executor-trait>)
  (input-amount uint)
  (executor-params (buff 2048))
)
  (let (
    (job (unwrap! (contract-call? .job-escrow get-job job-id) ERR-JOB-NOT-FOUND))
    (payer (get payer job))
    (agent (get agent job))
    (max-input (get max-input-amount job))
    (expiry-block (get expiry-block job))
    (expected-executor (get executor-contract job))
  )
    (begin
      ;; Validate job state and authorization
      (asserts! (is-eq tx-sender agent) ERR-NOT-AGENT)
      (asserts! (is-eq (get status job) STATUS-OPEN) ERR-INVALID-STATUS)
      (asserts! (< stacks-block-height expiry-block) ERR-EXPIRED)
      (asserts! (<= input-amount max-input) ERR-EXECUTION-FAILED)
      (asserts! (is-eq (contract-of executor) expected-executor) ERR-EXECUTOR-MISMATCH)

      ;; Delegate execution to the executor contract
      (let (
        (execution-result (try! (contract-call? executor execute job-id input-amount executor-params)))
      )
        (begin
          ;; Mark job as executed with UX data from executor
          (try! (contract-call? .job-escrow mark-executed
            job-id
            (get receipt-hash execution-result)
            (get output-amount execution-result)
            (get output-token execution-result)
            (get protocol-name execution-result)
            (get action-type execution-result)
            (get gas-used execution-result)
          ))

          (print {
            event: "job-executed-via-router",
            job-id: job-id,
            executor: expected-executor,
            protocol: (get protocol-name execution-result),
            action: (get action-type execution-result)
          })

          (ok execution-result)
        )
      )
    )
  )
)
