#!/usr/bin/env python3
"""
DisasterSense AWS Automated Deployment Tool.

Provisions AWS EC2 infrastructure, security groups, and initializes
the DisasterSense Docker stack (FastAPI Backend + 24/7 Telemetry + Next.js + PostgreSQL + Nginx).
"""

import os
import sys
import time
import argparse
from pathlib import Path

try:
    import boto3
    from botocore.exceptions import ClientError, NoCredentialsError, PartialCredentialsError
except ImportError:
    print("Error: boto3 is required. Install it using: pip install boto3")
    sys.exit(1)


def check_aws_credentials(session: boto3.Session):
    """Checks whether the current AWS session has valid credentials."""
    try:
        sts = session.client("sts")
        identity = sts.get_caller_identity()
        print("\n" + "="*60)
        print("  AWS AUTHENTICATION SUCCESSFUL")
        print("="*60)
        print(f"  Account ID: {identity.get('Account')}")
        print(f"  User ARN:   {identity.get('Arn')}")
        print(f"  Region:     {session.region_name or 'us-east-1'}")
        print("="*60 + "\n")
        return identity
    except Exception as e:
        print("\n" + "!"*60)
        print("  AWS AUTHENTICATION REQUIRED")
        print("!"*60)
        print(f"  Details: {e}\n")
        print("  To authenticate your AWS account, run ONE of the following:")
        print("    1) If using AWS Builder ID / IAM Identity Center:")
        print("       Run: aws login")
        print("    2) If using IAM User Access Keys:")
        print("       Run: aws configure")
        print("    3) Or export environment variables:")
        print("       $env:AWS_ACCESS_KEY_ID=\"your_key_id\"")
        print("       $env:AWS_SECRET_ACCESS_KEY=\"your_secret_key\"")
        print("       $env:AWS_DEFAULT_REGION=\"us-east-1\"")
        print("!"*60 + "\n")
        return None


def get_default_vpc(ec2_client):
    """Gets the default VPC ID."""
    vpcs = ec2_client.describe_vpcs(Filters=[{"Name": "isDefault", "Values": ["true"]}])["Vpcs"]
    if vpcs:
        return vpcs[0]["VpcId"]
    # Fallback to any VPC
    all_vpcs = ec2_client.describe_vpcs()["Vpcs"]
    if all_vpcs:
        return all_vpcs[0]["VpcId"]
    raise RuntimeError("No VPC found in this AWS region.")


def get_or_create_security_group(ec2_client, vpc_id: str, group_name: str = "disastersense-sg"):
    """Creates or retrieves the security group for DisasterSense."""
    try:
        groups = ec2_client.describe_security_groups(
            Filters=[
                {"Name": "group-name", "Values": [group_name]},
                {"Name": "vpc-id", "Values": [vpc_id]}
            ]
        )["SecurityGroups"]
        if groups:
            print(f"Using existing Security Group: {groups[0]['GroupId']} ({group_name})")
            return groups[0]["GroupId"]
    except ClientError:
        pass

    print(f"Creating new Security Group '{group_name}' in VPC {vpc_id}...")
    res = ec2_client.create_security_group(
        GroupName=group_name,
        Description="Security Group for DisasterSense (SSH, HTTP, HTTPS, API)",
        VpcId=vpc_id,
        TagSpecifications=[{
            "ResourceType": "security-group",
            "Tags": [{"Key": "Project", "Value": "DisasterSense"}]
        }]
    )
    sg_id = res["GroupId"]

    # Ingress rules: SSH (22), HTTP (80), HTTPS (443), Backend (8000)
    ingress_rules = [
        {"IpProtocol": "tcp", "FromPort": 22, "ToPort": 22, "IpRanges": [{"CidrIp": "0.0.0.0/0", "Description": "SSH Access"}]},
        {"IpProtocol": "tcp", "FromPort": 80, "ToPort": 80, "IpRanges": [{"CidrIp": "0.0.0.0/0", "Description": "HTTP Web"}]},
        {"IpProtocol": "tcp", "FromPort": 443, "ToPort": 443, "IpRanges": [{"CidrIp": "0.0.0.0/0", "Description": "HTTPS Web"}]},
        {"IpProtocol": "tcp", "FromPort": 8000, "ToPort": 8000, "IpRanges": [{"CidrIp": "0.0.0.0/0", "Description": "Backend Direct API"}]},
    ]
    ec2_client.authorize_security_group_ingress(GroupId=sg_id, IpPermissions=ingress_rules)
    print(f"Configured firewall rules on {sg_id} (Ports 22, 80, 443, 8000 allowed).")
    return sg_id


def get_or_create_key_pair(ec2_client, key_name: str = "disastersense-keypair", output_dir: Path = Path("infra/aws")):
    """Creates or verifies EC2 key pair and saves the .pem private key."""
    output_dir.mkdir(parents=True, exist_ok=True)
    key_file = output_dir / f"{key_name}.pem"

    try:
        keys = ec2_client.describe_key_pairs(KeyNames=[key_name])["KeyPairs"]
        if keys:
            print(f"Using existing AWS Key Pair: '{key_name}'")
            return key_name
    except ClientError:
        pass

    print(f"Generating new AWS EC2 Key Pair '{key_name}'...")
    res = ec2_client.create_key_pair(
        KeyName=key_name,
        KeyType="rsa",
        KeyFormat="pem",
        TagSpecifications=[{
            "ResourceType": "key-pair",
            "Tags": [{"Key": "Project", "Value": "DisasterSense"}]
        }]
    )
    with open(key_file, "w") as f:
        f.write(res["KeyMaterial"])
    print(f"Saved private key to {key_file} (Keep this secure for SSH access).")
    return key_name


def get_latest_ubuntu_ami(ec2_client):
    """Retrieves the latest official Ubuntu 22.04 LTS AMI ID."""
    # Canonical official owner ID: 099720109477
    images = ec2_client.describe_images(
        Owners=["099720109477"],
        Filters=[
            {"Name": "name", "Values": ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]},
            {"Name": "state", "Values": ["available"]}
        ]
    )["Images"]
    if not images:
        raise RuntimeError("No Ubuntu 22.04 LTS AMI found.")
    images.sort(key=lambda x: x["CreationDate"], reverse=True)
    latest = images[0]
    print(f"Using AMI: {latest['ImageId']} ({latest['Name']})")
    return latest["ImageId"]


def launch_instance(region: str = "us-east-1", instance_type: str = "t3.micro"):
    """Launches and configures the DisasterSense EC2 instance."""
    session = boto3.Session(region_name=region)
    identity = check_aws_credentials(session)
    if not identity:
        return

    ec2 = session.client("ec2")
    vpc_id = get_default_vpc(ec2)
    sg_id = get_or_create_security_group(ec2, vpc_id)
    key_name = get_or_create_key_pair(ec2)
    ami_id = get_latest_ubuntu_ami(ec2)

    user_data_path = Path("infra/aws/ec2_user_data.sh")
    user_data = ""
    if user_data_path.exists():
        user_data = user_data_path.read_text()

    print(f"\nLaunching {instance_type} EC2 instance for DisasterSense...")
    res = ec2.run_instances(
        ImageId=ami_id,
        InstanceType=instance_type,
        KeyName=key_name,
        SecurityGroupIds=[sg_id],
        MinCount=1,
        MaxCount=1,
        UserData=user_data,
        BlockDeviceMappings=[{
            "DeviceName": "/dev/sda1",
            "Ebs": {
                "VolumeSize": 30,  # 30 GB SSD for Docker images, models, & PostgreSQL
                "VolumeType": "gp3",
                "DeleteOnTermination": True
            }
        }],
        TagSpecifications=[{
            "ResourceType": "instance",
            "Tags": [
                {"Key": "Name", "Value": "DisasterSense-Production-Server"},
                {"Key": "Project", "Value": "DisasterSense"}
            ]
        }]
    )
    instance_id = res["Instances"][0]["InstanceId"]
    print(f"Instance created: {instance_id}. Waiting for it to reach 'running' state...")

    waiter = ec2.get_waiter("instance_running")
    waiter.wait(InstanceIds=[instance_id])

    desc = ec2.describe_instances(InstanceIds=[instance_id])["Reservations"][0]["Instances"][0]
    public_ip = desc.get("PublicIpAddress")
    public_dns = desc.get("PublicDnsName")

    print("\n" + "="*70)
    print("  DISASTERSENSE AWS INSTANCE DEPLOYED SUCCESSFULLY!")
    print("="*70)
    print(f"  Instance ID:    {instance_id}")
    print(f"  Public IP:      {public_ip}")
    print(f"  Public DNS:     {public_dns}")
    print(f"  Web Dashboard:  http://{public_ip}")
    print(f"  API Docs:       http://{public_ip}/docs")
    print(f"  SSH Command:    ssh -i infra/aws/{key_name}.pem ubuntu@{public_ip}")
    print("="*70 + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Deploy DisasterSense to AWS EC2")
    parser.add_argument("--region", default="us-east-1", help="AWS Region (default: us-east-1)")
    parser.add_argument("--instance-type", default="t3.micro", help="EC2 Instance Type (default: t3.micro - Free Tier)")
    args = parser.parse_args()
    launch_instance(region=args.region, instance_type=args.instance_type)
