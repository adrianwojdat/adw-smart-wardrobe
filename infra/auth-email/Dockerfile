FROM busybox:1.37.0-musl AS fileserver
FROM supabase/gotrue:v2.197.0
COPY --from=fileserver /bin/busybox /opt/email/busybox
COPY entrypoint.sh /opt/email/entrypoint.sh
ENTRYPOINT ["/bin/sh","/opt/email/entrypoint.sh"]
CMD []
