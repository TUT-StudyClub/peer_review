# Test User Credentials

This directory contains dynamically generated test user credentials.

**⚠️ Security Notice:**
- Files in this directory are generated at runtime from environment variables
- This directory is excluded from version control via `.gitignore`
- Never commit actual passwords to the repository

## Configuration

Test user passwords are configured via environment variables in `.env`:

```bash
TEST_PASSWORD_TEACHER=teacher123
TEST_PASSWORD_STUDENT=student123
```

## Generated Files

When you run the database seed script, the following files are created:

- `test_users.json` - JSON format with all test user credentials
- `test_users.csv` - CSV format for easy spreadsheet import

## Usage

To generate test users and their credential files:

```bash
# Backend setup will automatically seed the database and generate files
cd backend
uv run uvicorn app.main:app --reload
```

Or manually trigger seeding if needed through your database initialization process.
