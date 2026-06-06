import urllib.request, json
req = urllib.request.Request('http://localhost:8000/platform/auth/login',
    data=json.dumps({'email': 'superadmin@bstk.in', 'password': 'Tharunkumar123@#!'}).encode(),
    headers={'Content-Type': 'application/json'}, method='POST')
r = urllib.request.urlopen(req)
token = json.loads(r.read())['access_token']
H = {'Authorization': f'Bearer {token}'}

tid = '6a215ffdf6d2ac752d1454f2'
for path in [f'/platform/tenants/{tid}', '/platform/plans', f'/platform/tenants/{tid}/admins']:
    try:
        r = urllib.request.urlopen(urllib.request.Request(f'http://localhost:8000{path}', headers=H))
        print(f'{path}: {r.status} OK')
    except urllib.error.HTTPError as e:
        print(f'{path}: {e.code} {e.read().decode()[:200]}')
