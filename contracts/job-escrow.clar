;; job-escrow
;; Job registry, lifecycle management, and payment settlement.
;;
;; This contract manages the full lifecycle of jobs:
;; - Job creation (legacy ALEX-specific and generic protocol-agnostic)
;; - Job execution tracking
;; - Job cancellation and expiration
;; - Agent fee claiming
;;
;; Jobs are stored with executor configuration, allowing protocol-agnostic execution
;; via the job-router contract.

(use-trait sip-010-trait .sip-010-trait.sip-010-trait)

;; -------------------------
;; Constants & Errors
;; -------------------------
(define-constant STATUS-OPEN u0)
(define-constant STATUS-EXECUTED u1)
(define-constant STATUS-CANCELLED u2)
(define-constant STATUS-EXPIRED u3)

(define-constant ERR-UNAUTHORIZED (err u200))
(define-constant ERR-JOB-NOT-FOUND (err u201))
(define-constant ERR-INVALID-STATUS (err u202))
(define-constant ERR-NOT-AGENT (err u203))
(define-constant ERR-NOT-PAYER (err u204))
(define-constant ERR-FEE-ALREADY-PAID (err u205))
(define-constant ERR-INVALID-PARAMS (err u206))
(define-constant ERR-EXPIRED (err u207))
(define-constant ERR-TOKEN-MISMATCH (err u208))

(define-constant CONTRACT-OWNER tx-sender)

;; -------------------------
;; Configuration
;; -------------------------
(define-data-var job-router-contract principal tx-sender)

(define-public (set-job-router-contract (contract principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-UNAUTHORIZED)
    (var-set job-router-contract contract)
    (ok true)
  )
)

(define-read-only (get-config)
  {job-router-contract: (var-get job-router-contract)}
)

;; -------------------------
;; Storage
;; -------------------------
(define-map jobs
  {job-id: uint}
  {
    ;; Core job data
    payer: principal,
    agent: principal,
    input-token: principal,
    max-input-amount: uint,
    agent-fee-amount: uint,

    ;; Executor configuration
    executor-contract: principal,
    executor-params: (buff 2048),

    ;; Lifecycle
    expiry-block: uint,
    status: uint,
    created-at-block: uint,
    executed-at-block: (optional uint),

    ;; Execution results (UX data)
    receipt-hash: (optional (buff 32)),
    output-amount: (optional uint),
    output-token: (optional principal),
    protocol-used: (optional (string-ascii 32)),
    action-type: (optional (string-ascii 32)),
    gas-consumed: (optional uint),

    ;; Payment
    fee-paid: bool,

    ;; Legacy fields (for backward compatibility during transition)
    min-alex-out: uint,
    lock-period: uint
  }
)

(define-data-var job-nonce uint u0)

;; -------------------------
;; Read-only
;; -------------------------
(define-read-only (get-job (job-id uint))
  (map-get? jobs {job-id: job-id})
)

(define-read-only (get-next-job-id)
  (var-get job-nonce)
)

(define-read-only (is-job-claimable (job-id uint))
  (match (get-job job-id)
    job (and
      (is-eq (get status job) STATUS-EXECUTED)
      (not (get fee-paid job)))
    false)
)

;; -------------------------
;; Public API
;; -------------------------

;; Legacy create-job (ALEX-specific) - maintains backward compatibility
;; 
;; @deprecated This function is maintained for backward compatibility.
;; New integrations should use create-job-generic for protocol-agnostic job creation.
;;
;; Creates a job with ALEX-specific parameters and defaults to alex-executor.
;; The job will swap USDCx for ALEX and stake it on behalf of the payer.
;;
;; @param token - SIP-010 token contract (must be USDCx)
;; @param agent - Principal address of the agent assigned to execute this job
;; @param max-input - Maximum amount of input token to use (in micro units)
;; @param agent-fee - Fee amount for the agent (in micro units)
;; @param min-alex-out - Minimum ALEX tokens expected from swap (slippage protection)
;; @param lock-period - Number of reward cycles to lock the stake (1-32)
;; @param expiry-blocks - Number of blocks until job expires
;; @return job-id - The unique identifier for the created job
;; @error ERR-INVALID-PARAMS - If any parameter is invalid
;; @error ERR-UNAUTHORIZED - If caller is not authorized
(define-public (create-job
  (token <sip-010-trait>)
  (agent principal)
  (max-input uint)
  (agent-fee uint)
  (min-alex-out uint)
  (lock-period uint)
  (expiry-blocks uint)
)
  (let (
    (job-id (var-get job-nonce))
    (payer tx-sender)
    (token-contract (contract-of token))
    (total-required (+ max-input agent-fee))
    (expiry-block (+ stacks-block-height expiry-blocks))
    ;; Default to alex-executor for legacy calls
    (executor .alex-executor)
  )
    (begin
      (asserts! (> max-input u0) ERR-INVALID-PARAMS)
      (asserts! (> agent-fee u0) ERR-INVALID-PARAMS)
      (asserts! (> min-alex-out u0) ERR-INVALID-PARAMS)
      (asserts! (and (> lock-period u0) (<= lock-period u32)) ERR-INVALID-PARAMS)
      (asserts! (> expiry-blocks u0) ERR-INVALID-PARAMS)
      (asserts! (not (is-eq agent payer)) ERR-INVALID-PARAMS)

      (try! (contract-call? .agent-vault lock-for-job payer job-id total-required))

      (map-set jobs
        {job-id: job-id}
        {
          payer: payer,
          agent: agent,
          input-token: token-contract,
          max-input-amount: max-input,
          agent-fee-amount: agent-fee,
          executor-contract: executor,
          executor-params: 0x00,  ;; Empty for legacy
          expiry-block: expiry-block,
          status: STATUS-OPEN,
          created-at-block: stacks-block-height,
          executed-at-block: none,
          receipt-hash: none,
          output-amount: none,
          output-token: none,
          protocol-used: none,
          action-type: none,
          gas-consumed: none,
          fee-paid: false,
          min-alex-out: min-alex-out,
          lock-period: lock-period
        })

      (var-set job-nonce (+ job-id u1))
      (print {event: "job-created", job-id: job-id, payer: payer, agent: agent, executor: executor})
      (ok job-id)
    )
  )
)

;; Generic create-job (protocol-agnostic)
;;
;; Creates a job with configurable executor contract and parameters.
;; This allows jobs to work with any protocol that implements the executor-trait.
;;
;; @param input-token - SIP-010 token contract for input
;; @param agent - Principal address of the agent assigned to execute this job
;; @param max-input-amount - Maximum amount of input token to use (in micro units)
;; @param agent-fee-amount - Fee amount for the agent (in micro units)
;; @param executor-contract - Principal of the executor contract implementing executor-trait
;; @param executor-params - Encoded parameters for the executor (buff 2048)
;; @param expiry-blocks - Number of blocks until job expires
;; @return job-id - The unique identifier for the created job
;; @error ERR-INVALID-PARAMS - If any parameter is invalid
;; @error ERR-UNAUTHORIZED - If caller is not authorized
(define-public (create-job-generic
  (input-token <sip-010-trait>)
  (agent principal)
  (max-input-amount uint)
  (agent-fee-amount uint)
  (executor-contract principal)
  (executor-params (buff 2048))
  (expiry-blocks uint)
)
  (let (
    (job-id (var-get job-nonce))
    (payer tx-sender)
    (input-token-contract (contract-of input-token))
    (total-required (+ max-input-amount agent-fee-amount))
    (expiry-block (+ stacks-block-height expiry-blocks))
  )
    (begin
      (asserts! (> max-input-amount u0) ERR-INVALID-PARAMS)
      (asserts! (> agent-fee-amount u0) ERR-INVALID-PARAMS)
      (asserts! (> expiry-blocks u0) ERR-INVALID-PARAMS)
      (asserts! (not (is-eq agent payer)) ERR-INVALID-PARAMS)

      (try! (contract-call? .agent-vault lock-for-job payer job-id total-required))

      (map-set jobs
        {job-id: job-id}
        {
          payer: payer,
          agent: agent,
          input-token: input-token-contract,
          max-input-amount: max-input-amount,
          agent-fee-amount: agent-fee-amount,
          executor-contract: executor-contract,
          executor-params: executor-params,
          expiry-block: expiry-block,
          status: STATUS-OPEN,
          created-at-block: stacks-block-height,
          executed-at-block: none,
          receipt-hash: none,
          output-amount: none,
          output-token: none,
          protocol-used: none,
          action-type: none,
          gas-consumed: none,
          fee-paid: false,
          min-alex-out: u0,
          lock-period: u0
        })

      (var-set job-nonce (+ job-id u1))
      (print {
        event: "job-created",
        job-id: job-id,
        payer: payer,
        agent: agent,
        executor: executor-contract,
        input-token: input-token-contract,
        max-amount: max-input-amount,
        fee: agent-fee-amount
      })
      (ok job-id)
    )
  )
)

;; Cancel an open job and unlock funds
;;
;; Only the job payer can cancel a job. Funds are returned to available balance.
;; Jobs can only be cancelled if they are still in OPEN status.
;;
;; @param job-id - The job identifier to cancel
;; @return true - If cancellation was successful
;; @error ERR-JOB-NOT-FOUND - If the job does not exist
;; @error ERR-NOT-PAYER - If caller is not the job payer
;; @error ERR-INVALID-STATUS - If job is not in OPEN status
(define-public (cancel-job (job-id uint))
  (let (
    (job (unwrap! (get-job job-id) ERR-JOB-NOT-FOUND))
    (payer (get payer job))
    (total-locked (+ (get max-input-amount job) (get agent-fee-amount job)))
  )
    (begin
      (asserts! (is-eq tx-sender payer) ERR-NOT-PAYER)
      (asserts! (is-eq (get status job) STATUS-OPEN) ERR-INVALID-STATUS)
      (try! (contract-call? .agent-vault unlock-from-job payer job-id total-locked))
      (map-set jobs {job-id: job-id} (merge job {status: STATUS-CANCELLED}))
      (print {event: "job-cancelled", job-id: job-id})
      (ok true)
    )
  )
)

;; Expire an open job that has passed its expiry block
;;
;; Anyone can call this to expire a job that has passed its expiry block.
;; Funds are returned to available balance.
;;
;; @param job-id - The job identifier to expire
;; @return true - If expiration was successful
;; @error ERR-JOB-NOT-FOUND - If the job does not exist
;; @error ERR-INVALID-STATUS - If job is not in OPEN status
;; @error ERR-INVALID-PARAMS - If job has not yet expired
(define-public (expire-job (job-id uint))
  (let (
    (job (unwrap! (get-job job-id) ERR-JOB-NOT-FOUND))
    (payer (get payer job))
    (total-locked (+ (get max-input-amount job) (get agent-fee-amount job)))
  )
    (begin
      (asserts! (is-eq (get status job) STATUS-OPEN) ERR-INVALID-STATUS)
      (asserts! (>= stacks-block-height (get expiry-block job)) ERR-INVALID-PARAMS)
      (try! (contract-call? .agent-vault unlock-from-job payer job-id total-locked))
      (map-set jobs {job-id: job-id} (merge job {status: STATUS-EXPIRED}))
      (print {event: "job-expired", job-id: job-id})
      (ok true)
    )
  )
)

;; Mark a job as executed (called by job-router after successful execution)
;;
;; This function can only be called by the job-router contract.
;; It updates the job status and stores execution results for UX purposes.
;;
;; @param job-id - The job identifier
;; @param receipt-hash - SHA256 hash of the execution receipt
;; @param output-amount - Amount of output tokens received
;; @param output-token - Principal of the output token contract
;; @param protocol-name - Name of the protocol used (e.g., "ALEX")
;; @param action-type - Type of action performed (e.g., "swap-stake")
;; @param gas-used - Gas consumed (for tracking, currently u0)
;; @return true - If marking was successful
;; @error ERR-UNAUTHORIZED - If caller is not job-router
;; @error ERR-JOB-NOT-FOUND - If the job does not exist
;; @error ERR-INVALID-STATUS - If job is not in OPEN status
;; @error ERR-EXPIRED - If job has expired
(define-public (mark-executed
  (job-id uint)
  (receipt-hash (buff 32))
  (output-amount uint)
  (output-token principal)
  (protocol-name (string-ascii 32))
  (action-type (string-ascii 32))
  (gas-used uint)
)
  (let ((job (unwrap! (get-job job-id) ERR-JOB-NOT-FOUND)))
    (begin
      (asserts! (is-eq contract-caller (var-get job-router-contract)) ERR-UNAUTHORIZED)
      (asserts! (is-eq (get status job) STATUS-OPEN) ERR-INVALID-STATUS)
      (asserts! (< stacks-block-height (get expiry-block job)) ERR-EXPIRED)
      (map-set jobs
        {job-id: job-id}
        (merge job {
          status: STATUS-EXECUTED,
          receipt-hash: (some receipt-hash),
          executed-at-block: (some stacks-block-height),
          output-amount: (some output-amount),
          output-token: (some output-token),
          protocol-used: (some protocol-name),
          action-type: (some action-type),
          gas-consumed: (some gas-used)
        }))
      (print {
        event: "job-executed",
        job-id: job-id,
        receipt-hash: receipt-hash,
        output-amount: output-amount,
        output-token: output-token,
        protocol: protocol-name,
        action: action-type,
        gas: gas-used
      })
      (ok true)
    )
  )
)

;; Claim agent fee for an executed job
;;
;; Only the assigned agent can claim the fee after successful job execution.
;; The fee is transferred from the vault to the agent.
;;
;; @param job-id - The job identifier
;; @param token - SIP-010 token contract (must match job input-token)
;; @return fee-amount - The amount of fee claimed
;; @error ERR-JOB-NOT-FOUND - If the job does not exist
;; @error ERR-NOT-AGENT - If caller is not the assigned agent
;; @error ERR-INVALID-STATUS - If job is not in EXECUTED status
;; @error ERR-FEE-ALREADY-PAID - If fee has already been claimed
;; @error ERR-TOKEN-MISMATCH - If token does not match job input-token
(define-public (claim-fee (job-id uint) (token <sip-010-trait>))
  (let (
    (job (unwrap! (get-job job-id) ERR-JOB-NOT-FOUND))
    (agent (get agent job))
    (payer (get payer job))
    (fee (get agent-fee-amount job))
  )
    (begin
      (asserts! (is-eq tx-sender agent) ERR-NOT-AGENT)
      (asserts! (is-eq (get status job) STATUS-EXECUTED) ERR-INVALID-STATUS)
      (asserts! (not (get fee-paid job)) ERR-FEE-ALREADY-PAID)
      (asserts! (is-eq (contract-of token) (get input-token job)) ERR-TOKEN-MISMATCH)
      (try! (contract-call? .agent-vault release-fee payer job-id token agent fee))
      (map-set jobs {job-id: job-id} (merge job {fee-paid: true}))
      (print {event: "fee-claimed", job-id: job-id, agent: agent, amount: fee})
      (ok fee)
    )
  )
)

