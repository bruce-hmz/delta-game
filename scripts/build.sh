#!/bin/bash
set -Eeuo pipefail

echo "Building the Next.js project..."
npx next build

echo "Build completed successfully!"
