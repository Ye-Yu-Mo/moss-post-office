#!/usr/bin/env python3
"""Reset a Moss Post Office user's password verifier and revoke their sessions.

The password is never stored: this derives the same PBKDF2 verifier the
browser uses, then replaces the row in `users`. Requires filesystem access to
the SQLite database.

    python3 scripts/reset_password.py --db data/moss.db --username BDD

For automation, pass --password-stdin and pipe one line into stdin.
"""

import argparse
import getpass
import hashlib
import sqlite3
import sys
import time

PEPPER = "moss-post-office:auth:v3:"
ITERATIONS = 100_000


def derive_verifier(username: str, password: str) -> str:
    salt = (PEPPER + username.strip().lower()).encode("utf-8")
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, ITERATIONS, dklen=32
    )
    return digest.hex()


def backup_database(conn: sqlite3.Connection, db_path: str) -> str:
    stamp = time.strftime("%Y%m%d-%H%M%S")
    backup_path = f"{db_path}.bak-{stamp}"
    with sqlite3.connect(backup_path) as target:
        conn.backup(target)
    return backup_path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", required=True, help="path to moss.db")
    parser.add_argument("--username", required=True, help="display username, case-insensitive")
    parser.add_argument(
        "--password-stdin",
        action="store_true",
        help="read the new password from the first stdin line instead of prompting",
    )
    args = parser.parse_args()

    if args.password_stdin:
        password = sys.stdin.readline().rstrip("\n")
    else:
        password = getpass.getpass("new password: ")
        if getpass.getpass("repeat: ") != password:
            print("passwords do not match", file=sys.stderr)
            return 1

    if len(password) < 8:
        print("password must be at least 8 characters", file=sys.stderr)
        return 1

    username_key = args.username.strip().lower()
    verifier = derive_verifier(args.username, password)

    conn = sqlite3.connect(args.db)
    try:
        row = conn.execute(
            "SELECT id FROM users WHERE username_key = ?", (username_key,)
        ).fetchone()
        if row is None:
            print(f"user not found: {args.username}", file=sys.stderr)
            return 1
        user_id = row[0]

        backup_path = backup_database(conn, args.db)
        with conn:
            conn.execute(
                "UPDATE users SET verifier = ? WHERE id = ?", (verifier, user_id)
            )
            revoked = conn.execute(
                "DELETE FROM sessions WHERE user_id = ?", (user_id,)
            ).rowcount
        print(f"reset password for {args.username} ({user_id})")
        print(f"revoked sessions: {revoked}")
        print(f"backup: {backup_path}")
    finally:
        conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
