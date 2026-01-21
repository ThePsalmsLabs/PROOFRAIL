;; agent-vault
;; USDCx custody and balance management with strict authorization controls.

;; NOTE (Clarity v4): trait references cannot be stored in vars/maps.
;; To keep calls typed and safe, functions accept a SIP-010 trait reference
;; and the contract stores an allowlisted contract principal for validation.

(use-trait sip-010-trait .sip-010-trait.sip-010-trait)

;; -------------------------
;; Constants & Errors
;; -------------------------
(define-constant ERR-UNAUTHORIZED (err u100))
(define-constant ERR-INSUFFICIENT-BALANCE (err u101))
(define-constant ERR-INVALID-AMOUNT (err u102))
(define-constant ERR-TRANSFER-FAILED (err u103))
(define-constant ERR-ALREADY-UNLOCKED (err u104))
(define-constant ERR-JOB-LOCK-NOT-FOUND (err u105))
(define-constant ERR-LOCK-ALREADY-EXISTS (err u106))
(define-constant ERR-AMOUNT-MISMATCH (err u107))

(define-constant CONTRACT-OWNER tx-sender)
(define-constant USDCX-FT-NAME "usdcx")

;; -------------------------
;; Configuration (set by owner after deployment)
;; -------------------------
(define-data-var usdcx-token principal .mock-usdcx)
(define-data-var job-escrow-contract principal tx-sender)
(define-data-var job-router-contract principal tx-sender)

(define-public (set-usdcx-token (token principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-UNAUTHORIZED)
    (var-set usdcx-token token)
    (ok true)
  )
)

(define-public (set-job-escrow-contract (contract principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-UNAUTHORIZED)
    (var-set job-escrow-contract contract)
    (ok true)
  )
)

(define-public (set-job-router-contract (contract principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-UNAUTHORIZED)
    (var-set job-router-contract contract)
    (ok true)
  )
)

;; -------------------------
;; Storage
;; -------------------------
(define-map user-balances
  {user: principal}
  {total: uint, available: uint, locked: uint}
)

;; Per-job lock tracking (supports partial consumption).
(define-map job-locks
  {user: principal, job-id: uint}
  {initial: uint, remaining: uint, unlocked: bool}
)

;; -------------------------
;; Read-only
;; -------------------------
(define-read-only (get-balance (user principal))
  (default-to {total: u0, available: u0, locked: u0}
    (map-get? user-balances {user: user}))
)

(define-read-only (get-job-lock (user principal) (job-id uint))
  (map-get? job-locks {user: user, job-id: job-id})
)

(define-read-only (get-config)
  {
    usdcx-token: (var-get usdcx-token),
    job-escrow-contract: (var-get job-escrow-contract),
    job-router-contract: (var-get job-router-contract)
  }
)

;; -------------------------
;; Public API
;; -------------------------
(define-public (deposit (token <sip-010-trait>) (amount uint))
  (let ((sender tx-sender)
        (current (get-balance tx-sender)))
    (begin
      (asserts! (> amount u0) ERR-INVALID-AMOUNT)
      (asserts! (is-eq (contract-of token) (var-get usdcx-token)) ERR-UNAUTHORIZED)
      ;; User-authorized transfer (tx-sender == sender) from user -> vault principal.
      (try! (contract-call? token transfer amount sender .agent-vault none))
      (map-set user-balances
        {user: sender}
        {
          total: (+ (get total current) amount),
          available: (+ (get available current) amount),
          locked: (get locked current)
        })
      (print {event: "deposited", user: sender, amount: amount})
      (ok amount)
    )
  )
)

(define-public (withdraw (token <sip-010-trait>) (amount uint))
  (let ((recipient tx-sender)
        (current (get-balance tx-sender)))
    (begin
      (asserts! (> amount u0) ERR-INVALID-AMOUNT)
      (asserts! (<= amount (get available current)) ERR-INSUFFICIENT-BALANCE)
      (asserts! (is-eq (contract-of token) (var-get usdcx-token)) ERR-UNAUTHORIZED)
      ;; Act as the vault contract to transfer USDCx out.
      (try! (as-contract?
        ((with-ft (contract-of token) USDCX-FT-NAME amount))
        (try! (contract-call? token transfer amount .agent-vault recipient none))
        true))
      (map-set user-balances
        {user: recipient}
        {
          total: (- (get total current) amount),
          available: (- (get available current) amount),
          locked: (get locked current)
        })
      (print {event: "withdrew", user: recipient, amount: amount})
      (ok amount)
    )
  )
)

(define-public (lock-for-job (user principal) (job-id uint) (amount uint))
  (let ((current (get-balance user)))
    (begin
      (asserts! (is-eq contract-caller (var-get job-escrow-contract)) ERR-UNAUTHORIZED)
      (asserts! (> amount u0) ERR-INVALID-AMOUNT)
      (asserts! (is-none (map-get? job-locks {user: user, job-id: job-id})) ERR-LOCK-ALREADY-EXISTS)
      (asserts! (<= amount (get available current)) ERR-INSUFFICIENT-BALANCE)
      (map-set user-balances
        {user: user}
        {
          total: (get total current),
          available: (- (get available current) amount),
          locked: (+ (get locked current) amount)
        })
      (map-set job-locks
        {user: user, job-id: job-id}
        {initial: amount, remaining: amount, unlocked: false})
      (ok amount)
    )
  )
)

;; Unlocks ALL remaining locked value for the job back to available.
;; Intended for cancellation/expiry before execution.
(define-public (unlock-from-job (user principal) (job-id uint) (amount uint))
  (let ((current (get-balance user))
        (lock (unwrap! (map-get? job-locks {user: user, job-id: job-id}) ERR-JOB-LOCK-NOT-FOUND)))
    (begin
      (asserts! (is-eq contract-caller (var-get job-escrow-contract)) ERR-UNAUTHORIZED)
      (asserts! (not (get unlocked lock)) ERR-ALREADY-UNLOCKED)
      (asserts! (is-eq amount (get initial lock)) ERR-AMOUNT-MISMATCH)
      ;; If execution already consumed any amount, remaining != initial and cancellation/expiry is invalid.
      (asserts! (is-eq (get remaining lock) (get initial lock)) ERR-AMOUNT-MISMATCH)
      (map-set user-balances
        {user: user}
        {
          total: (get total current),
          available: (+ (get available current) amount),
          locked: (- (get locked current) amount)
        })
      (map-set job-locks
        {user: user, job-id: job-id}
        (merge lock {unlocked: true, remaining: u0}))
      (ok amount)
    )
  )
)

;; Draw execution funds (e.g., swap input) from the user's job lock into the router contract.
(define-public (draw-to-router (user principal) (job-id uint) (token <sip-010-trait>) (amount uint))
  (let ((router contract-caller)
        (current (get-balance user))
        (lock (unwrap! (map-get? job-locks {user: user, job-id: job-id}) ERR-JOB-LOCK-NOT-FOUND)))
    (begin
      (asserts! (is-eq contract-caller (var-get job-router-contract)) ERR-UNAUTHORIZED)
      (asserts! (> amount u0) ERR-INVALID-AMOUNT)
      (asserts! (is-eq (contract-of token) (var-get usdcx-token)) ERR-UNAUTHORIZED)
      (asserts! (not (get unlocked lock)) ERR-ALREADY-UNLOCKED)
      (asserts! (<= amount (get remaining lock)) ERR-INSUFFICIENT-BALANCE)
      (asserts! (<= amount (get locked current)) ERR-INSUFFICIENT-BALANCE)
      ;; Transfer USDCx from vault to router (contract-caller).
      (try! (as-contract?
        ((with-ft (contract-of token) USDCX-FT-NAME amount))
        (try! (contract-call? token transfer amount .agent-vault router none))
        true))
      ;; Update balances and remaining lock amount.
      (map-set user-balances
        {user: user}
        {
          total: (- (get total current) amount),
          available: (get available current),
          locked: (- (get locked current) amount)
        })
      (map-set job-locks
        {user: user, job-id: job-id}
        (merge lock {remaining: (- (get remaining lock) amount)}))
      (print {event: "drawn-to-router", user: user, job-id: job-id, amount: amount})
      (ok amount)
    )
  )
)

;; Release the agent fee from the user's job lock.
(define-public (release-fee (user principal) (job-id uint) (token <sip-010-trait>) (agent principal) (amount uint))
  (let ((current (get-balance user))
        (lock (unwrap! (map-get? job-locks {user: user, job-id: job-id}) ERR-JOB-LOCK-NOT-FOUND)))
    (begin
      (asserts! (is-eq contract-caller (var-get job-escrow-contract)) ERR-UNAUTHORIZED)
      (asserts! (> amount u0) ERR-INVALID-AMOUNT)
      (asserts! (is-eq (contract-of token) (var-get usdcx-token)) ERR-UNAUTHORIZED)
      (asserts! (not (get unlocked lock)) ERR-ALREADY-UNLOCKED)
      (asserts! (<= amount (get remaining lock)) ERR-INSUFFICIENT-BALANCE)
      (asserts! (<= amount (get locked current)) ERR-INSUFFICIENT-BALANCE)
      (try! (as-contract?
        ((with-ft (contract-of token) USDCX-FT-NAME amount))
        (try! (contract-call? token transfer amount .agent-vault agent none))
        true))
      (map-set user-balances
        {user: user}
        {
          total: (- (get total current) amount),
          available: (get available current),
          locked: (- (get locked current) amount)
        })
      (map-set job-locks
        {user: user, job-id: job-id}
        (merge lock {
          remaining: (- (get remaining lock) amount),
          ;; Mark unlocked when fully consumed.
          unlocked: (is-eq (- (get remaining lock) amount) u0)
        }))
      (print {event: "fee-released", user: user, job-id: job-id, agent: agent, amount: amount})
      (ok amount)
    )
  )
)

