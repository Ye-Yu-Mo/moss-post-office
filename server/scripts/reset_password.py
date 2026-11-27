#!/usr/bin/env python3
"""Reset a Moss Post Office user's password verifier and revoke their sessions.

The password is never stored: this derives the same PBKDF2 verifier the
browser uses, then replaces the row in PostgreSQL and drops the user's
sessions. Values are passed to psql as variables, not interpolated into SQL.

Local PostgreSQL:

    python3 scripts/reset_password.py --database-url postgres://localhost/moss --username BDD

Postgres running in Docker (the production setup):

    python3 scripts/reset_password.py --docker-container moss-postgres \
        --db-user moss --db-name moss --username BDD

For automation, pass --password-stdin and pipe one line into stdin.
"""

import argparse
import getpass
import hashlib
import subprocess
import sys
import unicodedata

PEPPER = "moss-post-office:auth:v3:"
ITERATIONS = 100_000

SQL = """
BEGIN;
UPDATE users SET verifier = :'verifier'
 WHERE username_key = :'username_key';
DELETE FROM sessions
 WHERE user_id IN (SELECT id FROM users WHERE username_key = :'username_key');
COMMIT;
SELECT username FROM users WHERE username_key = :'username_key';
"""


def derive_verifier(username: str, password: str) -> str:
    salt = (PEPPER + username.strip().lower()).encode("utf-8")
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, ITERATIONS, dklen=32
    )
    return digest.hex()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--username", required=True, help="display username, case-insensitive")
    parser.add_argument(
        "--database-url",
        default=None,
        help="postgres://... URL (omit when using --docker-container)",
    )
    parser.add_argument("--docker-container", default=None, help="run psql inside this container")
    parser.add_argument("--db-user", default="moss", help="database user for docker mode")
    parser.add_argument("--db-name", default="moss", help="database name for docker mode")
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

    username = args.username.strip()
    username_key = unicodedata.normalize("NFKC", username).strip().lower()
    verifier = derive_verifier(username, password)

    if args.docker_container:
        command = [
            "docker",
            "exec",
            "-i",
            args.docker_container,
            "psql",
            "-U",
            args.db_user,
            "-d",
            args.db_name,
            "-X",
            "-q",
            "-v",
            "ON_ERROR_STOP=1",
        ]
    else:
        if not args.database_url:
            print("pass --database-url or --docker-container", file=sys.stderr)
            return 1
        command = [
            "psql",
            args.database_url,
            "-X",
            "-q",
            "-v",
            "ON_ERROR_STOP=1",
        ]

    command.extend(
        [
            "-v",
            f"username_key={username_key}",
            "-v",
            f"verifier={verifier}",
            "-f",
            "-",
        ]
    )
    result = subprocess.run(
        command,
        input=SQL,
        text=True,
        capture_output=True,
    )
    if result.returncode != 0:
        print(result.stderr.strip() or "psql failed", file=sys.stderr)
        return 1
    output = result.stdout.strip()
    if username_key not in output.lower():
        print("user not found", file=sys.stderr)
        return 1
    print(f"updated {username}; sessions revoked")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
