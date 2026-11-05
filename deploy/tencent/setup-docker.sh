#!/usr/bin/env bash
# One-shot Docker installation for Tencent Cloud Lighthouse / CVM (Ubuntu 22.04+).
# Run as root:  sudo bash deploy/tencent/setup-docker.sh
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "run as root (sudo bash $0)" >&2
  exit 1
fi

echo "==> Installing Docker Engine from Tencent's mirror"
apt-get update -y
apt-get install -y --no-install-recommends ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://mirrors.cloud.tencent.com/docker-ce/linux/ubuntu/gpg \
  | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

. /etc/os-release
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://mirrors.cloud.tencent.com/docker-ce/linux/ubuntu ${VERSION_CODENAME} stable" \
  > /etc/apt/sources.list.d/docker.list

apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

echo "==> Using the in-region image accelerator (speeds up pulls a lot)"
mkdir -p /etc/docker
cat > /etc/docker/daemon.json <<'JSON'
{
  "registry-mirrors": ["https://mirror.ccs.tencentyun.com"]
}
JSON
systemctl enable docker
systemctl restart docker

echo "==> Done:"
docker --version
docker compose version
