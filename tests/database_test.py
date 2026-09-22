"""Exercise actual prepared SQL from the app against its migration schema."""
import re, sqlite3, unittest
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]

def queries(file):
    return [m.group(2) for m in re.finditer(r'''prepare\((['"])(.*?)\1\)''', (ROOT / file).read_text(), re.S)]

def sql(file, prefix):
    return next(q for q in queries(file) if q.startswith(prefix))

class DatabaseInvariants(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:')
        for path in sorted((ROOT / 'drizzle').glob('*.sql')):
            self.db.executescript(path.read_text())
        self.db.execute('INSERT INTO projects VALUES(?,?,?,?,?,?,?)', ('p','alice','Test','{}',3,'now','now'))
        self.db.execute('INSERT INTO approvals VALUES(?,?,?,?,?,?,?,?,?)', ('a','alice','p','command','{}',3,'approved','now',1000))

    def test_all_actual_prepared_statements_compile(self):
        for path in [*ROOT.glob('app/api/**/*.ts'), *ROOT.glob('lib/*service.ts'), ROOT/'lib/server.ts', ROOT/'lib/remote-browser.ts']:
            for query in queries(path.relative_to(ROOT)):
                self.db.execute('EXPLAIN '+query, [None]*query.count('?'))

    def test_terminal_grant_cannot_cross_tenants_or_replay(self):
        claim=sql('lib/terminal-service.ts', "UPDATE approvals SET state='executing' WHERE id=? AND owner=? AND state='approved'")
        self.assertEqual(self.db.execute(claim, ('a','bob')).rowcount,0)
        self.assertEqual(self.db.execute(claim, ('a','alice')).rowcount,1)
        self.assertEqual(self.db.execute(claim, ('a','alice')).rowcount,0)

    def test_command_grant_expiry_and_kind_are_enforced(self):
        query=sql('lib/terminal-service.ts','SELECT * FROM approvals WHERE id=? AND project=?')
        self.assertIsNotNone(self.db.execute(query, ('a','p','alice',999)).fetchone())
        self.assertIsNone(self.db.execute(query, ('a','p','alice',1000)).fetchone())
        self.db.execute("UPDATE approvals SET kind='plugin' WHERE id='a'")
        self.assertIsNone(self.db.execute(query, ('a','p','alice',999)).fetchone())

    def test_concurrent_edit_cannot_overwrite_a_newer_revision(self):
        query=sql('app/api/workspace/route.ts','UPDATE projects SET files=?,name=?')
        self.assertEqual(self.db.execute(query, ('{"a":"new"}','Test','now','p','alice',3)).rowcount,1)
        self.assertEqual(self.db.execute(query, ('{"a":"stale"}','Test','now','p','alice',3)).rowcount,0)
        self.assertEqual(self.db.execute('SELECT files FROM projects WHERE id="p"').fetchone()[0],'{"a":"new"}')

    def test_agent_start_is_exclusive_for_a_workspace(self):
        query=sql('app/api/agent/route.ts','INSERT INTO agent_runs')
        def start(identifier):
            return self.db.execute(query,(identifier,'alice','p','goal','{}','now','now','alice','p')).rowcount
        self.assertEqual(start('one'),1)
        self.assertEqual(start('two'),0)
        self.db.execute("UPDATE agent_runs SET state='complete' WHERE id='one'")
        self.assertEqual(start('three'),1)

    def test_agent_step_lease_is_exclusive(self):
        query=sql('app/api/agent/route.ts','INSERT INTO agent_runs')
        self.db.execute(query,('run','alice','p','goal','{}','now','now','alice','p'))
        claim=sql('app/api/agent/route.ts',"UPDATE agent_runs SET state='thinking',lease=?")
        self.assertEqual(self.db.execute(claim,('lease1',1500,'now','run','alice')).rowcount,1)
        self.assertEqual(self.db.execute(claim,('lease2',1500,'now','run','alice')).rowcount,0)

if __name__ == '__main__': unittest.main()
