;; job-router
;; Thin orchestrator that delegates protocol-specific execution to executor contracts.
;; This contract is protocol-agnostic and validates job state + authorization only.
;;
;; The router:
;; - Validates job state and authorization
;; - Draws funds from vault to router
;; - Delegates execution to the configured executor contract
;; - Records execution results back to job-escrow

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
(define-constant ERR-PRICE-VALIDATION-FAILED (err u311))

;; -------------------------
;; Public API
;; -------------------------

;; Generic execution function - delegates to executor contract
;;
;; Executes a job by calling the configured executor contract.
;; The executor must match the job's executor-contract configuration.
;;
;; @param job-id - The job identifier to execute
;; @param executor - Executor contract implementing executor-trait
;; @param input-token - SIP-010 token contract for input
;; @param input-amount - Amount of input token to use (must be <= max-input-amount)
;; @param executor-params - Encoded parameters for the executor
;; @return execution-result - Result from executor with receipt hash and output data
;; @error ERR-JOB-NOT-FOUND - If the job does not exist
;; @error ERR-NOT-AGENT - If caller is not the assigned agent
;; @error ERR-INVALID-STATUS - If job is not in OPEN status
;; @error ERR-EXPIRED - If job has expired
;; @error ERR-EXECUTION-FAILED - If execution fails or input amount exceeds max
;; @error ERR-EXECUTOR-MISMATCH - If executor does not match job configuration
(define-public (execute-job
  (job-id uint)
  (executor <executor-trait>)
  (input-token <sip-010-trait>)
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
      (asserts! (is-eq (contract-of input-token) (get input-token job)) ERR-EXECUTION-FAILED)

      ;; Draw funds from vault to router (router will hold them during execution)
      (try! (contract-call? .agent-vault draw-to-router payer job-id input-token input-amount))

      ;; Delegate execution to the executor contract
      ;; The executor will access the funds via as-contract context
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

;; Execute job with price validation (for B2B infrastructure)
;; This version validates price using Pyth oracle before execution
;; Price data must be fetched off-chain and provided by the agent
(define-public (execute-job-with-price-validation
  (job-id uint)
  (executor <executor-trait>)
  (input-token <sip-010-trait>)
  (input-amount uint)
  (executor-params (buff 2048))
  (base-token principal)
  (quote-token principal)
  (min-price uint)
  (max-price uint)
  (price uint)
  (confidence-interval uint)
  (publish-time uint)
  (expo int)
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
      (asserts! (is-eq (contract-of input-token) (get input-token job)) ERR-EXECUTION-FAILED)

      ;; PRICE VALIDATION: Validate price before drawing funds
      ;; This prevents bad fills and protects institutional users
      (try! (contract-call? .pyth-price-oracle validate-price-for-execution
        base-token
        quote-token
        min-price
        max-price
        price
        confidence-interval
        publish-time
        expo
      ))

      ;; Draw funds from vault to router (router will hold them during execution)
      (try! (contract-call? .agent-vault draw-to-router payer job-id input-token input-amount))

      ;; Delegate execution to the executor contract
      ;; The executor will access the funds via as-contract context
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
            event: "job-executed-via-router-with-price-validation",
            job-id: job-id,
            executor: expected-executor,
            protocol: (get protocol-name execution-result),
            action: (get action-type execution-result),
            price-validated: true
          })

          (ok execution-result)
        )
      )
    )
  )
)
