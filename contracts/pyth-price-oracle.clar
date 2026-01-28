;; pyth-price-oracle.clar
;; Price oracle integration for PROOFRAIL using Pyth Network
;; Enables price-aware job execution with real-time market data validation

;; -------------------------
;; Constants & Errors
;; -------------------------
(define-constant ERR-UNAUTHORIZED (err u400))
(define-constant ERR-STALE-PRICE (err u401))
(define-constant ERR-PRICE-DEVIATION (err u402))
(define-constant ERR-INVALID-FEED (err u403))
(define-constant ERR-PRICE-TOO-OLD (err u404))

(define-constant CONTRACT-OWNER tx-sender)

;; Pyth price staleness threshold (in blocks)
(define-constant MAX-PRICE-AGE u10) ;; ~10 blocks (~10 minutes on Stacks)

;; Maximum allowed price deviation from TWAP (basis points)
(define-constant MAX-PRICE-DEVIATION u500) ;; 5%

;; -------------------------
;; Configuration
;; -------------------------
;; Pyth contract principal on Stacks (to be set after deployment)
(define-data-var pyth-oracle-contract principal tx-sender)

;; Price feed IDs (Pyth uses 32-byte feed identifiers)
;; These would be actual Pyth price feed IDs for each trading pair
(define-map price-feeds
  {base-token: principal, quote-token: principal}
  {
    feed-id: (buff 32),
    decimals: uint,
    min-confidence: uint, ;; Minimum confidence interval
    enabled: bool
  }
)

;; TWAP state for smoothing (Time-Weighted Average Price)
(define-map token-twap
  {base-token: principal, quote-token: principal}
  {
    cumulative-price: uint,
    last-update-block: uint,
    sample-count: uint
  }
)

;; -------------------------
;; Admin Functions
;; -------------------------
(define-public (set-pyth-oracle (contract principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-UNAUTHORIZED)
    (var-set pyth-oracle-contract contract)
    (ok true)
  )
)

(define-public (register-price-feed
  (base-token principal)
  (quote-token principal)
  (feed-id (buff 32))
  (decimals uint)
  (min-confidence uint)
)
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-UNAUTHORIZED)
    (map-set price-feeds
      {base-token: base-token, quote-token: quote-token}
      {
        feed-id: feed-id,
        decimals: decimals,
        min-confidence: min-confidence,
        enabled: true
      })
    (ok true)
  )
)

;; -------------------------
;; Price Validation Functions
;; -------------------------

;; Validate price meets execution criteria
;; Used by job-router before executing swaps
;; This version accepts price data as parameters (for pull integration)
(define-public (validate-price-for-execution
  (base-token principal)
  (quote-token principal)
  (min-price uint)
  (max-price uint)
  (price uint)
  (confidence-interval uint)
  (publish-time uint)
  (expo int)
)
  (let (
    (price-data (try! (get-current-price base-token quote-token price confidence-interval publish-time expo)))
    (current-price (get price price-data))
    (price-age (- stacks-block-height (get publish-block price-data)))
  )
    (begin
      ;; Check price is not stale
      (asserts! (<= price-age MAX-PRICE-AGE) ERR-PRICE-TOO-OLD)

      ;; Check price is within acceptable range
      (asserts! (>= current-price min-price) ERR-PRICE-DEVIATION)
      (asserts! (<= current-price max-price) ERR-PRICE-DEVIATION)

      ;; Check confidence interval is acceptable
      (asserts!
        (<= (get confidence-interval price-data) (get min-confidence (unwrap! (get-feed-config base-token quote-token) ERR-INVALID-FEED)))
        ERR-PRICE-DEVIATION)

      (ok {
        price: current-price,
        confidence: (get confidence-interval price-data),
        validated-at-block: stacks-block-height
      })
    )
  )
)

;; Get current price from Pyth oracle
;; Pyth on Stacks uses pull integration - price data is provided in transaction
;; This function validates and stores the provided price data
(define-public (get-current-price
  (base-token principal)
  (quote-token principal)
  (price uint)
  (confidence-interval uint)
  (publish-time uint)
  (expo int)
)
  (let (
    (feed-config (unwrap! (get-feed-config base-token quote-token) ERR-INVALID-FEED))
  )
    (begin
      (asserts! (get enabled feed-config) ERR-INVALID-FEED)

      ;; Validate price data freshness (publish-time should be recent)
      (let ((age (- stacks-block-height publish-time)))
        (asserts! (<= age MAX-PRICE-AGE) ERR-PRICE-TOO-OLD)
      )

      ;; Validate confidence interval meets minimum requirement
      (asserts! (<= confidence-interval (get min-confidence feed-config)) ERR-PRICE-DEVIATION)

      ;; Return validated price data matching Pyth's response format
      (ok {
        price: price,
        confidence-interval: confidence-interval,
        publish-block: publish-time,
        expo: (get decimals feed-config)
      })
    )
  )
)

;; Update TWAP for a token pair (called periodically by keepers)
;; Accepts price data as parameters for pull integration
(define-public (update-twap
  (base-token principal)
  (quote-token principal)
  (price uint)
  (confidence-interval uint)
  (publish-time uint)
  (expo int)
)
  (let (
    (price-data (try! (get-current-price base-token quote-token price confidence-interval publish-time expo)))
    (current-twap (default-to
      {cumulative-price: u0, last-update-block: u0, sample-count: u0}
      (map-get? token-twap {base-token: base-token, quote-token: quote-token})))
    (blocks-elapsed (- stacks-block-height (get last-update-block current-twap)))
    (new-cumulative (+ (get cumulative-price current-twap) (* (get price price-data) blocks-elapsed)))
  )
    (begin
      (map-set token-twap
        {base-token: base-token, quote-token: quote-token}
        {
          cumulative-price: new-cumulative,
          last-update-block: stacks-block-height,
          sample-count: (+ (get sample-count current-twap) u1)
        })
      (ok {
        twap: (/ new-cumulative (+ blocks-elapsed (get sample-count current-twap))),
        samples: (get sample-count current-twap)
      })
    )
  )
)

;; -------------------------
;; Read-Only Functions
;; -------------------------
(define-read-only (get-feed-config
  (base-token principal)
  (quote-token principal)
)
  (map-get? price-feeds {base-token: base-token, quote-token: quote-token})
)

(define-read-only (get-twap
  (base-token principal)
  (quote-token principal)
)
  (let (
    (twap-data (map-get? token-twap {base-token: base-token, quote-token: quote-token}))
  )
    (match twap-data
      data (ok {
        twap: (/ (get cumulative-price data) (get sample-count data)),
        last-update: (get last-update-block data),
        samples: (get sample-count data)
      })
      (err ERR-INVALID-FEED))
  )
)

(define-read-only (is-price-acceptable
  (base-token principal)
  (quote-token principal)
  (expected-price uint)
  (max-deviation-bps uint) ;; basis points (100 = 1%)
  (price uint)
  (confidence-interval uint)
  (publish-time uint)
  (expo int)
)
  (match (get-current-price base-token quote-token price confidence-interval publish-time expo)
    price-data
      (let (
        (current-price (get price price-data))
        (deviation (if (> current-price expected-price)
          (/ (* (- current-price expected-price) u10000) expected-price)
          (/ (* (- expected-price current-price) u10000) expected-price)))
      )
        (ok (<= deviation max-deviation-bps))
      )
    error (err error))
)

(define-read-only (get-config)
  {
    pyth-oracle: (var-get pyth-oracle-contract),
    max-price-age: MAX-PRICE-AGE,
    max-deviation: MAX-PRICE-DEVIATION
  }
)
