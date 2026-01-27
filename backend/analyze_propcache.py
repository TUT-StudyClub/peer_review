#!/usr/bin/env python3
"""
uv.lock の中で propcache パッケージに関連するブロックを全て検出して表示
"""

import re
from pathlib import Path

lock_file = Path(__file__).parent / "uv.lock"
content = lock_file.read_text(encoding="utf-8")

# [[package]] ブロックを全て抽出
pattern = re.compile(r"^\[\[package\]\](.*?)(?=^\[\[|$)", re.MULTILINE | re.DOTALL)
matches = pattern.finditer(content)

propcache_blocks = []
for i, match in enumerate(matches):
    block_text = "[[package]]" + match.group(1)

    # name を抽出
    name_match = re.search(r'name\s*=\s*"([^"]+)"', block_text)
    if name_match and name_match.group(1) == "propcache":
        # 行番号を計算
        start_pos = match.start()
        line_num = content[:start_pos].count("\n") + 1

        # source フィールドを確認
        source_match = re.search(r"source\s*=\s*\{[^}]+\}", block_text)
        has_source = bool(source_match)

        propcache_blocks.append(
            {
                "block_index": i,
                "line_num": line_num,
                "has_source": has_source,
                "block_text": block_text[:300] + "..." if len(block_text) > 300 else block_text,
            }
        )

print(f"Found {len(propcache_blocks)} propcache package block(s):\n")
for idx, block_info in enumerate(propcache_blocks, 1):
    print(f"Block {idx}:")
    print(f"  Block index: {block_info['block_index']}")
    print(f"  Line number: {block_info['line_num']}")
    print(f"  Has source field: {block_info['has_source']}")
    print(f"  First 300 chars: {block_info['block_text']}")
    print()

# propcache への依存参照も見つける
dependency_refs = []
for line_num, line in enumerate(content.split("\n"), 1):
    if "propcache" in line and 'name = "propcache"' not in line:
        dependency_refs.append((line_num, line.strip()))

print(f"\nFound {len(dependency_refs)} references to propcache:")
for line_num, line in dependency_refs[:10]:
    print(f"  Line {line_num}: {line}")
if len(dependency_refs) > 10:
    print(f"  ... and {len(dependency_refs) - 10} more")
