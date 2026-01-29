import os
import subprocess
import sys
import time


def get_full_diff(pr_number):
    """Retrieves the full diff of the pull request."""
    try:
        # Check if running in a PR context
        if not pr_number:
            print("Not running in a PR context.", file=sys.stderr)
            return None

        # Fetch the entire diff
        cmd = ["gh", "pr", "diff", pr_number]
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return result.stdout
    except subprocess.CalledProcessError as e:
        print(f"Error getting diff: {e}", file=sys.stderr)
        return None


def parse_diff(diff_content):
    """Parses the global diff into a dict of {filename: diff_chunk}."""
    file_diffs = {}
    current_file = None
    current_lines = []

    # Simple parser for git diff output
    lines = diff_content.split("\n")
    for line in lines:
        if line.startswith("diff --git"):
            # Save previous file
            if current_file:
                file_diffs[current_file] = "\n".join(current_lines)

            # Start new file
            current_lines = [line]
            # Extract filename (simple heuristic)
            parts = line.split(" ")
            if len(parts) >= 4:
                b_path = parts[-1]
                if b_path.startswith("b/"):
                    current_file = b_path[2:]
                else:
                    current_file = b_path
            else:
                current_file = "unknown_file"
        else:
            if current_file:
                current_lines.append(line)

    # Save last file
    if current_file:
        file_diffs[current_file] = "\n".join(current_lines)

    return file_diffs


def run_gemini_review(file_path, diff_content):
    """Runs Gemini CLI to review the specific file diff."""
    if not diff_content.strip():
        return

    prompt = f"""
You are an expert code reviewer. Review the following code diff for file `{file_path}`.
Focus on potential bugs, security issues, performance improvements, and code style.
Output your review in Japanese / 日本語.

Diff:
```
{diff_content}
```
"""

    try:
        print(f"::: Reviewing {file_path} :::")

        process = subprocess.run(
            ["gemini", "--prompt", prompt],
            capture_output=True,
            text=True,
            env=os.environ,
        )

        if process.returncode != 0:
            print(
                f"Gemini verification failed for {file_path}: {process.stderr}",
                file=sys.stderr,
            )
            if "429" in process.stderr:
                print("Rate limit hit inside subprocess. Sleeping extra 30s...")
                time.sleep(30)
        else:
            print(process.stdout)

    except Exception as e:
        print(f"Failed to run Gemini for {file_path}: {e}", file=sys.stderr)


def main():
    pr_number = os.environ.get("PULL_REQUEST_NUMBER")
    if not pr_number:
        print("PULL_REQUEST_NUMBER env var is required.", file=sys.stderr)
        sys.exit(1)

    print("Fetching full PR diff...")
    full_diff = get_full_diff(pr_number)

    if not full_diff:
        print("No diff found or error fetching diff.")
        return

    file_diffs = parse_diff(full_diff)
    print(f"Parsed {len(file_diffs)} files from diff.")

    excluded_files = [
        "package-lock.json",
        "yarn.lock",
        "pnpm-lock.yaml",
        "poetry.lock",
        "Pipfile.lock",
        "go.sum",
        "uv.lock",
    ]

    files_to_review = [
        f for f in file_diffs.keys() if not any(f.endswith(ex) for ex in excluded_files)
    ]

    print(f"Reviewing {len(files_to_review)} files after exclusion.")

    for file_path in files_to_review:
        diff = file_diffs[file_path]

        if len(diff) > 50000:
            print(
                f"Skipping {file_path} because diff is too large ({len(diff)} chars)."
            )
            continue

        run_gemini_review(file_path, diff)
        time.sleep(5)


if __name__ == "__main__":
    main()
