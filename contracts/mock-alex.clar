;; mock-alex
;;
;; Local SIP-010 token used for simnet/unit tests.
;; This contract is NOT intended for production deployment.

(impl-trait .sip-010-trait.sip-010-trait)

(define-constant CONTRACT-OWNER tx-sender)

(define-constant ERR-UNAUTHORIZED u410)
(define-constant ERR-INVALID-AMOUNT u411)
(define-constant ERR-NOT-SENDER u412)
(define-constant ERR-TRANSFER u413)
(define-constant ERR-MINT u414)

(define-fungible-token alex)

(define-constant TOKEN-NAME "Mock ALEX")
(define-constant TOKEN-SYMBOL "ALEX")
(define-constant TOKEN-DECIMALS u6)

(define-public (transfer (amount uint) (sender principal) (recipient principal) (memo (optional (buff 34))))
  (begin
    (asserts! (> amount u0) (err ERR-INVALID-AMOUNT))
    (asserts! (or (is-eq tx-sender sender) (is-eq contract-caller sender)) (err ERR-NOT-SENDER))
    (match (ft-transfer? alex amount sender recipient)
      success (ok true)
      error (err ERR-TRANSFER))
  )
)

(define-read-only (get-balance (who principal))
  (ok (ft-get-balance alex who))
)

(define-read-only (get-total-supply)
  (ok (ft-get-supply alex))
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

(define-public (mint (amount uint) (recipient principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) (err ERR-UNAUTHORIZED))
    (asserts! (> amount u0) (err ERR-INVALID-AMOUNT))
    (match (ft-mint? alex amount recipient)
      success (ok true)
      error (err ERR-MINT))
  )
)

