#!/bin/bash
# ─── Google Cloud Platform (GCP) Deployment Script ───
# For Smart Road GIS Deployment to Google Compute Engine (COS VM)
# Run this inside Google Cloud Shell for the best (0-configuration) experience
exit_on_error() {
  echo "✗ Error occurred at line $1"
  exit 1
}
trap 'exit_on_error $LINENO' ERR

# Deployment config mapping to user's project
PROJECT_ID="smart-road-gis"
REGION="us-central1"
ZONE="us-central1-a"
REPO_NAME="smart-road-gis-repo"
IMAGE_NAME="app"
IMAGE_TAG="latest"
INSTANCE_NAME="smart-road-gis-vm"
DISK_NAME="smart-road-disk"
DISK_SIZE="10GB"

echo "=========================================================="
echo " 🌐 SMART ROAD GIS — DEPLOY TO GOOGLE CLOUD PLATFORM      "
echo "=========================================================="

# 1. Check and Set active GCP project
echo "➜ Step 1: Setting default GCP project database..."
gcloud config set project ${PROJECT_ID}

# 2. Enable necessary GCP APIs
echo "➜ Step 2: Activating Cloud Build, Artifact Registry, and Compute Engine APIs..."
gcloud services enable \
    cloudbuild.googleapis.com \
    artifactregistry.googleapis.com \
    compute.googleapis.com

# 3. Create Artifact Registry repository if it doesn't exist
echo "➜ Step 3: Verifying Docker registry..."
if ! gcloud artifacts repositories describe ${REPO_NAME} --location=${REGION} >/dev/null 2>&1; then
  echo "  ➜ Creating fresh Artifact Registry repository '${REPO_NAME}'..."
  gcloud artifacts repositories create ${REPO_NAME} \
      --repository-format=docker \
      --location=${REGION} \
      --description="Smart Road GIS Docker Repository"
else
  echo "  ✓ Artifact Registry repository '${REPO_NAME}' already present."
fi

# 4. Build application container using Cloud Build
IMAGE_URL="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${IMAGE_NAME}:${IMAGE_TAG}"
echo "➜ Step 4: Compiling application with Google Cloud Build..."
echo "  Target Registry: ${IMAGE_URL}"
# GCP Cloud Build uploads only required project files (following .dockerignore)
gcloud builds submit --tag ${IMAGE_URL} .

# 5. Build/Configure the persistent SSD instance storage
echo "➜ Step 5: Setting up persistent SSD Disk to store GIS datasets and SQLite..."
if ! gcloud compute disks describe ${DISK_NAME} --zone=${ZONE} >/dev/null 2>&1; then
  echo "  ➜ Provisioning persistent disk '${DISK_NAME}' with size ${DISK_SIZE}..."
  gcloud compute disks create ${DISK_NAME} \
      --size=${DISK_SIZE} \
      --type=pd-ssd \
      --zone=${ZONE}
else
  echo "  ✓ Persistent disk '${DISK_NAME}' exists. Preserving data integrity."
fi

# 6. Configure VM Host running Container-Optimized OS (COS)
echo "➜ Step 6: Provisioning VM with Container-Optimized OS..."
if gcloud compute instances describe ${INSTANCE_NAME} --zone=${ZONE} >/dev/null 2>&1; then
  echo "  ➜ Virtual machine exists. Uploading newest startup metadata script..."
  gcloud compute instances add-metadata ${INSTANCE_NAME} \
      --zone=${ZONE} \
      --metadata-from-file=startup-script=startup-script.sh
      
  echo "  ➜ Restarting virtual machine to execute new deployment container..."
  gcloud compute instances reset ${INSTANCE_NAME} --zone=${ZONE}
else
  echo "  ➜ Launching new micro GCE instance '${INSTANCE_NAME}'..."
  # e2-micro machine uses very little memory, ideal for Free Tier usage.
  # Mounts the external storage disk to be formatted and loaded by the startup script.
  gcloud compute instances create ${INSTANCE_NAME} \
      --zone=${ZONE} \
      --machine-type=e2-micro \
      --image-family=cos-stable \
      --image-project=cos-cloud \
      --boot-disk-size=10GB \
      --boot-disk-type=pd-standard \
      --disk=name=${DISK_NAME},device-name=${DISK_NAME},mode=rw,boot=no \
      --metadata-from-file=startup-script=startup-script.sh \
      --tags=http-server \
      --scopes=https://www.googleapis.com/auth/cloud-platform
fi

# 7. Configure firewall rule to expose port 80 (HTTP) to web traffic
echo "➜ Step 7: Configuring firewall rule for web traffic..."
if ! gcloud compute firewall-rules describe default-allow-http >/dev/null 2>&1; then
  echo "  ➜ Creating ingress rule 'default-allow-http' for port 80..."
  gcloud compute firewall-rules create default-allow-http \
      --direction=INGRESS \
      --priority=1000 \
      --network=default \
      --action=ALLOW \
      --rules=tcp:80 \
      --source-ranges=0.0.0.0/0 \
      --target-tags=http-server
else
  echo "  ✓ Firewall rule allowing inbound HTTP (port 80) exists."
fi

# 8. Success Output
echo "=========================================================="
echo " 🎉 SMART ROAD GIS SUCCESSFULLY DEPLOYED TO GOOGLE CLOUD! "
echo "=========================================================="
echo "  • Instance Name   : ${INSTANCE_NAME}"
echo "  • Hosting Region  : ${ZONE}"
echo "  • GCP Instance Size: e2-micro (GCP Free Tier)"
echo "  • Persistent Storage: Attached 10GB SSD Disk for SQLite database"
echo "  "
echo "➜ Checking server IP... Please wait..."
sleep 3
VM_IP=$(gcloud compute instances describe ${INSTANCE_NAME} --zone=${ZONE} --format='get(networkInterfaces[0].accessConfigs[0].natIP)')
echo "=========================================================="
echo "  ➜ Access the web app at: http://${VM_IP}"
echo "  ➜ Superadmin Username  : admin"
echo "  ➜ Superadmin Password  : AdminPassword@2026"
echo "=========================================================="
echo "  NOTE: It might take 1-2 minutes for the container to"
echo "        finish boot, mount the SSD, and load Node server."
echo "=========================================================="
