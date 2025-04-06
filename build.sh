#!/bin/bash
# Check if docker is installed
if [ "$EUID" -ne 0 ]; then
    echo "Error. You must use sudo"
    exit 1
fi

if ! command -v docker &>/dev/null; then
    echo "Error. Docker is not installed"

    read -p "Do you want to install Docker? (y/N): " answer
    answer=${answer:-n}
    case "$answer" in
    y | Y)
        echo "Continue run script..."
        bash <(curl -sSL https://get.docker.com)
        ;;
    N | N)
        echo "Exit."
        exit 0
        ;;
    *)
        echo "Incorrect input. Exit from the script."
        exit 1
        ;;
    esac

fi

# Check if jq is installed
if ! command -v jq &>/dev/null; then
    echo "Error. jq is not installed. Please install jq to proceed (e.g., sudo apt install jq)."
    exit 1
fi

# Check dist folder
if [ ! -d "dist" ] || [ -z "$(ls -A dist)" ]; then
    echo "The dist folder is empty"
    exit 1
fi

# Extract version from package.json
VERSION=$(jq -r .version package.json)
if [ -z "$VERSION" ]; then
    echo "Error. Could not extract version from package.json"
    exit 1
fi
PACKAGE_NAME=$(jq -r .name package.json)
if [ -z "$PACKAGE_NAME" ]; then
    echo "Error. Could not extract version from package.json"
    exit 1
fi

if [ "$1" == "prod" ]; then
    DOCKER_NAME=${DOCKERHUB_USERNAME}/$PACKAGE_NAME
else
    DOCKER_NAME=$PACKAGE_NAME
fi
# Set environment variables
export VERSION=$VERSION
export DOCKER_NAME=$DOCKER_NAME

echo "Docker name: ${DOCKER_NAME}"

echo "Starting build for version $VERSION..."

docker stop $PACKAGE_NAME

docker compose -f docker-compose-build.yaml down
docker system prune -a -f

docker compose -f docker-compose-build.yaml build --no-cache
docker compose -f docker-compose-build.yaml up -d --force-recreate
