import json
import os
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import server as s

class WorkflowTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();s.DB=str(Path(self.temp.name)/'test.sqlite3');s.init();self.manager=s.USERS['manager'];self.staff=s.USERS['staff']
        with s.connect() as db:
            s.import_rows(db,self.manager,{'kind':'products','rows':[{'id':'A','name':'Drink','recorded':50,'unit_cost':2.5}]})
    def tearDown(self):self.temp.cleanup()
    def movements(self,quantities=(-3,-2,-2),conflict=''):
        with s.connect() as db:
            s.import_rows(db,self.manager,{'kind':'movements','rows':[{'id':f'T{i}','product_id':'A','kind':'Sale','quantity':q,'occurred_at':'2026-01-01T00:00:00Z','conflict_ref':conflict} for i,q in enumerate(quantities)]})
    def count(self):
        with s.connect() as db:return s.create_count(db,self.staff,{'product':'Drink','recorded':50,'counted':43})
    def decide(self,c,action='approved',user=None,version=None):
        with s.connect() as db:
            db.execute('BEGIN IMMEDIATE');current=s.load(db,c['id'],user or self.manager)
            return s.decision(db,user or self.manager,current,{'action':action,'reason':'Verified against source documents','version':version or c['versions'][-1]['version']})
    def test_success_persists_and_never_double_posts(self):
        self.movements();c=self.count();self.assertEqual(c['status'],'pending_approval');self.decide(c)
        with s.connect() as db:
            self.assertEqual(db.execute('SELECT recorded FROM products').fetchone()[0],43)
            self.assertEqual(db.execute('SELECT count(*) FROM movements WHERE posted_case IS NOT NULL').fetchone()[0],3)
            self.assertEqual(db.execute('SELECT count(*) FROM ledger').fetchone()[0],1)
            self.assertEqual(s.load(db,c['id'],self.manager)['status'],'completed')
        with self.assertRaises(s.APIError):self.decide(c)
    def test_staff_and_owner_cannot_decide(self):
        self.movements();c=self.count()
        for role in ('staff','owner'):
            with self.assertRaises(s.APIError) as e:self.decide(c,user=s.USERS[role])
            self.assertEqual(e.exception.status,403)
    def test_incomplete_cannot_approve(self):
        self.movements((-3,));c=self.count();self.assertEqual(c['versions'][0]['unexplained'],4)
        with self.assertRaises(s.APIError):self.decide(c)
    def test_conflicts_cannot_approve(self):
        self.movements(conflict='disputed');c=self.count();self.assertEqual(c['versions'][0]['evidenceState'],'conflicting')
        with self.assertRaises(s.APIError):self.decide(c)
    def test_reassessment_preserves_first_snapshot(self):
        self.movements((-3,));c=self.count();original=json.dumps(c['versions'][0],sort_keys=True)
        with s.connect() as db:
            s.import_rows(db,self.manager,{'kind':'movements','rows':[{'id':'damage','product_id':'A','kind':'Damage','quantity':-4,'occurred_at':'2026-01-01T00:00:00Z'}]})
            s.add_assessment(db,c);s.save(db,c)
        self.assertEqual(json.dumps(c['versions'][0],sort_keys=True),original);self.assertEqual(c['versions'][1]['evidenceState'],'supported')
        with self.assertRaises(s.APIError):self.decide(c,version=1)
        self.decide(c)
    def test_changed_evidence_blocks_decision(self):
        self.movements();c=self.count()
        with s.connect() as db:db.execute("UPDATE movements SET quantity=-4,revision=revision+1 WHERE id='T0'")
        with self.assertRaises(s.APIError):self.decide(c)
    def test_changed_inventory_blocks_override(self):
        c=self.count()
        with s.connect() as db:db.execute('UPDATE products SET recorded=49,revision=revision+1')
        with self.assertRaises(s.APIError):self.decide(c,'overridden')
    def test_override_is_explicit_and_does_not_consume_uncertain_sources(self):
        self.movements((-3,));c=self.count();self.decide(c,'overridden')
        with s.connect() as db:
            self.assertEqual(db.execute('SELECT recorded FROM products').fetchone()[0],43)
            self.assertIsNone(db.execute('SELECT posted_case FROM movements').fetchone()[0])
    def test_rejection_keeps_stock(self):
        c=self.count();self.decide(c,'rejected')
        with s.connect() as db:self.assertEqual(db.execute('SELECT recorded FROM products').fetchone()[0],50)
    def test_duplicate_count_and_invalid_count(self):
        self.count()
        with s.connect() as db:
            with self.assertRaises(s.APIError):s.create_count(db,self.staff,{'product':'Drink','counted':43})
            with self.assertRaises(s.APIError):s.create_count(db,self.staff,{'product':'Drink','counted':-1})
    def test_no_difference_is_saved(self):
        with s.connect() as db:
            self.assertEqual(s.create_count(db,self.staff,{'product':'Drink','counted':50}),{'matched':True})
            self.assertEqual(s.state(db,self.manager)['summary']['counts']['verified'],1)
    def test_concurrent_decisions_only_commit_once(self):
        self.movements();c=self.count()
        def run(_):
            try:self.decide(c);return 'ok'
            except s.APIError:return 'blocked'
        with ThreadPoolExecutor(2) as pool:self.assertEqual(sorted(pool.map(run,range(2))),['blocked','ok'])
    def test_import_atomic_rollback(self):
        with self.assertRaises(Exception):
            with s.connect() as db:s.import_rows(db,self.manager,{'kind':'products','rows':[{'id':'B','name':'New','recorded':1},{'id':'A','name':'Duplicate','recorded':2}]})
        with s.connect() as db:self.assertEqual(db.execute('SELECT count(*) FROM products').fetchone()[0],1)
    def test_never_select_subset_to_force_match(self):
        self.movements((-7,-2));c=self.count();self.assertNotEqual(c['versions'][0]['evidenceState'],'supported')

if __name__=='__main__':unittest.main()
