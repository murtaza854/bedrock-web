#!/bin/sh
# Starts the API for the Playwright tests on its own database (bedrock_e2e) and its own file folder, so a test run
# never touches your real plots or uploads. The database is dropped and rebuilt from schema.sql on every run.
# Needs the postgres14 container (port 5432).
set -e
ADMIN=${E2E_ADMIN_URL:-postgres://murtaza854@localhost:5432/postgres}
DOCS=${TMPDIR:-/tmp}/bedrock-e2e-docs
export PGOPTIONS='--client-min-messages=warning'
psql "$ADMIN" -q -c "drop database if exists bedrock_e2e with (force)" -c "create database bedrock_e2e"
psql "${ADMIN%/*}/bedrock_e2e" -q -v ON_ERROR_STOP=1 -f ../bedrock-api/schema.sql
rm -rf "$DOCS"
cd ../bedrock-api
export DATABASE_URL="${ADMIN%/*}/bedrock_e2e" DEV_NO_AUTH=1 BACKUPS=0 PORT=8101 WEB_ORIGIN=http://localhost:3101 DOCS_DIR="$DOCS" \
  DOCS_KEY=00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff
exec go run .
