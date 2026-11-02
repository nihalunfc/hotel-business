"""Run read-only SQL and print the results.

Usage:
    python ro_sql.py queries.sql                       # SQL Server / Azure SQL, connection from RO_SQL_CONN
    python ro_sql.py queries.sql --sqlite path.sqlite  # local SQLite warehouse (opened read-only)

Queries in the file are separated by a line containing ';;'.

Safety: every query must start with SELECT or WITH and contain no write keyword. The whole
file is checked before anything runs, each query has a timeout, and the transaction is always
rolled back. Use a read-only database login as well; this script is a second guard.
The connection string is read from the environment, never from a file, and is never printed.
"""
import os
import re
import sys

WRITE_WORDS = re.compile(
    r"\b(insert|update|delete|merge|drop|alter|create|truncate|exec|execute|grant|revoke|into|attach|pragma)\b",
    re.IGNORECASE,
)
MAX_ROWS = 200
TIMEOUT_S = 120


def strip_comments(sql: str) -> str:
    sql = re.sub(r"/\*.*?\*/", " ", sql, flags=re.DOTALL)
    return re.sub(r"--[^\n]*", " ", sql)


def check(sql: str) -> None:
    """Raise ValueError unless the query is a single read-only SELECT/WITH."""
    body = strip_comments(sql).strip().rstrip(";").strip()
    if not re.match(r"^(select|with)\b", body, re.IGNORECASE):
        raise ValueError("Only SELECT or WITH queries are allowed.")
    if ";" in body:
        raise ValueError("One statement per query; separate queries with ';;'.")
    if WRITE_WORDS.search(body):
        raise ValueError("Query contains a write keyword; refused.")


def split_queries(text: str) -> list:
    return [q.strip() for q in text.split(";;") if q.strip()]


def connect(sqlite_path=None):
    if sqlite_path:
        import sqlite3
        return sqlite3.connect(f"file:{sqlite_path}?mode=ro", uri=True, timeout=TIMEOUT_S)
    conn_str = os.environ.get("RO_SQL_CONN")
    if not conn_str:
        sys.exit("Set RO_SQL_CONN, or pass --sqlite PATH.")
    import pyodbc  # pip install pyodbc
    conn = pyodbc.connect(conn_str, autocommit=False, timeout=30)
    conn.timeout = TIMEOUT_S
    return conn


def run(path: str, sqlite_path=None) -> None:
    with open(path, encoding="utf-8") as f:
        queries = split_queries(f.read())
    for q in queries:
        check(q)  # refuse the whole file before running anything
    conn = connect(sqlite_path)
    try:
        cur = conn.cursor()
        for i, q in enumerate(queries, 1):
            print(f"\n-- Query {i} --\n{q}\n")
            cur.execute(q.rstrip(";"))
            print("\t".join(c[0] for c in cur.description))
            rows = cur.fetchmany(MAX_ROWS + 1)
            for r in rows[:MAX_ROWS]:
                print("\t".join("" if v is None else str(v) for v in r))
            if len(rows) > MAX_ROWS:
                print(f"... more than {MAX_ROWS} rows, truncated")
    finally:
        conn.rollback()
        conn.close()


if __name__ == "__main__":
    args = sys.argv[1:]
    sqlite_path = None
    if "--sqlite" in args:
        i = args.index("--sqlite")
        sqlite_path = args[i + 1]
        del args[i:i + 2]
    if len(args) != 1:
        sys.exit(__doc__)
    run(args[0], sqlite_path)
