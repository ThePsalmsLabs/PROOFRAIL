#!/usr/bin/env bash
set -euo pipefail

# 90s demo: run the end-to-end simnet integration test.
# This demonstrates:
# deposit -> create-job -> execute -> claim-fee -> claim-stake

npm run test -- tests/integration.test.ts

