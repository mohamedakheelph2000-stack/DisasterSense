import os
import sys
import tarfile
import subprocess
from pathlib import Path

PROJECT_ROOT = Path("D:/DisasterSense")
BUNDLE_FILE = PROJECT_ROOT / "disastersense_bundle.tar.gz"
KEY_FILE = PROJECT_ROOT / "infra/aws/disastersense-keypair.pem"
EC2_HOST = "3.85.236.138"

def should_exclude(tarinfo):
    name = tarinfo.name
    excluded = [
        "node_modules",
        ".venv",
        ".next",
        "__pycache__",
        ".git",
        ".pytest_cache",
        "disastersense_bundle.tar.gz"
    ]
    for ex in excluded:
        if f"/{ex}/" in f"/{name}/" or name.endswith(ex):
            return None
    return tarinfo

def create_bundle():
    print(f"Creating project bundle: {BUNDLE_FILE}...")
    if BUNDLE_FILE.exists():
        BUNDLE_FILE.unlink()

    with tarfile.open(BUNDLE_FILE, "w:gz") as tar:
        for folder in ["backend", "frontend", "ml", "infra"]:
            p = PROJECT_ROOT / folder
            if p.exists():
                tar.add(p, arcname=folder, filter=should_exclude)
        for f in ["docker-compose.yml", "pytest.ini"]:
            p = PROJECT_ROOT / f
            if p.exists():
                tar.add(p, arcname=f)

    size_mb = BUNDLE_FILE.stat().st_size / (1024 * 1024)
    print(f"Bundle created: {size_mb:.2f} MB")

def upload_and_extract():
    print(f"Uploading {BUNDLE_FILE} to {EC2_HOST}...")
    scp_cmd = [
        "scp",
        "-i", str(KEY_FILE),
        "-o", "StrictHostKeyChecking=no",
        str(BUNDLE_FILE),
        f"ubuntu@{EC2_HOST}:/home/ubuntu/disastersense_bundle.tar.gz"
    ]
    subprocess.run(scp_cmd, check=True)
    print("Upload completed.")

    print("Extracting bundle on EC2...")
    extract_cmd = (
        "mkdir -p /home/ubuntu/DisasterSense && "
        "tar -xzf /home/ubuntu/disastersense_bundle.tar.gz -C /home/ubuntu/DisasterSense && "
        "rm /home/ubuntu/disastersense_bundle.tar.gz"
    )
    ssh_cmd = [
        "ssh",
        "-i", str(KEY_FILE),
        "-o", "StrictHostKeyChecking=no",
        f"ubuntu@{EC2_HOST}",
        extract_cmd
    ]
    subprocess.run(ssh_cmd, check=True)
    print("Bundle extracted successfully in /home/ubuntu/DisasterSense on EC2.")

if __name__ == "__main__":
    create_bundle()
    upload_and_extract()
