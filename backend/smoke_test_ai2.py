import urllib.request, json
# Login as platform owner
req = urllib.request.Request('http://localhost:8000/platform/auth/login',
    data=json.dumps({'email': 'superadmin@bstk.in', 'password': 'Tharunkumar123@#!'}).encode(),
    headers={'Content-Type':'application/json'}, method='POST')
r = urllib.request.urlopen(req)
token = json.loads(r.read())['access_token']
H = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}

# Reset BSTK admin password
tid = '6a215ffdf6d2ac752d1454f2'
req = urllib.request.Request(f'http://localhost:8000/platform/tenants/{tid}/admins',
    headers={'Authorization': f'Bearer {token}'})
r = urllib.request.urlopen(req)
admins = json.loads(r.read())
admin_id = admins['items'][0]['id']
print(f"Resetting password for {admins['items'][0]['email']} (id={admin_id})")

req = urllib.request.Request(
    f'http://localhost:8000/platform/tenants/{tid}/admins/{admin_id}/reset-password',
    data=b'{}', headers=H, method='POST')
r = urllib.request.urlopen(req)
new_pw = json.loads(r.read())['temp_password']
print(f"NEW PASSWORD: {new_pw}")

# Now login as admin
req = urllib.request.Request('http://localhost:8000/auth/login',
    data=json.dumps({'email': 'tharun@bstk.in', 'password': new_pw}).encode(),
    headers={'Content-Type': 'application/json'}, method='POST')
r = urllib.request.urlopen(req)
admin_token = json.loads(r.read())['access_token']
print(f"Admin login OK, token len={len(admin_token)}")

# Test AI dashboard
try:
    r = urllib.request.urlopen(urllib.request.Request('http://localhost:8000/ai/dashboard-summary',
        headers={'Authorization': f'Bearer {admin_token}'}))
    print('AI dashboard:', r.status, r.read().decode()[:200])
except urllib.error.HTTPError as e:
    print('AI dashboard ERROR:', e.code)
    print(e.read().decode()[:2000])
