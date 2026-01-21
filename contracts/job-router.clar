;; job-router
;; Execution engine integrating with ALEX swap and staking through stake-registry.

(use-trait sip-010-trait .sip-010-trait.sip-010-trait)
(use-trait alex-swap-helper-trait .alex-swap-helper-trait.alex-swap-helper-trait)
(use-trait alex-staking-v2-trait .alex-staking-v2-trait.alex-staking-v2-trait)

;; -------------------------
;; Constants & Errors
;; -------------------------
(define-constant STATUS-OPEN u0)
(define-constant STATUS-EXECUTED u1)

(define-constant ERR-JOB-NOT-FOUND (err u300))
(define-constant ERR-INVALID-STATUS (err u301))
(define-constant ERR-NOT-AGENT (err u302))
(define-constant ERR-INSUFFICIENT-OUTPUT (err u303))
(define-constant ERR-SWAP-FAILED (err u304))
(define-constant ERR-STAKE-FAILED (err u305))
(define-constant ERR-EXPIRED (err u306))
(define-constant ERR-EXCEEDS-MAX-INPUT (err u307))
(define-constant ERR-INVALID-AMOUNT (err u308))

;; -------------------------
;; Read-only helper
;; -------------------------
(define-read-only (calculate-receipt-hash
  (job-id uint)
  (payer principal)
  (agent principal)
  (usdcx-spent uint)
  (alex-received uint)
  (alex-staked uint)
  (lock-period uint)
  (executed-block uint)
  (stake-id uint)
)
  (sha256 (unwrap-panic (to-consensus-buff? {
    job-id: job-id,
    payer: payer,
    agent: agent,
    usdcx-spent: usdcx-spent,
    alex-received: alex-received,
    alex-staked: alex-staked,
    lock-period: lock-period,
    executed-block: executed-block,
    stake-id: stake-id
  })))
)

;; -------------------------
;; Public API
;; -------------------------
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
    (max-input (get max-input-usdcx job))
    (min-alex-out (get min-alex-out job))
    (lock-period (get lock-period job))
    (expiry-block (get expiry-block job))
  )
    (begin
      (asserts! (> swap-amount u0) ERR-INVALID-AMOUNT)
      (asserts! (is-eq tx-sender agent) ERR-NOT-AGENT)
      (asserts! (is-eq (get status job) STATUS-OPEN) ERR-INVALID-STATUS)
      (asserts! (< stacks-block-height expiry-block) ERR-EXPIRED)
      (asserts! (<= swap-amount max-input) ERR-EXCEEDS-MAX-INPUT)

      ;; Pull USDCx execution funds from the payer's job lock into this router contract.
      (try! (contract-call? .agent-vault draw-to-router payer job-id usdcx swap-amount))

      ;; Execute swap USDCx -> ALEX via swap-helper contract as the router contract.
      ;; This ensures downstream token transfers can debit the router's balance.
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

          ;; Move received ALEX into the stake-registry contract before staking,
          ;; so the registry can stake as the on-chain owner.
          (try! (as-contract?
            ((with-ft (contract-of alex) "alex" alex-received))
            (try! (contract-call? alex transfer alex-received .job-router .stake-registry none))
            true))

          ;; Stake ALEX via registry to ensure correct ownership accounting.
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
                (try! (contract-call? .job-escrow mark-executed job-id receipt-hash))
                (print {event: "swap-stake-executed", job-id: job-id, receipt-hash: receipt-hash})
                (ok receipt)
              )
            )
          )
        )
      )
    )
  )
)

