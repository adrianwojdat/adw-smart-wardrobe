> This document preserves the historical audit and implementation process. `docs/progress.md` describes current deployment/test results; do not treat initial gaps as the current state.

# Image pipeline audit and plan

Audit: the BFF converted uploads to WebP and removed EXIF, losing originals. The worker only read metadata. There was no segmentation model, catalog photography, AI analysis, or OCR. Initial manual rotation work replaced the image reference; this is being replaced with non-destructive variant regeneration.

Plan: preserve new uploads unchanged, add variants/job revisions, run U²-NetP on ONNX Runtime CPU in the worker, and use Sharp for masking, rotation, cropping, and composition. A separate AI queue uses Ollama for garment/label analysis and saves reviewable suggestions. Frontend polls status and switches variants. Testing uses a real existing Storage image without changing or deleting it.

Model: U²-NetP (Apache-2.0, rembg export) is a small salient-object model, not garment-specific. Its 320×320 input and approximately 4.4 MiB weights suit CPU execution and one Node ONNX instance. Thin straps, lace, and low contrast can yield weaker masks; evaluate quality on a real photo. No N100/N150 benchmark is claimed without hardware testing. SHA-256-pinned weights are baked into the image rather than downloaded for every job.

Ollama runs only on a separate PC with GTX 1060 6 GB. OLLAMA_BASE_URL points to its LAN address; OLLAMA_VISION_MODEL selects a model installed there. The application neither installs Ollama nor downloads vision LLM weights. AI downtime defers analysis without blocking CPU processing. Uncertain orientation is preserved with manual correction; without AI, garment proportions are not used to guess which edge is the top.

## Running and limitations

`docker compose up -d --build` still starts the whole stack; there is no Ollama container. The segmentation model (4,574,861 bytes, SHA-256 `309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8`) is in `infra/models` with license/source documentation. ONNX Runtime is CPU-only, using two threads and one concurrent image job; extra CUDA binaries are not installed. Worker memory is capped at 1536 MiB; full Supabase needs additional RAM.

Remote PC configuration (example values, not automatic model selection):

```dotenv
OLLAMA_BASE_URL=http://192.168.1.80:11434
OLLAMA_VISION_MODEL=nazwa-juz-zainstalowanego-modelu-vision
```

Worker calls `/api/chat`, never `/api/pull`. Local segmentation is not a vision LLM. Empty settings, a missing model, or an unavailable PC leave analysis jobs in PostgreSQL/BullMQ, retrying every 60 seconds. `wardrobe` and `wardrobe-ai` are separate queues. Validated garment/label suggestions are saved with the image; the user selects fields and approves applying them. Material and size are not accepted from garment-photo analysis. Label OCR uses the remote vision model; disabled Ollama does not produce pretend local OCR.

The mask is calculated from pixels. Sharp preserves texture/color, applies transparency, crops with a margin, composites onto `#f5f4f0` at 1200×1500, and creates a 320×400 thumbnail. There is no generative crease removal or aggressive exposure alteration; dark garments remain dark. The model does not geometrically straighten sleeves or reconstruct missing regions.

EXIF is normalized. Only the remote vision model can suggest orientation: automatic rotation requires confidence ≥0.85; otherwise orientation is preserved. Without the PC, manual 90° or two-step 180° rotation is available; generation always starts from the unchanged original. This safeguard cannot guarantee the model’s subjective confidence is correct; users can correct results.

Variants use deterministic `image_id/vREVISION-PIPELINE_VERSION/…` paths. Retrying a job overwrites only that revision’s variants, never originals. Deliberate reprocessing creates a new revision; older revisions are retained, with no automatic garbage collector. New originals retain initial EXIF, potentially including GPS, and are available only to wardrobe-authorized users; variants strip EXIF.

Real-model test: `GARMENT_FIXTURE=/path/to/garment.webp pnpm exec tsx tests/pipeline-real.ts` on Linux with dependencies installed. ONNX Runtime 1.31.1 has no macOS x64 binaries; run it in a container. Private test images/results are not committed.
