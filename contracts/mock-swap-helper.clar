;; mock-swap-helper
;;
;; Local implementation of the ALEX `swap-helper` interface for simnet/unit tests.
;; This contract is NOT intended for production deployment.

(use-trait sip-010-trait .sip-010-trait.sip-010-trait)
(impl-trait .alex-swap-helper-trait.alex-swap-helper-trait)

(define-constant ERR-SLIPPAGE (err u600))
(define-constant ERR-TRANSFER (err u601))

;; factor is typically u100000000 for 1:1 scaling in ALEX examples.
(define-public (swap-helper
  (token-x <sip-010-trait>)
  (token-y <sip-010-trait>)
  (factor uint)
  (dx uint)
  (min-dy (optional uint))
)
  (let ((dy (/ (* dx factor) u100000000)))
    (begin
      (match min-dy
        min (asserts! (>= dy min) ERR-SLIPPAGE)
        true)
      ;; Pull token-x from tx-sender (router) into this contract.
      (try! (contract-call? token-x transfer dx tx-sender .mock-swap-helper none))
      ;; Send token-y from this contract to tx-sender (router).
      (try! (contract-call? token-y transfer dy .mock-swap-helper tx-sender none))
      (ok {dx: dx, dy: dy})
    )
  )
)

