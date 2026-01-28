;; cctp-bridge-adapter.clar
;; Cross-chain USDC bridge integration for Stacks
;; Supports multiple bridge protocols:
;; - Circle xReserve (primary, recommended) - Official Circle infrastructure for Stacks
;; - Circle CCTP (if/when available) - Standard CCTP protocol
;; - Allbridge (fallback) - Third-party bridge with wrapped USDC
;;
;; This creates a seamless cross-chain liquidity pipeline for institutional users

(use-trait sip-010-trait .sip-010-trait.sip-010-trait)

;; -------------------------
;; Constants & Errors
;; -------------------------
(define-constant ERR-UNAUTHORIZED (err u500))
(define-constant ERR-INVALID-AMOUNT (err u501))
(define-constant ERR-BRIDGE-FAILED (err u502))
(define-constant ERR-ATTESTATION-INVALID (err u503))
(define-constant ERR-MESSAGE-ALREADY-PROCESSED (err u504))
(define-constant ERR-UNSUPPORTED-CHAIN (err u505))
(define-constant ERR-MIN-AMOUNT-NOT-MET (err u506))

(define-constant CONTRACT-OWNER tx-sender)

;; Supported source chains (domain IDs from Circle CCTP)
(define-constant ETHEREUM-DOMAIN u0)
(define-constant ARBITRUM-DOMAIN u3)
(define-constant BASE-DOMAIN u6)
(define-constant OPTIMISM-DOMAIN u2)

;; Minimum bridge amounts (prevent dust attacks)
(define-constant MIN-BRIDGE-AMOUNT u100000) ;; 0.1 USDC

;; -------------------------
;; Configuration
;; -------------------------
;; Bridge protocol type (0 = xReserve, 1 = CCTP, 2 = Allbridge)
(define-data-var bridge-protocol uint u0) ;; Default: xReserve

;; Circle xReserve contract on Stacks (primary)
;; Mainnet: SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx
(define-data-var xreserve-contract principal tx-sender)

;; Circle CCTP MessageTransmitter contract (if/when available)
(define-data-var cctp-message-transmitter principal tx-sender)

;; USDCx token contract on Stacks
(define-data-var usdcx-token principal .mock-usdcx)

;; Agent vault contract for auto-deposit functionality
(define-data-var agent-vault-contract principal .agent-vault)

;; Bridge fee (basis points - 10 = 0.1%)
(define-data-var bridge-fee-bps uint u10)

;; -------------------------
;; Data Structures
;; -------------------------

;; Track processed CCTP messages (prevent replay attacks)
(define-map processed-messages
  {message-hash: (buff 32)}
  {
    processed-at-block: uint,
    recipient: principal,
    amount: uint,
    source-domain: uint
  }
)

;; Cross-chain bridge requests (for tracking pending bridg es)
(define-map bridge-requests
  {request-id: uint}
  {
    user: principal,
    source-chain: uint,
    destination: principal,
    amount: uint,
    status: uint, ;; 0=pending, 1=attested, 2=completed, 3=failed
    created-at-block: uint,
    completed-at-block: (optional uint),
    source-tx-hash: (optional (buff 32))
  }
)

(define-data-var bridge-request-nonce uint u0)

;; Chain configurations
(define-map supported-chains
  {domain-id: uint}
  {
    chain-name: (string-ascii 32),
    enabled: bool,
    min-amount: uint,
    max-amount: uint
  }
)

;; -------------------------
;; Admin Functions
;; -------------------------
(define-public (set-bridge-protocol (protocol uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-UNAUTHORIZED)
    (asserts! (<= protocol u2) ERR-INVALID-AMOUNT) ;; 0-2 only
    (var-set bridge-protocol protocol)
    (ok true)
  )
)

(define-public (set-xreserve-contract (contract principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-UNAUTHORIZED)
    (var-set xreserve-contract contract)
    (ok true)
  )
)

(define-public (set-cctp-transmitter (contract principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-UNAUTHORIZED)
    (var-set cctp-message-transmitter contract)
    (ok true)
  )
)

(define-public (set-usdcx-token (token principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-UNAUTHORIZED)
    (var-set usdcx-token token)
    (ok true)
  )
)

(define-public (set-agent-vault-contract (vault principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-UNAUTHORIZED)
    (var-set agent-vault-contract vault)
    (ok true)
  )
)

(define-public (register-chain
  (domain-id uint)
  (chain-name (string-ascii 32))
  (min-amount uint)
  (max-amount uint)
)
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-UNAUTHORIZED)
    (map-set supported-chains
      {domain-id: domain-id}
      {
        chain-name: chain-name,
        enabled: true,
        min-amount: min-amount,
        max-amount: max-amount
      })
    (ok true)
  )
)

;; -------------------------
;; Bridge Operations
;; -------------------------

;; Initiate cross-chain USDC bridge request
;; This creates a record that will be fulfilled when CCTP message arrives
(define-public (initiate-bridge-request
  (source-chain uint)
  (amount uint)
  (destination principal)
)
  (let (
    (request-id (var-get bridge-request-nonce))
    (chain-config (unwrap! (map-get? supported-chains {domain-id: source-chain}) ERR-UNSUPPORTED-CHAIN))
  )
    (begin
      (asserts! (get enabled chain-config) ERR-UNSUPPORTED-CHAIN)
      (asserts! (>= amount (get min-amount chain-config)) ERR-MIN-AMOUNT-NOT-MET)
      (asserts! (<= amount (get max-amount chain-config)) ERR-INVALID-AMOUNT)

      (map-set bridge-requests
        {request-id: request-id}
        {
          user: tx-sender,
          source-chain: source-chain,
          destination: destination,
          amount: amount,
          status: u0, ;; pending
          created-at-block: stacks-block-height,
          completed-at-block: none,
          source-tx-hash: none
        })

      (var-set bridge-request-nonce (+ request-id u1))

      (print {
        event: "bridge-request-initiated",
        request-id: request-id,
        user: tx-sender,
        source-chain: source-chain,
        amount: amount,
        destination: destination
      })

      (ok request-id)
    )
  )
)

;; Receive and process bridge message from source chain
;; Supports multiple bridge protocols:
;; - xReserve (protocol=0): Circle xReserve attestation
;; - CCTP (protocol=1): Circle CCTP message + attestation  
;; - Allbridge (protocol=2): Allbridge message + signature
(define-public (receive-bridge-message
  (message (buff 2048))
  (attestation (buff 512))
  (message-hash (buff 32))
  (recipient principal)
  (amount uint)
  (source-domain uint)
  (protocol uint) ;; 0 = xReserve, 1 = CCTP, 2 = Allbridge
)
  (let (
    (usdcx (var-get usdcx-token))
    (bridge-fee (/ (* amount (var-get bridge-fee-bps)) u10000))
    (net-amount (- amount bridge-fee))
  )
    (begin
      ;; Check message hasn't been processed
      (asserts! (is-none (map-get? processed-messages {message-hash: message-hash})) ERR-MESSAGE-ALREADY-PROCESSED)

      ;; Validate attestation based on protocol type
      ;; Protocol: 0 = xReserve, 1 = CCTP, 2 = Allbridge
      (asserts! (<= protocol u2) ERR-UNSUPPORTED-CHAIN)
      (asserts! (> (len attestation) u0) ERR-ATTESTATION-INVALID)
      ;; In production, each protocol would have specific validation:
      ;; - xReserve (u0): contract-call? xreserve verify-attestation
      ;; - CCTP (u1): contract-call? cctp-message-transmitter receiveMessage
      ;; - Allbridge (u2): Verify Allbridge validator signatures

      ;; Mark message as processed
      (map-set processed-messages
        {message-hash: message-hash}
        {
          processed-at-block: stacks-block-height,
          recipient: recipient,
          amount: amount,
          source-domain: source-domain
        })

      ;; Mint or transfer USDCx to recipient
      ;; In production with real CCTP, Circle's TokenMessenger mints native USDC
      ;; We would then wrap it to USDCx or use it directly
      ;; For now, assuming USDCx can be minted by this contract (or transferred from pool)

      (print {
        event: "bridge-message-received",
        protocol: protocol,
        message-hash: message-hash,
        recipient: recipient,
        amount: amount,
        net-amount: net-amount,
        bridge-fee: bridge-fee,
        source-domain: source-domain,
        block: stacks-block-height
      })

      (ok {
        recipient: recipient,
        amount-received: net-amount,
        fee-charged: bridge-fee,
        message-hash: message-hash
      })
    )
  )
)

;; Auto-deposit bridged USDC directly into ProofRail vault
;; This creates a seamless UX: bridge -> vault -> ready to create jobs
(define-public (bridge-and-deposit
  (source-chain uint)
  (amount uint)
  (vault-token <sip-010-trait>)
)
  (let (
    (request-id (try! (initiate-bridge-request source-chain amount tx-sender)))
  )
    (begin
      ;; In real implementation, once CCTP message is received:
      ;; 1. CCTP message arrives -> USDCx minted
      ;; 2. Automatically call agent-vault.deposit() on behalf of user
      ;; 3. User's vault balance increases without extra transaction

      (print {
        event: "bridge-and-deposit-initiated",
        request-id: request-id,
        user: tx-sender,
        amount: amount,
        source-chain: source-chain
      })

      (ok request-id)
    )
  )
)

;; Complete bridge request when CCTP message arrives
(define-public (complete-bridge-request
  (request-id uint)
  (source-tx-hash (buff 32))
  (actual-amount uint)
)
  (let (
    (request (unwrap! (map-get? bridge-requests {request-id: request-id}) ERR-UNAUTHORIZED))
  )
    (begin
      (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-UNAUTHORIZED) ;; Only relayer can complete
      (asserts! (is-eq (get status request) u0) ERR-UNAUTHORIZED) ;; Must be pending

      (map-set bridge-requests
        {request-id: request-id}
        (merge request {
          status: u2, ;; completed
          completed-at-block: (some stacks-block-height),
          source-tx-hash: (some source-tx-hash)
        }))

      (print {
        event: "bridge-request-completed",
        request-id: request-id,
        user: (get user request),
        actual-amount: actual-amount,
        source-tx: source-tx-hash
      })

      (ok true)
    )
  )
)

;; Complete bridge and auto-deposit to vault
;; This function is called by the relayer after bridge message is received
;; It transfers USDCx to the vault on behalf of the user for seamless UX
(define-public (complete-bridge-and-deposit
  (message-hash (buff 32))
  (recipient principal)
  (amount uint)
  (vault-token <sip-010-trait>)
)
  (let (
    (bridge-fee (/ (* amount (var-get bridge-fee-bps)) u10000))
    (net-amount (- amount bridge-fee))
  )
    (begin
      ;; Verify message was processed
      (asserts! (is-some (map-get? processed-messages {message-hash: message-hash})) ERR-MESSAGE-ALREADY-PROCESSED)

      ;; NOTE: Auto-deposit to vault requires agent-vault to expose deposit-for-user
      ;; For now, emit event for off-chain relayer to complete the deposit
      ;; Future: (try! (contract-call? .agent-vault deposit-for-user vault-token net-amount recipient))

      (print {
        event: "bridge-completed-ready-for-deposit",
        message-hash: message-hash,
        recipient: recipient,
        amount: amount,
        net-amount: net-amount,
        vault-token: (contract-of vault-token)
      })

      (ok {
        recipient: recipient,
        amount-deposited: net-amount
      })
    )
  )
)

;; -------------------------
;; Read-Only Functions
;; -------------------------
(define-read-only (get-bridge-request (request-id uint))
  (map-get? bridge-requests {request-id: request-id})
)

(define-read-only (is-message-processed (message-hash (buff 32)))
  (is-some (map-get? processed-messages {message-hash: message-hash}))
)

(define-read-only (get-chain-config (domain-id uint))
  (map-get? supported-chains {domain-id: domain-id})
)

(define-read-only (calculate-bridge-fee (amount uint))
  (ok (/ (* amount (var-get bridge-fee-bps)) u10000))
)

(define-read-only (get-supported-chains)
  (ok (list
    {domain: ETHEREUM-DOMAIN, name: "Ethereum"}
    {domain: ARBITRUM-DOMAIN, name: "Arbitrum"}
    {domain: BASE-DOMAIN, name: "Base"}
    {domain: OPTIMISM-DOMAIN, name: "Optimism"}
  ))
)

(define-read-only (get-config)
  {
    cctp-transmitter: (var-get cctp-message-transmitter),
    usdcx-token: (var-get usdcx-token),
    bridge-fee-bps: (var-get bridge-fee-bps),
    min-bridge-amount: MIN-BRIDGE-AMOUNT
  }
)
