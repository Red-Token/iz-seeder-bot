#!/bin/bash

if [ "$EUID" -ne 0 ]; then
    echo "Error. You must use sudo"
    exit 1
fi

docker compose -f docker-compose-restart.yaml down
docker compose -f docker-compose-restart.yaml up -d --force-recreate
