#FROM ubuntu:24.04
FROM ubuntu:24.04
LABEL maintainer="rene.malmgren@redtoke.ae"

# Install dependencies for your package (e.g., 'curl' or 'apt-transport-https')
RUN apt-get update && apt-get install -y curl apt-utils


# Copy the local package (e.g., .deb file) into the container
# Assuming your .deb file is in the same directory as the Dockerfile

RUN apt-get install -y systemd

RUN apt-get update && apt-get install -y adduser liblmdb0 libsecp256k1-1

RUN apt-get update && apt-get install -y \
    systemd \
    sudo \
    lsb-release \
    dbus \
    && apt-get clean

ENV DEBIAN_FRONTEND=noninteractive

COPY ./strfry_0.9.6-1_amd64.deb /tmp/strfry_0.9.6-1_amd64.deb

# TODO: THIS IS HORRIFIC WAY TO DO IT BUT THERE IS A BUG IN UBUNTU 24.04 2025-04-01 --RM
# COPY ./systemctl /usr/bin/systemctl

# Install the package using dpkg
# TODO: EVEN MORE HORRIFIC STUFF ignore exit commant
RUN dpkg -i /tmp/strfry_0.9.6-1_amd64.deb || true

# RUN apt-get install -f -y

#
## Clean up
#RUN rm /tmp/strfry_0.9.6-1_amd64.deb

# Set the entry point or default command for the container
# CMD ["bash"]
CMD ["/lib/systemd/systemd"]
