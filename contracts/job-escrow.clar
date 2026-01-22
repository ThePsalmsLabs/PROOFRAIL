;; job-escrow
;; Job registry, lifecycle management, and payment settlement.

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

;; New generic create-job (protocol-agnostic)
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

