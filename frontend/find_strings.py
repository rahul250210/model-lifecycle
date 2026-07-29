import re
with open('c:/Users/Rahul/Desktop/model_lifecycle/frontend/src/pages/dashboard/Dashboard.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 't(' not in line and 'import' not in line and 'console.' not in line and 'axios' not in line and 'http' not in line:
        matches = re.findall(r'>([^<]+)<', line)
        for m in matches:
            if re.search(r'[A-Za-z]{3,}', m) and '{' not in m:
                print(f'{i+1}: {m.strip()}')
        
        matches = re.findall(r'(?:title|label)="([A-Za-z][^"]+)"', line)
        for m in matches:
            if '{' not in m:
                print(f'{i+1}: attr: {m}')
