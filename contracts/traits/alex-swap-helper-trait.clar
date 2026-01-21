;; ALEX Swap Helper Trait (minimal)
;;
;; Mirrors the interface used by `swap-helper-v1-03` for swapping SIP-010 tokens.

(use-trait sip-010-trait .sip-010-trait.sip-010-trait)

(define-trait alex-swap-helper-trait
  (
    (swap-helper
      (
        <sip-010-trait>
        <sip-010-trait>
        uint
        uint
        (optional uint)
      )
      (response {dx: uint, dy: uint} uint)
    )
  )
)

