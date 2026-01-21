;; stake-registry
;; Tracks user ownership of contract-held stakes; enables claim/withdrawal.

(use-trait sip-010-trait .sip-010-trait.sip-010-trait)
(use-trait alex-staking-v2-trait .alex-staking-v2-trait.alex-staking-v2-trait)

;; -------------------------
;; Constants & Errors
;; -------------------------
(define-constant CONTRACT-OWNER tx-sender)
(define-constant BLOCKS-PER-CYCLE u525)
(define-constant ALEX-FT-NAME "alex")

(define-constant ERR-UNAUTHORIZED (err u500))
(define-constant ERR-INVALID-AMOUNT (err u501))
(define-constant ERR-INVALID-PARAMS (err u502))
(define-constant ERR-NOT-FOUND (err u503))
(define-constant ERR-LOCKED (err u504))
(define-constant ERR-ALREADY-CLAIMED (err u505))
(define-constant ERR-NOT-OWNER (err u506))
(define-constant ERR-INSUFFICIENT-BALANCE (err u507))

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
(define-map user-stakes
  {user: principal, token: principal}
  {total-staked: uint}
)

(define-map stake-positions
  {user: principal, token: principal, stake-id: uint}
  {
    amount: uint,
    lock-period: uint,
    staked-at-block: uint,
    unlock-block: uint,
    claimed: bool
  }
)

(define-map user-stake-nonces
  {user: principal, token: principal}
  {nonce: uint}
)

;; -------------------------
;; Read-only helpers
;; -------------------------
(define-read-only (get-user-stake-info (user principal) (token principal))
  {
    total-staked: (default-to u0 (get total-staked (map-get? user-stakes {user: user, token: token}))),
    position-count: (default-to u0 (get nonce (map-get? user-stake-nonces {user: user, token: token})))
  }
)

(define-read-only (get-stake-position (user principal) (token principal) (stake-id uint))
  (map-get? stake-positions {user: user, token: token, stake-id: stake-id})
)

;; -------------------------
;; Public API
;; -------------------------
(define-public (stake-for-user
  (user principal)
  (token <sip-010-trait>)
  (alex-staking <alex-staking-v2-trait>)
  (amount uint)
  (lock-period uint)
)
  (let (
    (token-contract (contract-of token))
    (current-nonce (default-to u0 (get nonce (map-get? user-stake-nonces {user: user, token: token-contract}))))
    (current-total (default-to u0 (get total-staked (map-get? user-stakes {user: user, token: token-contract}))))
    (registry-balance (try! (contract-call? token get-balance .stake-registry)))
  )
    (begin
      (asserts! (is-eq contract-caller (var-get job-router-contract)) ERR-UNAUTHORIZED)
      (asserts! (> amount u0) ERR-INVALID-AMOUNT)
      (asserts! (and (> lock-period u0) (<= lock-period u32)) ERR-INVALID-PARAMS)
      ;; Ensure the registry already holds the tokens to be staked.
      (asserts! (>= registry-balance amount) ERR-INSUFFICIENT-BALANCE)

      ;; Stake as the registry contract, allowing up to `amount` of the token to move out.
      (try! (as-contract?
        ((with-ft token-contract ALEX-FT-NAME amount))
        (try! (contract-call? alex-staking stake-tokens token amount lock-period))
        true))

      (let (
        (stake-id current-nonce)
        (unlock-block (+ stacks-block-height (* lock-period BLOCKS-PER-CYCLE)))
      )
        (begin
          (map-set stake-positions
            {user: user, token: token-contract, stake-id: stake-id}
            {
              amount: amount,
              lock-period: lock-period,
              staked-at-block: stacks-block-height,
              unlock-block: unlock-block,
              claimed: false
            })
          (map-set user-stakes
            {user: user, token: token-contract}
            {total-staked: (+ current-total amount)})
          (map-set user-stake-nonces
            {user: user, token: token-contract}
            {nonce: (+ current-nonce u1)})
          (print {event: "stake-created", user: user, token: token-contract, amount: amount, stake-id: stake-id})
          (ok stake-id)
        )
      )
    )
  )
)

(define-public (claim-stake
  (token <sip-010-trait>)
  (alex-staking <alex-staking-v2-trait>)
  (stake-id uint)
)
  (let (
    (user tx-sender)
    (token-contract (contract-of token))
    (pos (unwrap! (map-get? stake-positions {user: user, token: token-contract, stake-id: stake-id}) ERR-NOT-FOUND))
    (current-total (default-to u0 (get total-staked (map-get? user-stakes {user: user, token: token-contract}))))
  )
    (begin
      (asserts! (not (get claimed pos)) ERR-ALREADY-CLAIMED)
      (asserts! (>= stacks-block-height (get unlock-block pos)) ERR-LOCKED)

      ;; Unstake and transfer tokens to the user as the registry contract.
      (let (
        (unstaked (try! (as-contract?
          ((with-ft token-contract ALEX-FT-NAME (get amount pos)))
          (let ((amt (try! (contract-call? alex-staking unstake-tokens token (get amount pos)))))
            (try! (contract-call? token transfer amt .stake-registry user none))
            amt)
        )))
      )
        (begin
          (map-set stake-positions
            {user: user, token: token-contract, stake-id: stake-id}
            (merge pos {claimed: true}))
          (map-set user-stakes
            {user: user, token: token-contract}
            {total-staked: (if (>= current-total (get amount pos)) (- current-total (get amount pos)) u0)})
          (print {event: "stake-claimed", user: user, token: token-contract, stake-id: stake-id, amount: unstaked})
          (ok unstaked)
        )
      )
    )
  )
)

