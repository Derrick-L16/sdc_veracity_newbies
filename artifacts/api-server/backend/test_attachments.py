"""Evidence domain regression tests; storage verification has its own tests."""
import json
import secrets
import unittest
import attachments as a
import server as s
import test_server as workflow


class AttachmentTests(unittest.TestCase):
    setUp = workflow.WorkflowTests.setUp
    tearDown = workflow.WorkflowTests.tearDown
    movements = workflow.WorkflowTests.movements
    count = workflow.WorkflowTests.count
    decide = workflow.WorkflowTests.decide
    def evidence(self, c, tail, method='POST', body=None, user=None):
        with s.connect() as db:
            db.execute('BEGIN IMMEDIATE' if method == 'POST' else 'BEGIN')
            return a.route(db, user or self.staff, ['evidence', c['id']] + tail.split('/'), method, body or {}, s)

    def ticket(self, c, user=None, **changes):
        body = {'requestKey': secrets.token_hex(16), 'filename': 'receipt.pdf',
                'contentType': 'application/pdf', 'size': 200, 'description': 'Receipt', 'version': 1, **changes}
        return self.evidence(c, 'uploads', body=body, user=user)

    def finalize(self, c, ticket, user=None):
        return self.evidence(c, 'uploads/' + ticket['id'] + '/finalize', body={'sha256': 'a'*64}, user=user)

    def current(self, c):
        with s.connect() as db:
            return s.load(db, c['id'], self.manager)

    def test_upload_is_additive_persistent_audited_and_idempotent(self):
        self.movements((-3,))
        c = self.count()
        before = s.dump(c['versions'])
        ticket = self.ticket(c, filename='../../odd"receipt.pdf')
        first = self.finalize(c, ticket)
        self.assertEqual(first, self.finalize(c, ticket))
        s.init()  # Simulate reopening the persisted SQLite store.
        saved = self.current(c)
        self.assertEqual(len(saved['attachments']), 1)
        self.assertEqual(saved['attachmentRevision'], 1)
        self.assertEqual(first['filename'], 'odd_receipt.pdf')
        self.assertEqual(saved['versions'][0]['evidenceState'], 'incomplete')
        self.assertEqual(s.dump(saved['versions']), before)
        with s.connect() as db:
            self.assertEqual(db.execute('SELECT recorded FROM products').fetchone()[0], 50)
            self.assertEqual(db.execute('SELECT count(*) FROM ledger').fetchone()[0], 0)
            self.assertEqual(db.execute('SELECT count(*) FROM movements WHERE posted_case IS NOT NULL').fetchone()[0], 0)
            self.assertEqual(db.execute("SELECT count(*) FROM audit WHERE action='evidence_uploaded'").fetchone()[0], 1)

    def test_pending_and_failed_uploads_have_no_attachment_metadata(self):
        c = self.count()
        ticket = self.ticket(c)
        with self.assertRaises(s.APIError):
            self.evidence(c, 'uploads/' + ticket['id'] + '/finalize', body={'sha256': 'bad'})
        self.assertNotIn('attachments', self.current(c))
        with s.connect() as db:
            self.assertEqual(db.execute("SELECT count(*) FROM audit WHERE action='evidence_uploaded'").fetchone()[0], 0)

    def test_retry_key_same_metadata_only(self):
        c = self.count()
        key = secrets.token_hex(16)
        ticket = self.ticket(c, requestKey=key)
        self.assertEqual(ticket, self.ticket(c, requestKey=key))
        with self.assertRaises(s.APIError):
            self.ticket(c, requestKey=key, description='different')

    def test_validation(self):
        c = self.count()
        for changes in ({'size': 0}, {'size': a.MAX_SIZE + 1}, {'size': True},
                        {'filename': 'fake.exe'}, {'contentType': 'text/csv'}, {'description': 'x'*1001},
                        {'version': 999}, {'requestKey': '../bad'}):
            with self.subTest(changes=changes), self.assertRaises(s.APIError):
                self.ticket(c, **changes)

    def test_staff_ownership_manager_access_owner_readonly(self):
        c = self.count()
        ticket = self.ticket(c, user=self.manager)
        attachment = self.finalize(c, ticket, user=self.manager)
        for user in (self.staff, self.manager, s.USERS['owner']):
            self.assertEqual(self.evidence(c, 'attachments/' + attachment['id'], user=user)['id'], attachment['id'])
        with self.assertRaises(s.APIError) as err:
            self.ticket(c, user=s.USERS['owner'])
        self.assertEqual(err.exception.status, 403)
        other = {**self.staff, 'id': 'other-staff', 'name': 'Other staff'}
        for tail, method in (('uploads', 'POST'), ('attachments/' + attachment['id'], 'POST')):
            with self.assertRaises(s.APIError) as err:
                self.evidence(c, tail, method=method, user=other)
            self.assertEqual(err.exception.status, 404)
        with self.assertRaises(s.APIError):
            self.evidence(c, 'uploads/' + ticket['id'], method='GET', user=self.staff)

    def test_upload_invalidates_every_preupload_decision_and_review(self):
        self.movements()
        c = self.count()
        self.finalize(c, self.ticket(c))
        for action in ('approved', 'overridden', 'rejected', 'review'):
            with self.subTest(action=action), self.assertRaises(s.APIError) as err:
                self.decide(c, action)
            self.assertEqual(err.exception.status, 409)
        current = self.current(c)
        with s.connect() as db:
            s.decision(db, self.manager, current, {'version': 1, 'attachmentRevision': 1,
                'action': 'approved', 'reason': 'All documents reviewed'})
        self.assertEqual(self.current(c)['status'], 'completed')
        self.assertEqual(self.current(c)['decision']['attachmentIds'], [current['attachments'][0]['id']])

    def test_historical_snapshot_excludes_later_uploads_and_closed_is_readonly(self):
        c = self.count()
        first = self.finalize(c, self.ticket(c))
        with s.connect() as db:
            current = s.load(db, c['id'], self.manager)
            s.add_assessment(db, current); s.save(db, current)
        ticket = self.ticket(c, version=2)
        second = self.finalize(c, ticket)
        with self.assertRaises(s.APIError):
            self.evidence(c, 'attachments/' + first['id'], body={'version': 1})
        self.assertEqual(self.evidence(c, 'attachments/' + first['id'], body={'version': 2})['id'], first['id'])
        with self.assertRaises(s.APIError):
            self.evidence(c, 'attachments/' + second['id'], body={'version': 2})
        current = self.current(c)
        with s.connect() as db:
            s.decision(db, self.manager, current, {'version': 2, 'attachmentRevision': 2, 'action': 'rejected', 'reason': 'Reviewed'})
        self.assertEqual(self.evidence(c, 'attachments/' + second['id'])['id'], second['id'])
        self.assertEqual(self.finalize(c, ticket)['id'], second['id'])  # Lost-response retry does not alter closed evidence.
        with self.assertRaises(s.APIError):
            self.ticket(c, version=2)

    def test_close_or_reassessment_during_upload_blocks_finalization(self):
        c = self.count()
        ticket = self.ticket(c)
        with s.connect() as db:
            current = s.load(db, c['id'], self.manager)
            s.add_assessment(db, current); s.save(db, current)
        with self.assertRaises(s.APIError):
            self.finalize(c, ticket)
        fresh_ticket = self.ticket(c, version=2)
        self.decide(self.current(c), 'rejected')
        with self.assertRaises(s.APIError):
            self.finalize(c, fresh_ticket)


if __name__ == '__main__':
    unittest.main()
