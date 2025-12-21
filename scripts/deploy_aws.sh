#!/bin/bash
set -e

# ==========================================
# Configuration
# ==========================================
PROJECT_NAME="peer-review"
REGION="ap-northeast-1"
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
S3_BUCKET_NAME="${PROJECT_NAME}-uploads-${AWS_ACCOUNT_ID}"
REPO_NAME="${PROJECT_NAME}-api"
DB_INSTANCE_IDENTIFIER="${PROJECT_NAME}-db"
DB_NAME="pure_review"
DB_USERNAME="postgres"
# Generate a random password if not provided (alphanumeric only to avoid RDS issues)
DB_PASSWORD=${DB_PASSWORD:-$(openssl rand -base64 12 | tr -dc 'a-zA-Z0-9' | head -c 16)}
SERVICE_NAME="${PROJECT_NAME}-api"
IAM_ROLE_NAME="apprunner-s3-access"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%dT%H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[WARN] $1${NC}"
}

# ==========================================
# 0. Prerequisites Check
# ==========================================
log "Checking prerequisites..."
command -v aws >/dev/null 2>&1 || { echo >&2 "AWS CLI is required but not installed. Aborting."; exit 1; }
command -v docker >/dev/null 2>&1 || { echo >&2 "Docker is required but not installed. Aborting."; exit 1; }
command -v jq >/dev/null 2>&1 || { echo >&2 "jq is required but not installed. Aborting."; exit 1; }

# Save secrets to local .env for reference
echo "DB_PASSWORD=${DB_PASSWORD}" > .deploy_secrets
log "Secrets saved to .deploy_secrets (gitignore this file!)"

# ==========================================
# 1. S3 Bucket
# ==========================================
log "Step 1: Setting up S3 bucket (${S3_BUCKET_NAME})..."
if aws s3api head-bucket --bucket "$S3_BUCKET_NAME" 2>/dev/null; then
    log "Bucket exists."
else
    aws s3api create-bucket --bucket "$S3_BUCKET_NAME" --create-bucket-configuration LocationConstraint="$REGION"
    log "Bucket created."
fi

# ==========================================
# 2. IAM Role for App Runner
# ==========================================
log "Step 2: Setting up IAM Role (${IAM_ROLE_NAME})..."

TRUST_POLICY=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "build.apprunner.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    },
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "tasks.apprunner.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF
)

if aws iam get-role --role-name "$IAM_ROLE_NAME" 2>/dev/null; then
    log "Role exists."
else
    aws iam create-role --role-name "$IAM_ROLE_NAME" --assume-role-policy-document "$TRUST_POLICY"
    log "Role created."
fi

# Attach S3 Policy
ACCESS_POLICY=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "S3Access",
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:ListBucket"],
      "Resource": [
        "arn:aws:s3:::${S3_BUCKET_NAME}",
        "arn:aws:s3:::${S3_BUCKET_NAME}/*"
      ]
    }
  ]
}
EOF
)
aws iam put-role-policy --role-name "$IAM_ROLE_NAME" --policy-name S3AccessPolicy --policy-document "$ACCESS_POLICY"
log "IAM Policy attached."

# Attach App Runner ECR Access Policy (Required for Automatic Deployment from ECR)
aws iam attach-role-policy --role-name "$IAM_ROLE_NAME" --policy-arn "arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess"
log "Attached AWSAppRunnerServicePolicyForECRAccess to role."

ROLE_ARN=$(aws iam get-role --role-name "$IAM_ROLE_NAME" --query 'Role.Arn' --output text)

# ==========================================
# 3. RDS (PostgreSQL)
# ==========================================
log "Step 3: Setting up RDS (${DB_INSTANCE_IDENTIFIER})..."
log "NOTE: This step takes a few minutes if creating a new DB."

DB_EXISTS=$(aws rds describe-db-instances --db-instance-identifier "$DB_INSTANCE_IDENTIFIER" 2>/dev/null || true)

if [ -z "$DB_EXISTS" ]; then
    aws rds create-db-instance \
        --db-instance-identifier "$DB_INSTANCE_IDENTIFIER" \
        --db-instance-class db.t4g.micro \
        --engine postgres \
        --master-username "$DB_USERNAME" \
        --master-user-password "$DB_PASSWORD" \
        --allocated-storage 20 \
        --db-name "$DB_NAME" \
        --backup-retention-period 0 \
        --no-publicly-accessible \
        --region "$REGION"
    
    log "Waiting for DB instance to be available (this may take 5-10 mins)..."
    aws rds wait db-instance-available --db-instance-identifier "$DB_INSTANCE_IDENTIFIER"
    log "DB created and available."
else
    log "DB instance already exists. Skipping creation."
fi

# Get DB Endpoint
DB_ENDPOINT=$(aws rds describe-db-instances --db-instance-identifier "$DB_INSTANCE_IDENTIFIER" --query "DBInstances[0].Endpoint.Address" --output text)
VPC_ID=$(aws rds describe-db-instances --db-instance-identifier "$DB_INSTANCE_IDENTIFIER" --query "DBInstances[0].DBSubnetGroup.VpcId" --output text)
DB_SG_ID=$(aws rds describe-db-instances --db-instance-identifier "$DB_INSTANCE_IDENTIFIER" --query "DBInstances[0].VpcSecurityGroups[0].VpcSecurityGroupId" --output text)

log "DB Endpoint: $DB_ENDPOINT"
log "VPC ID: $VPC_ID"

# ==========================================
# 4. ECR & Docker Build
# ==========================================
log "Step 4: ECR & Docker Build..."
ECR_URI="$AWS_ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$REPO_NAME"

aws ecr describe-repositories --repository-names "$REPO_NAME" 2>/dev/null || \
    aws ecr create-repository --repository-name "$REPO_NAME"

aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$AWS_ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com"

log "Building Docker image..."
docker build --platform linux/amd64 -f backend/Dockerfile -t "$REPO_NAME" backend
docker tag "$REPO_NAME:latest" "$ECR_URI:latest"
docker push "$ECR_URI:latest"
log "Docker image pushed to $ECR_URI"

# ==========================================
# 5. App Runner VPC Connector & Security Group
# ==========================================
log "Step 5: Setting up App Runner Networking..."

# Create Security Group for App Runner
APPRUNNER_SG_NAME="apprunner-sg"
# Try to get existing SG ID
APPRUNNER_SG_ID=$(aws ec2 describe-security-groups --filters Name=group-name,Values="$APPRUNNER_SG_NAME" Name=vpc-id,Values="$VPC_ID" --query "SecurityGroups[0].GroupId" --output text 2>/dev/null || echo "None")

if [ "$APPRUNNER_SG_ID" = "None" ] || [ "$APPRUNNER_SG_ID" = "null" ]; then
    log "Creating Security Group..."
    APPRUNNER_SG_ID=$(aws ec2 create-security-group --group-name "$APPRUNNER_SG_NAME" --description "Security group for App Runner" --vpc-id "$VPC_ID" --query GroupId --output text)
    log "Created Security Group: $APPRUNNER_SG_ID"
else
    log "Using existing Security Group: $APPRUNNER_SG_ID"
fi

# Allow RDS to accept traffic from App Runner SG
log "Authorizing RDS ingress from App Runner..."
aws ec2 authorize-security-group-ingress \
    --group-id "$DB_SG_ID" \
    --protocol tcp \
    --port 5432 \
    --source-group "$APPRUNNER_SG_ID" 2>/dev/null || log "Ingress rule likely already exists."

# Create VPC Connector
CONNECTOR_NAME="apprunner-rds-connector"
# Get Private Subnets (assuming default VPC structure or standard AWS setup)
SUBNETS=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" "Name=map-public-ip-on-launch,Values=false" --query "Subnets[].SubnetId" --output text)
# If no private subnets, try all subnets (though public subnets for connector is fine)
if [ -z "$SUBNETS" ]; then
    SUBNETS=$(aws ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" --query "Subnets[].SubnetId" --output text)
fi
SUBNET_LIST=$(echo $SUBNETS | tr '\t' ' ' | tr ' ' ',')

log "Creating VPC Connector in subnets: $SUBNET_LIST"

# Helper function to get connector ARN from error message if creation fails
get_connector_arn_from_error() {
    local error_msg="$1"
    # Extract ARN using regex/grep from the error message
    echo "$error_msg" | grep -o 'arn:aws:apprunner:[^ ]*' | head -n 1 | sed 's/,$//'
}

log "Creating VPC Connector in subnets: $SUBNET_LIST"

# Try to create and capture output
if CREATE_OUTPUT=$(aws apprunner create-vpc-connector \
    --vpc-connector-name "$CONNECTOR_NAME" \
    --subnets $SUBNETS \
    --security-groups "$APPRUNNER_SG_ID" 2>&1); then
    # Success
    CONNECTOR_ARN=$(echo "$CREATE_OUTPUT" | jq -r '.VpcConnector.VpcConnectorArn')
    log "Created VPC Connector: $CONNECTOR_ARN"
else
    # Failure
    if echo "$CREATE_OUTPUT" | grep -q "already exists"; then
        # Already exists, extract ARN from error
        CONNECTOR_ARN=$(get_connector_arn_from_error "$CREATE_OUTPUT")
        log "Using existing VPC Connector (from error): $CONNECTOR_ARN"
    else
        # Real error
        echo "$CREATE_OUTPUT"
        exit 1
    fi
fi

# ==========================================
# 6. App Runner Service
# ==========================================
log "Step 6: Creating App Runner Service..."

DATABASE_URL="postgresql+psycopg://$DB_USERNAME:$DB_PASSWORD@$DB_ENDPOINT:5432/$DB_NAME?sslmode=require"
SECRET_KEY=$(openssl rand -hex 32)

# Check if service exists
SERVICE_ARN=$(aws apprunner list-services --query "ServiceSummaryList[?ServiceName=='$SERVICE_NAME'].ServiceArn" --output text)

if [ -n "$SERVICE_ARN" ]; then
    log "Service $SERVICE_NAME already exists. Updating..."
    # Logic to update could go here, but for simplicity we assume mostly new deployment or just image update
    # Trigger deployment implies image update
    # aws apprunner start-deployment --service-arn "$SERVICE_ARN"
    log "Service exists. To update configuration, use AWS Console or CLI update-service."
else
    aws apprunner create-service \
        --service-name "$SERVICE_NAME" \
        --source-configuration "{
            \"ImageRepository\": {
                \"ImageIdentifier\": \"$ECR_URI:latest\",
                \"ImageConfiguration\": {
                    \"Port\": \"8000\",
                    \"RuntimeEnvironmentVariables\": {
                        \"DATABASE_URL\": \"$DATABASE_URL\",
                        \"SECRET_KEY\": \"$SECRET_KEY\",
                        \"APP_ENV\": \"prod\",
                        \"STORAGE_BACKEND\": \"s3\",
                        \"S3_BUCKET\": \"$S3_BUCKET_NAME\",
                        \"CORS_ALLOW_ORIGINS\": \"https://app.example.com,http://localhost:3000\"
                    }
                },
                \"ImageRepositoryType\": \"ECR\"
            },
            \"AutoDeploymentsEnabled\": true,
            \"AuthenticationConfiguration\": {
                \"AccessRoleArn\": \"$ROLE_ARN\"
            }
        }" \
        --instance-configuration "{
            \"InstanceRoleArn\": \"$ROLE_ARN\"
        }" \
        --network-configuration "{
            \"EgressConfiguration\": {
                \"EgressType\": \"VPC\",
                \"VpcConnectorArn\": \"$CONNECTOR_ARN\"
            }
        }"
    log "Service creation initiated."
fi

log "Done! Monitor App Runner in the AWS Console for completion."
log "Frontend Environment Variable: NEXT_PUBLIC_API_BASE_URL (Get this from App Runner console)"
