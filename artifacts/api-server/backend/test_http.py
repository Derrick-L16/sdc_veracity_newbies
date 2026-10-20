"""Exercise cookie authentication and HTTP routing against an ephemeral API."""
import json
import tempfile
import threading
import unittest
import urllib.request
import urllib.error
import http.cookiejar
from pathlib import Path
from http.server import ThreadingHTTPServer
import server as s

class HTTPTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();s.DB=str(Path(self.temp.name)/'http.sqlite3');s.init()
        self.http=ThreadingHTTPServer(('127.0.0.1',0),s.Handler)
        self.thread=threading.Thread(target=self.http.serve_forever,daemon=True);self.thread.start()
        self.base=f'http://127.0.0.1:{self.http.server_port}/'
        self.opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    def tearDown(self):
        self.http.shutdown();self.http.server_close();self.thread.join();self.temp.cleanup()
    def call(self,path,body=None):
        request=urllib.request.Request(self.base+path,data=json.dumps(body).encode() if body is not None else None,headers={'Content-Type':'application/json'})
        with self.opener.open(request,timeout=5) as response:return json.load(response)
    def test_session_permissions_and_full_journey(self):
        with self.assertRaises(urllib.error.HTTPError) as err:self.call('state')
        self.assertEqual(err.exception.code,401)
        self.call('session',{'role':'manager'})
        self.call('imports',{'kind':'products','rows':[{'id':'A','name':'Drink','recorded':50}]})
        self.call('imports',{'kind':'movements','rows':[{'id':'T1','product_id':'A','kind':'Sale','quantity':-7,'occurred_at':'2026-01-01T00:00:00Z'}]})
        self.call('session',{'role':'staff'})
        c=self.call('counts',{'productId':'A','counted':43})
        with self.assertRaises(urllib.error.HTTPError) as err:self.call('cases/'+c['id']+'/decisions',{'action':'approved','reason':'Verified','version':1})
        self.assertEqual(err.exception.code,403)
        self.call('session',{'role':'manager'})
        result=self.call('cases/'+c['id']+'/decisions',{'action':'approved','reason':'Verified','version':1})
        self.assertEqual(result['finalStock'],43)
        self.assertEqual(self.call('state')['products'][0]['recorded'],43)
        self.assertTrue(self.call('cases/'+c['id']+'/audit'))
    def test_bad_json_and_unsigned_role_header_do_not_authorize(self):
        req=urllib.request.Request(self.base+'state',headers={'X-Role':'manager'})
        with self.assertRaises(urllib.error.HTTPError) as err:self.opener.open(req,timeout=5)
        self.assertEqual(err.exception.code,401)
        req=urllib.request.Request(self.base+'counts',data=b'not json',headers={'Content-Type':'application/json'})
        with self.assertRaises(urllib.error.HTTPError) as err:self.opener.open(req,timeout=5)
        self.assertEqual(err.exception.code,400)

if __name__=='__main__':unittest.main()
