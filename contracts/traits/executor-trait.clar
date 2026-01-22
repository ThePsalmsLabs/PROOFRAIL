;; executor-trait.clar
;; Standard interface for protocol-specific job execution modules.
;; ANY DeFi protocol can integrate with PROOFRAIL by implementing this trait.

(define-trait executor-trait
  (
    ;; Execute a job and return verifiable proof
    ;; @param job-id: Job identifier from job-escrow
    ;; @param input-amount: Amount of input token to use for execution
    ;; @param executor-params: Protocol-specific encoded parameters
    ;; @returns: Execution receipt with standardized metrics
    (execute
      (uint uint (buff 2048))
      (response
        {
          success: bool,
          receipt-hash: (buff 32),
          output-amount: uint,
          output-token: principal,
          protocol-name: (string-ascii 32),
          action-type: (string-ascii 32),
          gas-used: uint,
          metadata: (buff 512)
        }
        uint
      )
    )

    ;; Get executor metadata for UI/discovery
    ;; @returns: Executor information
    (get-executor-info
      ()
      (response
        {
          protocol: (string-ascii 32),
          name: (string-ascii 64),
          version: (string-ascii 16),
          supported-tokens: (list 10 principal)
        }
        uint
      )
    )
  )
)
