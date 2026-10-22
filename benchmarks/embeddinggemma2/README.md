# Offline banner embedding comparison

This experiment consumes the canonical scanner's candidate pixels, actual OCR
and observed external-link evidence. It never writes official findings, changes
production thresholds or uploads pixels/OCR to a hosted model. Windows remains
outside this experiment. Output labels mean review candidates, not legal proof.

`protocol.json` pins the model revision, prompts, CPU float32, two threads,
three deterministic repetitions, tolerance and primary cosine margin before
inference. The primary rule ORs the unchanged baseline with image+OCR embedding
margin >= 0.05 and an observed external destination. Text-only, image-only and
white-image replacement are ablations. Margin-zero output is diagnostic, not a
second tuned operating point. Do not tune prompts/thresholds on these 25 inputs
and present the result as holdout performance.

The eight original positives are archived 206x62 screen crops. The five original
controls, six official Samsung/LG promotional images (scaled with white matte
and aspect-preserving padding to 206x62), and six designed hard negatives are
reported separately. This is a selected regression corpus, not a population
false-positive estimate. Original retailer bytes and source HTML are retained.
Model inputs contain only pixels and actual OCR: no filenames, gold labels,
brands inferred from the filenames, destination domains or human transcripts.

Task artifacts: `artifacts/embeddinggemma2-eval-20261021/`. `inputs.json` and
`frozen-inputs.json` identify data and the pre-inference protocol hash. The
preparation scripts and downloaded media live there to preserve provenance;
`SHA256SUMS` and `source-manifest.json` identify this run. The original positives
also live in `fixtures/real-banners/` with their existing manifest. Frozen data
are needed to reproduce the exact run; silently re-downloading current retail
assets does not reproduce historic bytes.

Use a separate Python 3.12 environment. Install CPU torch/torchvision from the
PyTorch CPU index, then the remaining pinned requirements from PyPI. The run's
complete installed versions are in `installed-requirements.txt`. Transformers
requires torchvision to construct the video-capable processor even when only
images are supplied. No production npm dependency is added for this experiment.

Download `google/embeddinggemma-2` at revision
`914f7f89142e33e77833254d9c9b90c3cef7303b` with
`huggingface_hub.snapshot_download(..., revision=..., token=False)`. Inspect the
pinned repository and compare file SHA-256/size with `model-manifest.json`.
Do not enable `trust_remote_code`. The run uses a volatile, task-owned
`/dev/shm/illegal-ad-embeddinggemma2-20261021` cache because disk space is limited.
The explicit `--model-path` argument prevents a hidden dependency on that cache;
a fresh pinned snapshot can be supplied after it is removed or the host reboots.
The task-created Python environment and volatile snapshot were removed after
successful measurement/validation to restore disk and RAM space. Recreate both
from the pinned requirements/model manifest to run again; raw inputs and actual
embeddings/results remain in the evidence directory.

From the repository root, after building scanner packages:

```sh
KRDS_TEST_UNSANDBOXED=1 node benchmarks/embeddinggemma2/baseline.mjs
node benchmarks/embeddinggemma2/diagnose.mjs
<venv>/bin/python benchmarks/embeddinggemma2/compare.py --model-path <pinned-snapshot>
node benchmarks/embeddinggemma2/validate.mjs
node benchmarks/embeddinggemma2/compose-public-guard.mjs
```

The sandbox exception is exclusively for this owned loopback fixture on the
current Linux host. Never use it to browse public pages. Actual model inference
sets Hub/Transformers offline modes and uses local files only. Baseline official,
extra and detail JSON pass all three contract validators. `miss-analysis.json`
keeps measured OCR separate from manual readings of the screen pixels.

Compare `observed.json`, saved per-run embeddings and the unchanged baseline.
Seeds index repeated frozen inference; there is no training, backward pass or
training-seed uncertainty. Timings are batch-of-four inference wall times and
amortized averages, not per-image p95 or end-to-end production scan latency.
Peak RSS is this Python process only, not the complete app/process tree. Cold
network download and interpreter installation are separate from model loading.

`compose-public-guard.mjs` is a separately reported, posthoc composition with
the existing canonical `PUBLIC_INFORMATION` exclusion. It was added after the
margin-zero sports-news false positive was observed. It changes no prompts,
weights, OCR or thresholds, but its result is not the preregistered primary
result or independent holdout validation. The original false positive remains
visible in `observed.json`; the add-on writes `public-guard-composition.json`.
