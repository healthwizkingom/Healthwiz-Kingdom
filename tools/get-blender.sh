#!/bin/sh
# Installs Blender 4.2 LTS (the version the art scripts were made with) for headless use, e.g. in a fresh cloud container:
#   sh tools/get-blender.sh            then: blender -b --factory-startup -P tools/blender_avatar.py -- ...
# Downloads about 330 MB from download.blender.org into /opt/blender (needs write access there) and links /usr/local/bin/blender.
# Headless rendering also needs the EGL and X libraries below (Debian/Ubuntu names).
set -e
V=4.2.3
mkdir -p /opt/blender
if [ ! -x /opt/blender/blender-$V-linux-x64/blender ]; then
  curl -sSfL "https://download.blender.org/release/Blender4.2/blender-$V-linux-x64.tar.xz" | tar -xJ -C /opt/blender
fi
ln -sf /opt/blender/blender-$V-linux-x64/blender /usr/local/bin/blender
if command -v apt-get >/dev/null 2>&1; then
  apt-get update -q && apt-get install -y -q libegl1 libgl1 libxkbcommon0 libsm6 libxi6 libxrender1 libxxf86vm1 libxfixes3 || echo "Could not install the EGL/X libraries; Cycles bakes still work."
fi
blender --version | head -1
