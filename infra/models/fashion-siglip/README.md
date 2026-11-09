# FashionSigLIP CPU

Marqo/marqo-fashionSigLIP, Apache-2.0. Pinned revision c56244cc94f92419e8369fa71efdaf403b124ce8.
Official quantized vision encoder; no remote code, GPU or Ollama required.

Download before building on a fresh checkout:

    curl -fL https://huggingface.co/Marqo/marqo-fashionSigLIP/resolve/c56244cc94f92419e8369fa71efdaf403b124ce8/onnx/vision_model_quantized.onnx -o infra/models/fashion-siglip/vision.onnx

SHA-256: f1009cfce0eedd409f601e8351eedab72e8529641105eee6517821a9a634a2f4 (verified at runtime).
Weights are gitignored. prototypes.json contains generic, L2-normalized English text embeddings and Polish labels, no user data. Category embeddings use the fixed detailed descriptions from the CPU experiment v2; color/pattern use averaged generic prompts from v1. They come from the same pinned model's text encoder. No text encoder needed at runtime.

Input RGB, EXIF normalized, 224×224 squash bicubic, (pixel/255−0.5)/0.5, NCHW; output 768-dimensional image embedding, normalized before cosine comparison. CPU threads 2; queue concurrency 1. When no manual rotation exists, categories are pooled across four rotations; this does NOT determine physical orientation or rotate saved images. Manual rotation remains authoritative.

Scores are not calibrated confidence. Category, color and pattern require user review; no size, material or brand inference. Ollama remains an optional provider (`GARMENT_ANALYSIS_PROVIDER=ollama`) and label OCR provider. Default is fashion-siglip.
