#!/usr/bin/env python3
# Script to remove line 221 from App.jsx

file_path = r'C:\Users\acayr\Desktop\DEV\Orga PRO\orga-pro\src\components\App.jsx'

# Read the file
with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Print line 221 for verification
print(f"Line 221 (before removal): {repr(lines[220])}")

# Remove line 221 (index 220)
del lines[220]

# Write the file back
with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("Line 221 removed successfully!")
print(f"Total lines remaining: {len(lines)}")
