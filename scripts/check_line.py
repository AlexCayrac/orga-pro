#!/usr/bin/env python3
import sys

file_path = r'C:\Users\acayr\Desktop\DEV\Orga PRO\orga-pro\src\components\App.jsx'

with open(file_path, 'rb') as f:
    lines = f.readlines()
    # Line 221 is index 220
    line_221 = lines[220]
    print(f"Line 221 (bytes): {line_221}")
    print(f"Line 221 (hex): {line_221.hex()}")
    print(f"Line 221 (decoded): {line_221.decode('utf-8', errors='replace')}")
