import os
import subprocess
import sys
import time


def get_changed_files():
    """Retrieves a list of changed files in the pull request."""
    try:
        # Check if running in a PR context
        pr_number = os.environ.get("PULL_REQUEST_NUMBER")
        if not pr_number:
            print("Not running in a PR context.", file=sys.stderr)
            return []

        # gh pr diff --name-only returns file paths, one per line
        cmd = ["gh", "pr", "diff", pr_number, "--name-only"]
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        files = result.stdout.strip().split("\n")
        return [f for f in files if f]
    except subprocess.CalledProcessError as e:
        print(f"Error getting changed files: {e}", file=sys.stderr)
        return []


def get_file_diff(pr_number, file_path):
    """Retrieves the diff for a specific file."""
    try:
        cmd = ["gh", "pr", "diff", pr_number, "--path", file_path]
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return result.stdout
    except subprocess.CalledProcessError as e:
        print(f"Error getting diff for {file_path}: {e}", file=sys.stderr)
        return None


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

        # Use simple text output, no JSON formatting needed for the basic review log
        # We assume the `gemini` command is in PATH and configured via env vars
        # The prompt is passed via --prompt argument.

        # NOTE: If prompt is too long for CLI arg, we might need a temp file.
        # But for batched file diffs (unless huge), it's likely okay.
        # Ideally, we should check length or stream it.
        # Let's try passing as arg first.

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
            # If rate limited, we might want to wait longer here too, but the main loop sleep helps
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
        # Fallback for manual run or testing
        # Or try to get from GITHUB_EVENT_PATH if available
        print("PULL_REQUEST_NUMBER env var is required.", file=sys.stderr)
        sys.exit(1)

    changed_files = get_changed_files()
    if not changed_files:
        print("No changed files found.")
        return

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
        f for f in changed_files if not any(f.endswith(ex) for ex in excluded_files)
    ]

    print(
        f"Found {len(changed_files)} files. Reviewing {len(files_to_review)} files after exclusion."
    )

    for file_path in files_to_review:
        print(f"Fetching diff for: {file_path}")
        diff = get_file_diff(pr_number, file_path)

        # Skip if diff is empty or too large (simple heuristic, e.g. > 100kb char)
        if not diff:
            continue
        if len(diff) > 100000:
            print(
                f"Skipping {file_path} because diff is too large ({len(diff)} chars)."
            )
            continue

        run_gemini_review(file_path, diff)

        # Sleep to respect rate limits (approx 15 RPM for free tier sometimes, or just to be safe)
        time.sleep(5)


if __name__ == "__main__":
    main()
