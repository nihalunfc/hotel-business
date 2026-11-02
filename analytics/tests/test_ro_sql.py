"""Tests for the read-only SQL guard in ai-workflow/tools/ro_sql.py."""
import sqlite3
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "ai-workflow" / "tools"))

import ro_sql  # noqa: E402


@pytest.mark.parametrize("sql", [
    "SELECT 1",
    "with x as (select 1 as a) select a from x",
    "-- comment\nSELECT * FROM t;",
    "SELECT updated_at FROM t",  # column names containing write words are fine
])
def test_allows_reads(sql):
    ro_sql.check(sql)


@pytest.mark.parametrize("sql", [
    "DELETE FROM t",
    "UPDATE t SET a = 1",
    "SELECT * INTO new_t FROM t",
    "WITH x AS (SELECT 1) DELETE FROM t",
    "SELECT 1; DROP TABLE t",
    "/* SELECT */ INSERT INTO t VALUES (1)",
    "EXEC sp_who",
])
def test_refuses_writes(sql):
    with pytest.raises(ValueError):
        ro_sql.check(sql)


def test_split_queries():
    assert ro_sql.split_queries("SELECT 1\n;;\nSELECT 2\n;;\n") == ["SELECT 1", "SELECT 2"]


def test_sqlite_runs_read_only(tmp_path, capsys):
    db = tmp_path / "w.sqlite"
    con = sqlite3.connect(db)
    con.execute("CREATE TABLE t (a INTEGER)")
    con.execute("INSERT INTO t VALUES (7)")
    con.commit()
    con.close()
    q = tmp_path / "q.sql"
    q.write_text("SELECT a FROM t")
    ro_sql.run(str(q), sqlite_path=str(db))
    assert "7" in capsys.readouterr().out
    # The connection itself is read-only too
    ro = ro_sql.connect(str(db))
    with pytest.raises(sqlite3.OperationalError):
        ro.execute("INSERT INTO t VALUES (8)")
    ro.close()
