#!/bin/sh
set -eu
/opt/email/busybox httpd -f -p 127.0.0.1:8089 -h /email-templates &
exec auth "$@"
