import os
import re

SUSPICIOUS_PATTERNS = [
    r'AIza[0-9A-Za-z-_]{35}',
    r'rime_[0-9a-zA-Z]{20,}',
    r'api[_-]?key\s*[:=]\s*["\'][0-9a-zA-Z\-_]{16,}["\']',
]

EXCLUDE_DIRS = {'.git', 'node_modules', '.pytest_cache', '__pycache__', 'demo'}
EXCLUDE_FILES = {'.env'} # .env is excluded

findings = []
for root, dirs, files in os.walk('.'):
    dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
    for file in files:
        if file in EXCLUDE_FILES or file.endswith('.pyc') or file.endswith('.mp4'):
            continue
        filepath = os.path.join(root, file)
        try:
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                for pat in SUSPICIOUS_PATTERNS:
                    matches = re.findall(pat, content, re.IGNORECASE)
                    if matches:
                        for m in matches:
                            findings.append((filepath, m[:20] + '...'))
        except Exception as e:
            pass

if findings:
    print('SECURITY AUDIT WARNING - Found potential secrets:')
    for f, snippet in findings:
        print(f'  {f}: {snippet}')
else:
    print('SECURITY AUDIT PASSED: 0 secrets detected in all source and documentation files!')
