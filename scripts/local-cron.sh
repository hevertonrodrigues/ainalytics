#!/bin/bash
# Local cron simulator - calls crawl-pages every 10 seconds
# Usage: ./scripts/local-cron.sh

CRON_SECRET="0g7nHOC8u3hK0g7nHOC8u3hK"
URL="http://localhost:54321/functions/v1/crawl-pages"

echo "🕐 Starting local cron - calling crawl-pages every 10s"
echo "   Press Ctrl+C to stop"
echo ""

while true; do
  TIMESTAMP=$(date '+%H:%M:%S')
  RESPONSE=$(curl -s -X POST "$URL" \
    -H "Content-Type: application/json" \
    -H "x-cron-secret: $CRON_SECRET" \
    -d '{}')
  echo "[$TIMESTAMP] $RESPONSE"
  sleep 10
done
