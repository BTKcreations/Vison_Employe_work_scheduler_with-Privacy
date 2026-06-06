import os
models_dir = r"C:\Users\USER\Desktop\PROJECTS\Annaya_Projects\Vison_Employe_work_scheduler_with Privacy\backend\app\models"
routes_dir = r"C:\Users\USER\Desktop\PROJECTS\Annaya_Projects\Vison_Employe_work_scheduler_with Privacy\backend\app\routes"

print("=" * 70)
print("MODELS — has company_id field?")
print("=" * 70)
for f in sorted(os.listdir(models_dir)):
    if not f.endswith(".py") or f.startswith("_"):
        continue
    with open(os.path.join(models_dir, f), encoding="utf-8") as fh:
        text = fh.read()
    has = "company_id" in text
    print(f"  {'OK ' if has else 'XX '} {f}")

print()
print("=" * 70)
print("ROUTES — references to company_id?")
print("=" * 70)
for f in sorted(os.listdir(routes_dir)):
    if not f.endswith(".py") or f.startswith("_"):
        continue
    with open(os.path.join(routes_dir, f), encoding="utf-8") as fh:
        text = fh.read()
    has = "company_id" in text
    n = text.count("company_id")
    print(f"  {'OK ' if has else 'XX '} {f}  ({n} refs)")
