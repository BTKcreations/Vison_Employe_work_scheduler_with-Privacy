import urllib.request, json
# Login as the tenant admin of BSTK
req = urllib.request.Request('http://localhost:8000/auth/login',
    data=json.dumps({'email': 'tharun@bstk.in', 'password': 'Tharun@123'}).encode(),
    headers={'Content-Type': 'application/json'}, method='POST')
r = urllib.request.urlopen(req)
token = json.loads(r.read())['access_token']
H = {'Authorization': f'Bearer {token}'}

# Test 1: AI dashboard summary
try:
    r = urllib.request.urlopen(urllib.request.Request('http://localhost:8000/ai/dashboard-summary', headers=H))
    print('AI dashboard:', r.status, r.read().decode()[:200])
except urllib.error.HTTPError as e:
    print('AI dashboard ERROR:', e.code)
    print(e.read().decode()[:2000])
except Exception as e:
    print('AI dashboard EXCEPTION:', type(e).__name__, str(e))
