#!/bin/sh
# The API for the sign-in tests: login is ON here (unlike e2e/start-api.sh). Own database (bedrock_e2e_auth), own folders,
# and three people already created: an owner, an editor and a viewer. Needs the postgres14 container (port 5432).
set -e
ADMIN=${E2E_ADMIN_URL:-postgres://murtaza854@localhost:5432/postgres}
DB=bedrock_e2e_auth
TMP=${TMPDIR:-/tmp}
export PGOPTIONS='--client-min-messages=warning'
psql "$ADMIN" -q -c "drop database if exists $DB with (force)" -c "create database $DB"
psql "${ADMIN%/*}/$DB" -q -v ON_ERROR_STOP=1 -f ../bedrock-api/schema.sql
rm -rf "$TMP/bedrock-e2e-auth-docs" "$TMP/bedrock-e2e-auth-backups" "$TMP/bedrock-e2e-auth-mail"
cd ../bedrock-api
BIN="$TMP/bedrock-e2e-auth-api"
go build -o "$BIN" .
export DATABASE_URL="${ADMIN%/*}/$DB" DEV_NO_AUTH=0 BACKUPS=0 PORT=8102 WEB_ORIGIN=http://localhost:3102 \
  DOCS_DIR="$TMP/bedrock-e2e-auth-docs" BACKUP_DIR="$TMP/bedrock-e2e-auth-backups" MAIL_OUTBOX="$TMP/bedrock-e2e-auth-mail" \
  DOCS_KEY=00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff
# make adduser only creates the very first owner, so the three test people are inserted directly (bcrypt hashes of the passwords in fixtures.ts)
psql "${ADMIN%/*}/$DB" -q -v ON_ERROR_STOP=1 <<'SQL'
insert into users(email, password_hash, role) values
  ('owner@e2e.test',  '$2a$10$XvNwidDwG/RD.QgQhWP76.NtWjRpyXGH6U0xNSIFvL0ZAZ9xqTzt2', 'owner'),
  ('editor@e2e.test', '$2a$10$GGYMAwDZ8RtdFfvHSS3CX.fpRqP0NPQiFu4vnxvVenAARnk5NPRKK', 'editor'),
  ('viewer@e2e.test', '$2a$10$StwTHPtCiJ.aRCOstfwWROIn3QnUEWeii.blzi6kPsvx42ON54We2', 'viewer');
SQL
exec "$BIN"
