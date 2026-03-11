#!/usr/bin/env bash
set -euo pipefail

HOST_INPUT="${TRANSCODE_TEST_INPUT:-/home/rene/git/iz-stream-system-test/.assets/media/sintel/v1/Sintel.smoke.5s.mp4}"

if [[ ! -f "${HOST_INPUT}" ]]; then
  echo "[test:transcode-assets:docker] input file not found: ${HOST_INPUT}" >&2
  echo "[test:transcode-assets:docker] set TRANSCODE_TEST_INPUT=/absolute/path/to/input.mp4" >&2
  exit 1
fi

INPUT_DIR="$(dirname "${HOST_INPUT}")"
INPUT_BASENAME="$(basename "${HOST_INPUT}")"

echo "[test:transcode-assets:docker] using input: ${HOST_INPUT}"

docker run --rm \
  -e TRANSCODE_TEST_INPUT="/input/${INPUT_BASENAME}" \
  -e KEEP_TRANSCODE_OUTPUT="${KEEP_TRANSCODE_OUTPUT:-0}" \
  -v "${PWD}:/workspace" \
  -v "${INPUT_DIR}:/input:ro" \
  -w /workspace \
  ivnjey/iz-seeder-bot:0.0.1 \
  sh -lc "npm run test:transcode-assets"
