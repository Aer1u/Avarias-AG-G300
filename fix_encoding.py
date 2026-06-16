import re

file_path = r"src\app\page.tsx"

with open(file_path, "rb") as f:
    raw = f.read()

# The file is UTF-8 but contains mojibake: text was originally UTF-8,
# read as Latin-1, then re-encoded as UTF-8 (double-encoded).
# Fix: decode as UTF-8, then re-encode each character that is mojibake
# by decoding the Latin-1 interpretation back to UTF-8.

text = raw.decode("utf-8", errors="replace")

# Fix double-encoded sequences: decode as latin-1 then re-encode as utf-8
def fix_mojibake(s):
    result = []
    i = 0
    while i < len(s):
        # Check if current char is a mojibake indicator (high latin chars)
        c = s[i]
        if ord(c) > 127:
            # Try to collect the mojibake sequence and fix it
            try:
                # Encode back to latin-1 bytes, then decode as utf-8
                chunk = c
                encoded = chunk.encode("latin-1")
                # See if the next char completes a utf-8 sequence
                if i + 1 < len(s) and ord(s[i+1]) > 127:
                    chunk2 = chunk + s[i+1]
                    try:
                        encoded2 = chunk2.encode("latin-1")
                        fixed = encoded2.decode("utf-8")
                        result.append(fixed)
                        i += 2
                        continue
                    except (UnicodeEncodeError, UnicodeDecodeError):
                        pass
                # Single high char
                fixed = encoded.decode("utf-8", errors="replace")
                result.append(fixed)
                i += 1
            except (UnicodeEncodeError, UnicodeDecodeError):
                result.append(c)
                i += 1
        else:
            result.append(c)
            i += 1
    return "".join(result)

fixed = fix_mojibake(text)

# Also do specific known bad strings just in case
replacements = [
    ("ArmazÃ©m",  "Armazém"),
    ("ARMAZÃ©M",  "ARMAZÉM"),
    ("DescriÃ§Ã£o", "Descrição"),
    ("Descri\ufffd\ufffdo", "Descrição"),
    ("opÃ§Ã£o",   "opção"),
    ("Ã\ufffd rea", "Área"),
    ("Ã rea",     "Área"),
    ("SeguranÃ§a","Segurança"),
    ("rÃ¡pido",   "rápido"),
    ("rÃ¢pido",   "rápido"),
    ("configuraÃ§Ã£o", "configuração"),
    ("localizaÃ§Ãµes", "localizações"),
    ("saldos",    "saldos"),
    ("P\ufffdS",  "PÇS"),
]

for bad, good in replacements:
    fixed = fixed.replace(bad, good)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(fixed)

print("Done! File re-written with proper UTF-8 encoding.")

# Verify
with open(file_path, "rb") as f:
    check = f.read()
check_text = check.decode("utf-8")
count = check_text.count("Armazém") + check_text.count("ARMAZÉM")
print(f"Occurrences of correct 'Armazém/ARMAZÉM': {count}")
