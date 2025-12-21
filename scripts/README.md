# Deployment Scripts

This directory contains automation scripts to deploy the Peer Review application to AWS.

## Prerequisites
1.  **AWS CLI**: Installed and configured (`aws configure`).
2.  **Docker**: Installed and running.
3.  **jq**: Installed (`brew install jq` on macOS).

## Usage

1.  Open a terminal in the project root.
2.  Run the deployment script:
    ```bash
    ./scripts/deploy_aws.sh
    ```

## What the script does
1.  **S3**: Creates a bucket for file uploads.
2.  **IAM**: Creates the `apprunner-s3-access` role.
3.  **RDS**: Creates a PostgreSQL database (if it doesn't exist) and waits for it to become available.
4.  **ECR**: Builds the backend Docker image and pushes it to Amazon ECR.
5.  **App Runner**: Creates the API service, connecting it to RDS and S3.

## Post-Script Steps
1.  **Frontend (Cloudflare Pages)**:
    -   Go to Cloudflare Dashboard.
    -   Create a new Pages project > Connect to Git.
    -   Settings > Environment Variables:
        -   `NEXT_PUBLIC_API_BASE_URL`: Copy the App Runner URL (e.g., `https://xxxx.awsapprunner.com`).
