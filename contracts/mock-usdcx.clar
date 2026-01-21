;; mock-usdcx
;;
;; Local SIP-010 token used for simnet/unit tests.
;; This contract is NOT intended for production deployment.

(impl-trait .sip-010-trait.sip-010-trait)

(define-constant CONTRACT-OWNER tx-sender)

(define-constant ERR-UNAUTHORIZED u400)
(define-constant ERR-INVALID-AMOUNT u401)
(define-constant ERR-NOT-SENDER u402)
(define-constant ERR-TRANSFER u403)
(define-constant ERR-MINT u404)

(define-fungible-token usdcx)

(define-constant TOKEN-NAME "Mock USDCx")
(define-constant TOKEN-SYMBOL "USDCx")
(define-constant TOKEN-DECIMALS u6)

(define-public (transfer (amount uint) (sender principal) (recipient principal) (memo (optional (buff 34))))
  (begin
    (asserts! (> amount u0) (err ERR-INVALID-AMOUNT))
    ;; Standard SIP-010 authorization: the sender must sign the transfer.
    ;; Many production SIP-010 tokens allow contract-based transfers by permitting
    ;; `contract-caller` to act for its own balance (sender == contract-caller).
    (asserts! (or (is-eq tx-sender sender) (is-eq contract-caller sender)) (err ERR-NOT-SENDER))
    (match (ft-transfer? usdcx amount sender recipient)
      success (ok true)
      error (err ERR-TRANSFER))
  )
)

(define-read-only (get-balance (who principal))
  (ok (ft-get-balance usdcx who))
)

(define-read-only (get-total-supply)
  (ok (ft-get-supply usdcx))
)

(define-read-only (get-name)
  (ok TOKEN-NAME)
)

(define-read-only (get-symbol)
  (ok TOKEN-SYMBOL)
)

(define-read-only (get-decimals)
  (ok TOKEN-DECIMALS)
)

(define-read-only (get-token-uri)
  (ok none)
)

;; Test helper: mint tokens to an address (owner only).
(define-public (mint (amount uint) (recipient principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) (err ERR-UNAUTHORIZED))
    (asserts! (> amount u0) (err ERR-INVALID-AMOUNT))
    (match (ft-mint? usdcx amount recipient)
      success (ok true)
      error (err ERR-MINT))
  )
)

