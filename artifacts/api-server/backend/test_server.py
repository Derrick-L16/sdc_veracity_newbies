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
            summary=s.state(db,self.manager)['summary']
            self.assertEqual(summary['counts']['verified'],1)
            self.assertEqual(summary['matches'],1)
            row=next(item for item in summary['items'] if item['productId']=='A')
            self.assertEqual((row['counted'],row['recorded'],row['difference'],row['status']),(50,50,0,'matched'))
    def test_stock_summary_rows_use_open_case_counts_and_prioritize_differences(self):
        case=self.count()
        with s.connect() as db:
            summary=s.state(db,self.manager)['summary']
            row=next(item for item in summary['items'] if item['productId']=='A')
            self.assertEqual((row['counted'],row['recorded'],row['difference'],row['status'],row['caseId']),(43,50,-7,'difference',case['id']))
            self.assertEqual(summary['items'][0]['status'],'difference')
            self.assertIsNotNone(summary['updatedAt'])
    def test_product_creation_is_role_checked_audited_and_visible_in_summary(self):
        with s.connect() as db:
            product=s.create_product(db,self.staff,{'name':'New tea','recorded':12,'unit_cost':2.5,'note':'Opening stock'})
            self.assertEqual(product['recorded'],12)
            self.assertTrue(product['evidence_missing'])
            summary=s.state(db,self.manager)['summary']
            row=next(item for item in summary['items'] if item['productId']==product['id'])
            self.assertEqual(row['status'],'not_counted')
            self.assertEqual(row['recorded'],12)
            event=db.execute("SELECT action,detail FROM audit WHERE action='product_created'").fetchone()
            self.assertEqual(event['action'],'product_created')
            self.assertIn('Opening stock',event['detail'])
            with self.assertRaises(s.APIError) as error:
                s.create_product(db,self.manager,{'name':'new TEA','recorded':0})
            self.assertEqual(error.exception.status,409)
            for bad_cost in (-1, float('inf'), True, '2.5'):
                with self.subTest(unit_cost=bad_cost), self.assertRaises(s.APIError):
                    s.create_product(db,self.manager,{'name':f'Invalid {str(bad_cost)}','recorded':0,'unit_cost':bad_cost})
            with self.assertRaises(s.APIError) as forbidden:
                s.create_product(db,s.USERS['owner'],{'name':'Owner product','recorded':1})
            self.assertEqual(forbidden.exception.status,403)
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
