import os
import subprocess
import sys
import time


def get_full_diff(pr_number):
    """Retrieves the full diff of the pull request."""
    try:
        if not pr_number:
            print("Not running in a PR context.", file=sys.stderr)
            return None
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

    lines = diff_content.split("\n")
    for line in lines:
        if line.startswith("diff --git"):
            if current_file:
                file_diffs[current_file] = "\n".join(current_lines)
            current_lines = [line]
            parts = line.split(" ")
            if len(parts) >= 4:
                b_path = parts[-1]
                current_file = b_path[2:] if b_path.startswith("b/") else b_path
            else:
                current_file = "unknown_file"
        else:
            if current_file:
                current_lines.append(line)

    if current_file:
        file_diffs[current_file] = "\n".join(current_lines)
    return file_diffs


def run_gemini_review_batch(files_batch):
    """Runs Gemini CLI to review a batch of files."""
    if not files_batch:
        return

    # Construct compiled prompt for the batch
    prompt_content = ""
    for fpath, fdiff in files_batch:
        prompt_content += f"\n\n=== File: {fpath} ===\n```\n{fdiff}\n```\n"

    prompt = f"""
You are an expert code reviewer. Review the following code changes from a Pull Request.
The changes are provided as a list of files with their diffs.
Focus on potential bugs, security issues, performance improvements, and code style.
For each file, clearly state the filename and provide your review comments.
If a file looks good, you can simply say "LGTM" or "No issues found".
Output your review in Japanese / 日本語.

Changes to review:
{prompt_content}
"""

    file_names = ", ".join([f[0] for f in files_batch])
    try:
        print(f"::: Reviewing Batch: {file_names} :::")

        process = subprocess.run(
            ["gemini", "--prompt", prompt],
            capture_output=True,
            text=True,
            env=os.environ,
        )

        if process.returncode != 0:
            print(
                f"Gemini verification failed for batch {file_names}: {process.stderr}",
                file=sys.stderr,
            )
            if "429" in process.stderr:
                print("Rate limit hit inside subprocess. Sleeping extra 60s...")
                time.sleep(60)
            return None
        else:
            print(process.stdout)
            return process.stdout

    except Exception as e:
        print(f"Failed to run Gemini for batch: {e}", file=sys.stderr)
        return None


def post_comment(pr_number, comment_body):
    """Posts a comment to the PR using gh CLI."""
    if not comment_body:
        return
    try:
        # Check comment length (GitHub limit is ~65536 chars)
        if len(comment_body) > 65000:
            comment_body = (
                comment_body[:65000] + "\n... (Comment truncated due to length)"
            )

        cmd = ["gh", "pr", "comment", pr_number, "--body", comment_body]
        subprocess.run(cmd, check=True)
        print("Posted comment to PR.")
    except subprocess.CalledProcessError as e:
        print(f"Failed to post comment: {e}", file=sys.stderr)


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

    # Filter files
    review_candidates = []
    for fpath, fdiff in file_diffs.items():
        if any(fpath.endswith(ex) for ex in excluded_files):
            continue
        # Skip huge single files (e.g. > 30KB) to avoid context limit issues in a batch
        if len(fdiff) > 30000:
            print(f"Skipping {fpath} because diff is too large ({len(fdiff)} chars).")
            continue
        review_candidates.append((fpath, fdiff))

    print(f"Reviewing {len(review_candidates)} files after exclusion.")

    # Batching Strategy
    # Group files so that total char count is < 4000 OR max 3 files per batch
    # Reduced from 20000/5 to avoid timeouts and header size issues
    BATCH_CHAR_LIMIT = 4000
    BATCH_FILE_LIMIT = 3

    batches = []
    current_batch = []
    current_char_count = 0

    for fpath, fdiff in review_candidates:
        if (
            len(current_batch) >= BATCH_FILE_LIMIT
            or (current_char_count + len(fdiff)) > BATCH_CHAR_LIMIT
        ):
            batches.append(current_batch)
            current_batch = []
            current_char_count = 0

        current_batch.append((fpath, fdiff))
        current_char_count += len(fdiff)

    if current_batch:
        batches.append(current_batch)

    print(f"Processing {len(batches)} batches.")

    for i, batch in enumerate(batches):
        print(f"--- Processing Batch {i + 1}/{len(batches)} ---")
        review_text = run_gemini_review_batch(batch)

        if review_text:
            # Post comment for each batch
            # We add a header to identify the batch
            file_list = ", ".join([f[0] for f in batch])
            comment = f"## Gemini Review (Batch {i + 1}/{len(batches)})\n\n**Files:** {file_list}\n\n{review_text}"
            post_comment(pr_number, comment)

        # Consistent sleep to avoid hitting RPM limits
        time.sleep(30)


if __name__ == "__main__":
    main()
