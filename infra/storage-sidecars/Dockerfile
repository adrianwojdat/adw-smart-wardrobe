FROM supabase/storage-api:v1.89.12@sha256:8526956cb462e9f7d392e9848ec77133b2769982ed614e9753cc687e8e4339a6
COPY file-sidecars.cjs /app/dist/storage/backend/file-sidecars.cjs
COPY patch.cjs /opt/storage-sidecars/patch.cjs
RUN node /opt/storage-sidecars/patch.cjs
