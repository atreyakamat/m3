import os
import json

locales_dir = 'apps/mobile/src/i18n/locales'
files = [f for f in os.listdir(locales_dir) if f.endswith('.json')]
files.sort()

# Keys to test across the 6 areas
keys_to_test = {
    'Dashboard': ['dashboard.greeting', 'dashboard.currentSite', 'dashboard.malariaStatus'],
    'Registration/Auth': ['auth.name', 'auth.phone', 'auth.pin', 'auth.register', 'auth.signIn'],
    'Symptoms': ['unwell.symptoms.fever', 'unwell.symptoms.chills', 'unwell.symptoms.headache', 'unwell.symptoms.bodyAche'],
    'Consent': ['screening.consent', 'screening.consentRequired'],
    'Errors/Alerts': ['travel.syncedAlert', 'travel.savedAlert', 'unwell.dialogTitle']
}

def get_nested(d, keypath):
    parts = keypath.split('.')
    cur = d
    for p in parts:
        if isinstance(cur, dict) and p in cur:
            cur = cur[p]
        else:
            return None
    return cur

matrix = []

for f in files:
    lang = f.replace('.json', '')
    with open(os.path.join(locales_dir, f), 'r', encoding='utf-8') as fp:
        data = json.load(fp)
    
    meta = data.get('_meta', {})
    row = {
        'code': lang,
        'name': meta.get('name', lang),
        'script': meta.get('script', 'Unknown'),
        'native_review': meta.get('native_review', False),
        'scores': {}
    }
    
    for category, klist in keys_to_test.items():
        present = 0
        samples = {}
        for k in klist:
            val = get_nested(data, k)
            if val is not None and str(val).strip() != '':
                present += 1
                samples[k] = val
        row['scores'][category] = {
            'present': present,
            'total': len(klist),
            'pct': round((present / len(klist)) * 100),
            'samples': samples
        }
    matrix.append(row)

with open('/tmp/language_matrix_results.json', 'w', encoding='utf-8') as fp:
    json.dump(matrix, fp, indent=2, ensure_ascii=False)

print(f"{'Code':5s} | {'Language':18s} | {'Script':12s} | {'Review':7s} | {'Dash':5s} | {'Auth':5s} | {'Sympt':5s} | {'Consent':7s} | {'Alerts':6s}")
print("-" * 85)
for r in matrix:
    print(f"{r['code']:5s} | {r['name'][:18]:18s} | {r['script']:12s} | {str(r['native_review']):7s} | "
          f"{r['scores']['Dashboard']['pct']:4d}% | {r['scores']['Registration/Auth']['pct']:4d}% | "
          f"{r['scores']['Symptoms']['pct']:4d}% | {r['scores']['Consent']['pct']:6d}% | "
          f"{r['scores']['Errors/Alerts']['pct']:5d}%")

