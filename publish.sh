#!/bin/bash

if [ "$EUID" -ne 0 ]; then
    echo "Error. You must use sudo"
    exit 1
fi

# Set your Docker Hub username
DOCKERHUB_USERNAME='ivnjey' . ./build.sh prod

docker tag ${DOCKER_NAME}:${VERSION} $DOCKER_NAME:latest

docker push ${DOCKER_NAME}:${VERSION}
docker push ${DOCKER_NAME}:latest
