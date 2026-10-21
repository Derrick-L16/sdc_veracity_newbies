"""Additive evidence metadata. File bytes and verification belong to App Storage."""
import hashlib
import json
import re
import secrets

MAX_SIZE = 10 * 1024 * 1024
TYPES = {'image/jpeg': ('.jpg', '.jpeg'), 'image/png': ('.png',), 'application/pdf': ('.pdf',)}


def init(db):
    db.execute('''CREATE TABLE IF NOT EXISTS evidence_uploads(
        id TEXT PRIMARY KEY, case_id TEXT NOT NULL REFERENCES cases(id),
        actor_id TEXT NOT NULL, request_key TEXT NOT NULL, body TEXT NOT NULL,
        UNIQUE(case_id,actor_id,request_key))''')


def route(db, user, path, method, body, s):
    # The running domain module is passed in (also when executed as __main__).
    if len(path) < 3 or path[0] != 'evidence':
        raise s.APIError('Endpoint not found.', 404)
    c = s.load(db, path[1], user)
    if method == 'POST' and path[2:] == ['uploads']:
        s.require(user, ('staff', 'manager'))
        s.pending(c)
        if body.get('version') != c['versions'][-1]['version']:
            raise s.APIError('Assessment changed. Return to the current case before uploading.', 409)
        key = body.get('requestKey', '')
        if not isinstance(key, str) or not re.fullmatch(r'[a-zA-Z0-9-]{16,80}', key):
            raise s.APIError('A valid upload retry key is required.')
        filename = body.get('filename')
        content_type = body.get('contentType')
        size = body.get('size')
        description = body.get('description', '')
        if not isinstance(filename, str) or not 1 <= len(filename) <= 240:
            raise s.APIError('Filename must contain 1–240 characters.')
        filename = re.sub(r'[^a-zA-Z0-9._ -]', '_', filename.replace('\\', '/').split('/')[-1]).strip(' .')
        if content_type not in TYPES or not filename.lower().endswith(TYPES[content_type]):
            raise s.APIError('Choose a JPEG, PNG or PDF with the matching filename extension.')
        if isinstance(size, bool) or not isinstance(size, int) or not 0 < size <= MAX_SIZE:
            raise s.APIError('Each file must be nonempty and no larger than 10 MB.', 413)
        if not isinstance(description, str) or len(description) > 1000:
            raise s.APIError('Description must be at most 1000 characters.')
        metadata = {'filename': filename, 'contentType': content_type, 'size': size, 'description': description.strip()}
        fingerprint = hashlib.sha256(s.dump(metadata).encode()).hexdigest()
        existing = db.execute('SELECT body FROM evidence_uploads WHERE case_id=? AND actor_id=? AND request_key=?',
                              (c['id'], user['id'], key)).fetchone()
        if existing:
            ticket = json.loads(existing['body'])
            if ticket['fingerprint'] != fingerprint:
                raise s.APIError('Retry must use the same file and description. Choose the file again to start a new upload.', 409)
            return ticket
        uid = secrets.token_hex(16)
        ticket = {**metadata, 'id': uid, 'caseId': c['id'], 'actorId': user['id'],
                  'uploader': user['name'], 'version': body['version'], 'fingerprint': fingerprint,
                  'stagingKey': 'evidence-staging/' + uid, 'objectKey': 'case-evidence/' + uid}
        db.execute('INSERT INTO evidence_uploads VALUES(?,?,?,?,?)', (uid, c['id'], user['id'], key, s.dump(ticket)))
        return ticket
    if (len(path) == 4 and path[2] == 'uploads') or (len(path) == 5 and path[2] == 'uploads' and path[4] == 'finalize'):
        s.require(user, ('staff', 'manager'))
        row = db.execute('SELECT body FROM evidence_uploads WHERE id=? AND case_id=? AND actor_id=?',
                         (path[3], c['id'], user['id'])).fetchone()
        if not row:
            raise s.APIError('Upload not found for this user and case.', 404)
        ticket = json.loads(row['body'])
        existing = next((a for a in c.get('attachments', []) if a['id'] == ticket['id']), None)
        if method == 'POST' and len(path) == 5:
            if existing:
                return existing
            s.pending(c)
            if ticket['version'] != c['versions'][-1]['version']:
                raise s.APIError('Assessment changed during upload. Refresh and choose the file again.', 409)
            if not re.fullmatch(r'[a-f0-9]{64}', str(body.get('sha256', ''))):
                raise s.APIError('Stored file verification is required.')
            revision = c.get('attachmentRevision', 0) + 1
            attachment = {k: ticket[k] for k in ('id', 'filename', 'contentType', 'size', 'description', 'uploader', 'objectKey')}
            attachment.update({'uploadedAt': s.now(), 'revision': revision, 'sha256': body['sha256']})
            c.setdefault('attachments', []).append(attachment)
            c['attachmentRevision'] = revision
            c['timeline'].append({'stage': 'evidence', 'summary': 'Document uploaded for human review: ' + attachment['filename'],
                                  'at': attachment['uploadedAt'], 'actor': user['name']})
            s.save(db, c)
            s.audit(db, user, 'evidence_uploaded', c['id'], {**attachment, 'assessmentVersion': ticket['version']})
            return attachment
        if method == 'GET' and len(path) == 4:
            if not existing:
                s.pending(c)
            return {**ticket, 'finalized': existing is not None}
    if method == 'POST' and len(path) == 4 and path[2] == 'attachments':
        attachment = next((a for a in c.get('attachments', []) if a['id'] == path[3]), None)
        if not attachment:
            raise s.APIError('Attachment not found.', 404)
        version = body.get('version')
        if version is not None:
            viewed = next((v for v in c['versions'] if v['version'] == version), None)
            if not viewed or attachment['id'] not in viewed.get('attachmentIds', []):
                raise s.APIError('This attachment was not available at that assessment.', 404)
        return attachment
    raise s.APIError('Endpoint not found.', 404)
