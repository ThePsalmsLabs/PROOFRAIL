;; mock-alex-staking-v2
;;
;; Local implementation of minimal ALEX staking interface for simnet/unit tests.
;; This contract is NOT intended for production deployment.

(use-trait sip-010-trait .sip-010-trait.sip-010-trait)
(impl-trait .alex-staking-v2-trait.alex-staking-v2-trait)

(define-constant ERR-INVALID-AMOUNT (err u610))
(define-constant ERR-INSUFFICIENT (err u611))

(define-map stakes
  {staker: principal, token: principal}
  {amount: uint}
)

(define-public (stake-tokens (token <sip-010-trait>) (amount-tokens uint) (lock-period uint))
  (begin
    (asserts! (> amount-tokens u0) ERR-INVALID-AMOUNT)
    ;; Transfer tokens from staker (tx-sender) into this contract.
    (try! (contract-call? token transfer amount-tokens tx-sender .mock-alex-staking-v2 none))
    (let (
      (token-contract (contract-of token))
      (current (default-to u0 (get amount (map-get? stakes {staker: tx-sender, token: token-contract}))))
    )
      (begin
        (map-set stakes {staker: tx-sender, token: token-contract} {amount: (+ current amount-tokens)})
        (ok true)
      )
    )
  )
)

(define-public (unstake-tokens (token <sip-010-trait>) (amount-tokens uint))
  (let (
    (token-contract (contract-of token))
    (current (default-to u0 (get amount (map-get? stakes {staker: tx-sender, token: token-contract}))))
  )
    (begin
      (asserts! (> amount-tokens u0) ERR-INVALID-AMOUNT)
      (asserts! (<= amount-tokens current) ERR-INSUFFICIENT)
      (map-set stakes {staker: tx-sender, token: token-contract} {amount: (- current amount-tokens)})
      ;; Transfer tokens from staking contract back to staker (tx-sender).
      (try! (contract-call? token transfer amount-tokens .mock-alex-staking-v2 tx-sender none))
      (ok amount-tokens)
    )
  )
)

