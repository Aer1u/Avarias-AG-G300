import os

path = r'c:\Users\Pichau\OneDrive\Área de Trabalho\Avarias-AG-G300-main\src\app\page.tsx'
with open(path, 'rb') as f:
    content = f.read()

# We want to remove the trailing garbage. 
# Let's find the last occurrence of '}\n' or similar.
# Or just keep the first 1020 lines.

lines = content.splitlines()
# Keep only up to line 1020 (index 1019)
clean_lines = lines[:1020]

with open(path, 'wb') as f:
    f.write(b'\n'.join(clean_lines) + b'\n')

print(f"File cleaned. Kept {len(clean_lines)} lines.")
