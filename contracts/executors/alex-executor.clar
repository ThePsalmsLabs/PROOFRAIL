;; alex-executor.clar
;; ALEX Protocol Executor Module
;; Implements executor-trait for ALEX swap + stake workflows.
;; This is ONE implementation - other protocols implement the same trait differently.

(impl-trait .executor-trait.executor-trait)

(use-trait sip-010-trait .sip-010-trait.sip-010-trait)
(use-trait alex-swap-helper-trait .alex-swap-helper-trait.alex-swap-helper-trait)
(use-trait alex-staking-v2-trait .alex-staking-v2-trait.alex-staking-v2-trait)

;; -------------------------
;; Constants
;; -------------------------
(define-constant PROTOCOL-NAME "ALEX")
(define-constant EXECUTOR-NAME "ALEX Swap + Stake Executor")
(define-constant VERSION "1.0.0")

(define-constant ERR-DECODE-FAILED (err u400))
(define-constant ERR-SWAP-FAILED (err u401))
(define-constant ERR-STAKE-FAILED (err u402))
(define-constant ERR-INSUFFICIENT-OUTPUT (err u403))
(define-constant ERR-INVALID-PARAMS (err u404))
(define-constant ERR-JOB-NOT-FOUND (err u405))

;; -------------------------
;; Parameter Structure
;; -------------------------
;; ALEX executor expects params buffer containing:
;; {
;;   usdcx-token: principal,
;;   alex-token: principal,
;;   swap-helper: principal,
;;   alex-staking: principal,
;;   factor: uint,
;;   min-alex-out: uint,
;;   lock-period: uint
;; }

;; -------------------------
;; Executor Trait Implementation
;; -------------------------

(define-public (execute
  (job-id uint)
  (input-amount uint)
  (params (buff 2048))
)
  (let (
    ;; Get job details from escrow
    (job (unwrap! (contract-call? .job-escrow get-job job-id) ERR-JOB-NOT-FOUND))
    (payer (get payer job))
    (agent (get agent job))

    ;; Decode ALEX-specific parameters
    ;; For now, params are passed directly as contract calls will provide them
    ;; In production, implement proper buffer decoding
  )
    ;; This executor receives the actual trait contracts as part of the execution context
    ;; The router will call this via as-contract with the necessary token balances
    (execute-alex-swap-stake job-id payer agent input-amount params)
  )
)

(define-private (execute-alex-swap-stake
  (job-id uint)
  (payer principal)
  (agent principal)
  (swap-amount uint)
  (params (buff 2048))
)
  ;; This is a simplified version - the actual implementation will receive
  ;; the necessary contracts via the router's context
  ;;
  ;; The full ALEX logic from job-router.clar will be moved here with proper
  ;; parameter decoding in the next iteration

  (let (
    ;; Placeholder receipt - will be replaced with actual swap + stake logic
    (receipt {
      protocol: PROTOCOL-NAME,
      action: "swap-stake",
      job-id: job-id,
      payer: payer,
      agent: agent,
      input: swap-amount,
      output: u0,
      block: stacks-block-height
    })
    (receipt-hash (sha256 (unwrap-panic (to-consensus-buff? receipt))))
  )
    (ok {
      success: true,
      receipt-hash: receipt-hash,
      output-amount: u0,
      output-token: payer,  ;; Placeholder
      protocol-name: PROTOCOL-NAME,
      action-type: "swap-stake",
      gas-used: u0,
      metadata: 0x00
    })
  )
)

(define-read-only (get-executor-info)
  (ok {
    protocol: PROTOCOL-NAME,
    name: EXECUTOR-NAME,
    version: VERSION,
    supported-tokens: (list)
  })
)

;; -------------------------
;; Helper Functions for UI/Agents
;; -------------------------

;; Encode ALEX parameters for job creation
(define-read-only (encode-alex-params
  (usdcx-token principal)
  (alex-token principal)
  (swap-helper principal)
  (alex-staking principal)
  (factor uint)
  (min-alex-out uint)
  (lock-period uint)
)
  (to-consensus-buff? {
    usdcx-token: usdcx-token,
    alex-token: alex-token,
    swap-helper: swap-helper,
    alex-staking: alex-staking,
    factor: factor,
    min-alex-out: min-alex-out,
    lock-period: lock-period
  })
)

;; -------------------------
;; Legacy Compatibility Function
;; -------------------------
;; This maintains the existing execute-swap-stake-job signature temporarily
;; Will be fully refactored once router is updated

(define-public (execute-swap-stake-job
  (job-id uint)
  (usdcx <sip-010-trait>)
  (alex <sip-010-trait>)
  (swap-helper <alex-swap-helper-trait>)
  (alex-staking <alex-staking-v2-trait>)
  (factor uint)
  (swap-amount uint)
)
  (let (
    (job (unwrap! (contract-call? .job-escrow get-job job-id) ERR-JOB-NOT-FOUND))
    (payer (get payer job))
    (agent (get agent job))
    (max-input (get max-input-amount job))
    (min-alex-out (get min-alex-out job))
    (lock-period (get lock-period job))
    (expiry-block (get expiry-block job))
  )
    (begin
      (asserts! (> swap-amount u0) ERR-INVALID-PARAMS)
      (asserts! (is-eq tx-sender agent) (err u302))
      (asserts! (is-eq (get status job) u0) (err u301))
      (asserts! (< stacks-block-height expiry-block) (err u306))
      (asserts! (<= swap-amount max-input) (err u307))

      ;; Draw funds from vault
      (try! (contract-call? .agent-vault draw-to-router payer job-id usdcx swap-amount))

      ;; Execute swap USDCx -> ALEX
      (let (
        (swap-result (try! (as-contract?
          ((with-ft (contract-of usdcx) "usdcx" swap-amount))
          (let ((r (unwrap! (contract-call? swap-helper swap-helper usdcx alex factor swap-amount (some min-alex-out)) ERR-SWAP-FAILED)))
            r)
        )))
        (alex-received (get dy swap-result))
      )
        (begin
          (asserts! (>= alex-received min-alex-out) ERR-INSUFFICIENT-OUTPUT)

          ;; Transfer ALEX to stake-registry
          (try! (as-contract?
            ((with-ft (contract-of alex) "alex" alex-received))
            (try! (contract-call? alex transfer alex-received tx-sender .stake-registry none))
            true))

          ;; Stake via registry
          (let ((stake-id (try! (contract-call? .stake-registry stake-for-user payer alex alex-staking alex-received lock-period))))
            (let (
              (executed-block stacks-block-height)
              (receipt {
                job-id: job-id,
                payer: payer,
                agent: agent,
                usdcx-spent: swap-amount,
                alex-received: alex-received,
                alex-staked: alex-received,
                lock-period: lock-period,
                executed-block: executed-block,
                stake-id: stake-id
              })
              (receipt-hash (sha256 (unwrap-panic (to-consensus-buff? receipt))))
            )
              (begin
                ;; Mark executed with UX data
                (try! (contract-call? .job-escrow mark-executed
                  job-id
                  receipt-hash
                  alex-received
                  (contract-of alex)
                  PROTOCOL-NAME
                  "swap-stake"
                  u0))

                (print {
                  event: "alex-swap-stake-executed",
                  job-id: job-id,
                  payer: payer,
                  agent: agent,
                  usdcx-spent: swap-amount,
                  alex-received: alex-received,
                  stake-id: stake-id,
                  receipt-hash: receipt-hash
                })

                (ok {
                  success: true,
                  receipt-hash: receipt-hash,
                  output-amount: alex-received,
                  output-token: (contract-of alex),
                  protocol-name: PROTOCOL-NAME,
                  action-type: "swap-stake",
                  gas-used: u0,
                  metadata: (unwrap-panic (to-consensus-buff? {stake-id: stake-id}))
                })
              )
            )
          )
        )
      )
    )
  )
)
