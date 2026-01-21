;; ALEX Staking V2 Trait (minimal for stake-registry)
;;
;; NOTE: The exact interface on mainnet/testnet must be verified against the
;; deployed contract. This trait captures the functions Proofrail calls.

(use-trait sip-010-trait .sip-010-trait.sip-010-trait)

(define-trait alex-staking-v2-trait
  (
    (stake-tokens (<sip-010-trait> uint uint) (response bool uint))
    ;; Unstake interface varies across protocols; we assume an `unstake-tokens`
    ;; entrypoint that returns the unstaked amount.
    (unstake-tokens (<sip-010-trait> uint) (response uint uint))
  )
)

