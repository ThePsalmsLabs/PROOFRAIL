;; SIP-010 Fungible Token Trait (Stacks)
;; Used for interacting with USDCx, ALEX, and other SIP-010 tokens.
;;
;; Reference: https://github.com/stacksgov/sips/blob/main/sips/sip-010/sip-010-fungible-token-standard.md

(define-trait sip-010-trait
  (
    ;; Transfers amount from sender to recipient. Memo is optional.
    (transfer (uint principal principal (optional (buff 34))) (response bool uint))
    ;; Returns the token balance for an account.
    (get-balance (principal) (response uint uint))
    ;; Returns the total supply.
    (get-total-supply () (response uint uint))
    ;; Returns the token name.
    (get-name () (response (string-ascii 32) uint))
    ;; Returns the token symbol.
    (get-symbol () (response (string-ascii 32) uint))
    ;; Returns token decimals.
    (get-decimals () (response uint uint))
    ;; Returns a URI string for metadata.
    (get-token-uri () (response (optional (string-utf8 256)) uint))
  )
)

