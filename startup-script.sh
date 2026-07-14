#!/bin/bash
# ─── Google Compute Engine Startup Script ───
# Running on Container-Optimized OS (COS)
set -e

echo "=== Starting Smart Road GIS Deployment Service ==="

# ─── 1. Format and Mount Persistent SSD Disk ───
DISK_ID="google-smart-road-disk"
MNT_DIR="/mnt/disks/smart-road-data"
DEVICE_PATH="/dev/disk/by-id/${DISK_ID}"

echo "➜ Looking for persistent disk at: ${DEVICE_PATH}"
if [ -e "${DEVICE_PATH}" ]; then
  mkdir -p "${MNT_DIR}"
  
  # Format using ext4 if no filesystem is detected (checks blkid signature)
  if ! blkid "${DEVICE_PATH}" >/dev/null 2>&1; then
    echo "➜ Initialising persistent disk ${DEVICE_PATH} with ext4..."
    mkfs.ext4 -F -E lazy_itable_init=0,lazy_journal_init=0,discard "${DEVICE_PATH}"
  else
    echo "✓ Persistent disk filesystem already present — skipping formatting."
  fi
  
  # Mount persistent disk
  echo "➜ Mounting persistent disk..."
  mount -o discard,defaults "${DEVICE_PATH}" "${MNT_DIR}"
  chmod a+w "${MNT_DIR}"
  echo "✓ Disk successfully mounted at ${MNT_DIR}"
else
  echo "⚠ Warning: Persistent disk ${DEVICE_PATH} not found. Using local ephemeral directory!"
  MNT_DIR="/var/data"
  mkdir -p "${MNT_DIR}"
fi

# Ensure subdirectories for database and file uploads exist on persistent store
mkdir -p "${MNT_DIR}/uploads"

# ─── 2. Authenticate Docker with Google Artifact Registry ───
echo "➜ Configuring docker credentials..."
docker-credential-gcr configure-docker --registries=us-central1-docker.pkg.dev

# ─── 3. Pull Docker Image ───
IMAGE_URL="us-central1-docker.pkg.dev/smart-road-gis/smart-road-gis-repo/app:latest"
echo "➜ Pulling latest docker container: ${IMAGE_URL}"
docker pull "${IMAGE_URL}"

# ─── 4. Gracefully Stop Existing Application Container ───
echo "➜ Cleaning old container containers..."
docker stop smart-road-gis || true
docker rm smart-road-gis || true

# ─── 5. Run Application Container ───
# Maps VM port 80 to container port 8080 (serves app on standard web address HTTP)
# Mounts persistent disk directory to '/var/data' where SQLite database keeps states
echo "➜ Launching application container..."
docker run -d \
  --name smart-road-gis \
  --restart always \
  -p 80:8080 \
  -v "${MNT_DIR}:/var/data" \
  -e NODE_ENV=production \
  -e DB_PATH=/var/data/smartroad.db \
  -e UPLOAD_DIR=/var/data/uploads \
  -e SUPERADMIN_USERNAME=admin \
  -e SUPERADMIN_PASSWORD=AdminPassword@2026 \
  -e SUPERADMIN_EMAIL=admin@smartroad.gov \
  -e SUPERADMIN_FULLNAME="Super Administrator" \
  "${IMAGE_URL}"

echo "=== Container Boot Completed successfully! ==="
