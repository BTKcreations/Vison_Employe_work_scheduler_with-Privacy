import urllib.request, json
req = urllib.request.Request('http://localhost:8000/platform/auth/login',
    data=json.dumps({'email': 'superadmin@bstk.in', 'password': 'Tharunkumar123@#!'}).encode(),
    headers={'Content-Type': 'application/json'}, method='POST')
r = urllib.request.urlopen(req)
token = json.loads(r.read())['access_token']

req = urllib.request.Request('http://localhost:8000/platform/tenants',
    headers={'Authorization': f'Bearer {token}'})
r = urllib.request.urlopen(req)
data = json.loads(r.read())
tenant = next((t for t in data['items'] if t.get('admin_count', 0) > 0), data['items'][0])
print(f"Using tenant: {tenant['name']} ({tenant['id']}) admin_count={tenant.get('admin_count')}")

try:
    req = urllib.request.Request(f'http://localhost:8000/platform/tenants/{tenant["id"]}/admins',
        headers={'Authorization': f'Bearer {token}'})
    r = urllib.request.urlopen(req)
    print('LIST ADMINS:', r.status)
    admins = json.loads(r.read())
    print(json.dumps(admins, indent=2, default=str)[:800])
except urllib.error.HTTPError as e:
    print('LIST ADMINS ERROR:', e.code, e.read().decode())
    admins = None

if admins and admins.get('items'):
    admin_id = admins['items'][0]['id']
    try:
        req = urllib.request.Request(
            f'http://localhost:8000/platform/tenants/{tenant["id"]}/admins/{admin_id}/reset-password',
            data=b'{}',
            headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'},
            method='POST')
        r = urllib.request.urlopen(req)
        print('\nRESET PW:', r.status)
        print(json.dumps(json.loads(r.read()), indent=2))
    except urllib.error.HTTPError as e:
        print('RESET PW ERROR:', e.code, e.read().decode())
