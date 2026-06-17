import os
import re

src_dir = "/Users/harshsagar/Desktop/HARVESTIQ COPY/harvestiq-client/src"

# Regex to find JSX text nodes that contain alphabetical characters and are not wrapped in curly braces
# Matches text between '>' and '<'
jsx_text_re = re.compile(r'>\s*([A-Za-z\u0900-\u097F][^<>{}]*?)\s*<')

# Regex to find placeholder, label, title attributes with hardcoded strings
attr_re = re.compile(r'\b(placeholder|label|title)="([A-Za-z\u0900-\u097F][^"]+?)"')

findings = []

for root, dirs, files in os.walk(src_dir):
    for file in files:
        if file.endswith(".tsx"):
            file_path = os.path.join(root, file)
            with open(file_path, "r", encoding="utf-8") as f:
                lines = f.readlines()
            
            for line_idx, line in enumerate(lines):
                line_num = line_idx + 1
                # Skip comments or imports
                stripped = line.strip()
                if stripped.startswith("//") or stripped.startswith("import") or stripped.startswith("*"):
                    continue
                
                # Check for JSX text nodes
                for match in jsx_text_re.finditer(line):
                    text = match.group(1).strip()
                    # Skip values that are purely numbers or variables
                    if text and not text.startswith("{") and not text.endswith("}"):
                        # Extra filter to ignore CSS, tailwind style strings or very short tags
                        if len(text) > 1 and not text.startswith(".") and not text.startswith("#"):
                            findings.append({
                                "file": os.path.relpath(file_path, src_dir),
                                "line": line_num,
                                "type": "JSX Text Node",
                                "string": text
                            })
                
                # Check for hardcoded attributes
                for match in attr_re.finditer(line):
                    attr_name = match.group(1)
                    text = match.group(2).strip()
                    findings.append({
                        "file": os.path.relpath(file_path, src_dir),
                        "line": line_num,
                        "type": f"Attribute ({attr_name})",
                        "string": text
                    })

print(f"Found {len(findings)} potential untranslated items:")
for f in findings:
    print(f"{f['file']}:{f['line']} [{f['type']}] -> \"{f['string']}\"")
