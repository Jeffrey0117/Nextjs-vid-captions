#!/bin/bash

# Test script for async Whisper transcription
# Usage: ./scripts/test-async-transcribe.sh [video-file]

VIDEO_FILE="${1:-test-video.mp4}"
BASE_URL="http://localhost:3000"

echo "==================================="
echo "Async Whisper Transcription Test"
echo "==================================="
echo ""

# Check if video file exists
if [ ! -f "$VIDEO_FILE" ]; then
  echo "Error: Video file not found: $VIDEO_FILE"
  echo "Usage: ./scripts/test-async-transcribe.sh [video-file]"
  exit 1
fi

echo "1. Submitting transcription task..."
echo "   Video: $VIDEO_FILE"
echo ""

# Submit task
RESPONSE=$(curl -s -X POST "$BASE_URL/api/transcribe" \
  -F "file=@$VIDEO_FILE" \
  -F "model=base" \
  -F "language=en")

echo "Response: $RESPONSE"
echo ""

# Extract taskId (requires jq)
if ! command -v jq &> /dev/null; then
  echo "Error: jq is not installed. Please install jq to parse JSON."
  echo "Visit: https://stedolan.github.io/jq/download/"
  exit 1
fi

TASK_ID=$(echo "$RESPONSE" | jq -r '.taskId')

if [ -z "$TASK_ID" ] || [ "$TASK_ID" = "null" ]; then
  echo "Error: Failed to get taskId from response"
  exit 1
fi

echo "Task ID: $TASK_ID"
echo ""

echo "2. Polling task status..."
echo "   (Press Ctrl+C to stop)"
echo ""

# Poll status every 2 seconds
POLL_COUNT=0
MAX_POLLS=150  # 5 minutes max (150 * 2s = 300s)

while [ $POLL_COUNT -lt $MAX_POLLS ]; do
  STATUS_RESPONSE=$(curl -s "$BASE_URL/api/transcribe/status?taskId=$TASK_ID")

  STATUS=$(echo "$STATUS_RESPONSE" | jq -r '.status')
  PROGRESS=$(echo "$STATUS_RESPONSE" | jq -r '.progress')
  MESSAGE=$(echo "$STATUS_RESPONSE" | jq -r '.message // ""')

  # Print progress
  printf "\r[%3d%%] Status: %-12s %s" "$PROGRESS" "$STATUS" "$MESSAGE"

  # Check if completed or error
  if [ "$STATUS" = "completed" ]; then
    echo ""
    echo ""
    echo "==================================="
    echo "Task completed successfully!"
    echo "==================================="
    echo ""

    VIDEO_URL=$(echo "$STATUS_RESPONSE" | jq -r '.result.videoUrl')
    SRT_LENGTH=$(echo "$STATUS_RESPONSE" | jq -r '.result.srtContent | length')

    echo "Video URL: $VIDEO_URL"
    echo "SRT Length: $SRT_LENGTH bytes"
    echo ""
    echo "Full response:"
    echo "$STATUS_RESPONSE" | jq '.'
    exit 0
  elif [ "$STATUS" = "error" ]; then
    echo ""
    echo ""
    echo "==================================="
    echo "Task failed with error!"
    echo "==================================="
    echo ""

    ERROR=$(echo "$STATUS_RESPONSE" | jq -r '.error')
    echo "Error: $ERROR"
    echo ""
    echo "Full response:"
    echo "$STATUS_RESPONSE" | jq '.'
    exit 1
  fi

  # Wait 2 seconds before next poll
  sleep 2
  POLL_COUNT=$((POLL_COUNT + 1))
done

echo ""
echo ""
echo "Timeout: Task did not complete within 5 minutes"
exit 1
