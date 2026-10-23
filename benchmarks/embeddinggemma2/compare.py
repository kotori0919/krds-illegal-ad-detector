"""Frozen offline embedding ablation; outputs review candidates, never official findings."""
import argparse
import hashlib
import json
import os
import platform
import random
import resource
import statistics
import time
from pathlib import Path

os.environ.update(HF_HUB_OFFLINE='1', TRANSFORMERS_OFFLINE='1', HF_HUB_DISABLE_TELEMETRY='1',
                  TOKENIZERS_PARALLELISM='false', DO_NOT_TRACK='1')
import numpy as np
import torch
import transformers
import sentence_transformers
from PIL import Image
from sentence_transformers import SentenceTransformer


def digest(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as file:
        for chunk in iter(lambda: file.read(4 * 1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def metrics(rows, predictions):
    tp = sum(row['kind'] == 'positive' and passed for row, passed in zip(rows, predictions))
    fn = sum(row['kind'] == 'positive' and not passed for row, passed in zip(rows, predictions))
    fp = sum(row['kind'] == 'negative' and passed for row, passed in zip(rows, predictions))
    tn = sum(row['kind'] == 'negative' and not passed for row, passed in zip(rows, predictions))
    return {'tp': tp, 'fn': fn, 'fp': fp, 'tn': tn, 'recall': tp / (tp + fn),
            'precision': tp / (tp + fp) if tp + fp else None,
            'falsePositiveIds': [row['id'] for row, passed in zip(rows, predictions) if row['kind'] == 'negative' and passed],
            'detectedPositiveIds': [row['id'] for row, passed in zip(rows, predictions) if row['kind'] == 'positive' and passed]}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--model-path', required=True)
    parser.add_argument('--out', default='artifacts/embeddinggemma2-eval-20261021')
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[2]
    out = root / args.out
    protocol_path = root / 'benchmarks/embeddinggemma2/protocol.json'
    protocol = json.loads(protocol_path.read_text())
    frozen = json.loads((out / 'frozen-inputs.json').read_text())
    assert digest(protocol_path) == frozen['protocolSha256']
    assert digest(out / 'inputs.json') == frozen['inputManifestSha256']
    baseline = json.loads((out / 'baseline.json').read_text())
    rows = baseline['rows']
    assert len(rows) == frozen['count']
    for row in rows:
        assert digest(root / row['file']) == row['sha256']
    torch.set_num_threads(protocol['threads'])
    torch.set_num_interop_threads(1)
    torch.use_deterministic_algorithms(True)
    start = time.perf_counter()
    model = SentenceTransformer(args.model_path, device='cpu', local_files_only=True, trust_remote_code=False,
                               config_kwargs={'audio_config': None}, model_kwargs={'dtype': torch.float32})
    model.eval()
    load_seconds = time.perf_counter() - start
    assert all(parameter.dtype == torch.float32 for parameter in model.parameters() if parameter.is_floating_point())
    images = []
    for row in rows:
        with Image.open(root / row['file']) as source:
            rgba = source.convert('RGBA')
            white = Image.new('RGBA', rgba.size, 'white')
            white.alpha_composite(rgba)
            images.append(white.convert('RGB'))
    prefix = 'task: classification | query: '
    texts = [row['ocr']['text'] for row in rows]
    variants = {
        'text': ([prefix + text for text in texts], {}),
        'image': ([{'image': image} for image in images], {}),
        'image+ocr': ([{'text': prefix + text + '\n<|image|>', 'image': [image]} for image, text in zip(images, texts)], {}),
        'white+ocr': ([{'text': prefix + text + '\n<|image|>', 'image': [Image.new('RGB', image.size, 'white')]} for image, text in zip(images, texts)], {}),
    }
    prompts = protocol['positivePrompts'] + protocol['negativePrompts']
    npos = len(protocol['positivePrompts'])

    def encode(values, **kwargs):
        vectors = model.encode(values, batch_size=4, show_progress_bar=False, normalize_embeddings=True,
                               convert_to_numpy=True, **kwargs)
        assert vectors.shape == (len(values), protocol['embeddingDimension'])
        assert np.isfinite(vectors).all(), 'Nonfinite embedding'
        assert np.max(np.abs(np.linalg.norm(vectors, axis=1) - 1)) <= protocol['cosineTolerance']
        return vectors

    report = {'protocol': protocol, 'protocolSha256': digest(protocol_path), 'inputManifestSha256': frozen['inputManifestSha256'],
              'baselineSha256': digest(out / 'baseline.json'), 'modelLoadSeconds': load_seconds,
              'environment': {'python': platform.python_version(), 'platform': platform.platform(),
                              'torch': torch.__version__, 'transformers': transformers.__version__,
                              'sentenceTransformers': sentence_transformers.__version__, 'numpy': np.__version__,
                              'device': 'CPU', 'dtype': 'float32', 'threads': protocol['threads'],
                              'parameters': sum(parameter.numel() for parameter in model.parameters()),
                              'note': 'Frozen eval/inference, no training/backward. Seeds index paired deterministic repetitions, not training-seed uncertainty.'},
              'baseline': metrics(rows, [row['baselinePassed'] for row in rows]), 'runs': []}
    previous = {}
    with torch.inference_mode():
        for seed in protocol['seeds']:
            random.seed(seed); np.random.seed(seed); torch.manual_seed(seed)
            prompt_start = time.perf_counter()
            references = encode(prompts, prompt_name='Classification')
            run = {'seed': seed, 'promptSeconds': time.perf_counter() - prompt_start, 'variants': {}}
            for name, (values, kwargs) in variants.items():
                print(f'START seed={seed} variant={name} n={len(values)}', flush=True)
                variant_start = time.perf_counter()
                vectors = encode(values, **kwargs)
                seconds = time.perf_counter() - variant_start
                scores = vectors @ references.T
                pos = scores[:, :npos].max(axis=1)
                neg = scores[:, npos:].max(axis=1)
                margins = pos - neg
                assisted = [bool(row['baselinePassed'] or (row['evidence']['observedExternalDestination'] and margin >= protocol['margin']))
                            for row, margin in zip(rows, margins)]
                nearest = [bool(row['baselinePassed'] or (row['evidence']['observedExternalDestination'] and margin >= 0))
                           for row, margin in zip(rows, margins)]
                delta = float(np.max(np.abs(vectors - previous[name]))) if name in previous else None
                if delta is not None:
                    assert delta <= protocol['cosineTolerance'], 'Embedding drift across deterministic repetitions'
                previous.setdefault(name, vectors.copy())
                observations = [{**{key: row[key] for key in ['id', 'kind', 'group', 'baselinePassed']},
                                 'positiveCosine': float(positive), 'negativeCosine': float(negative), 'margin': float(margin),
                                 'assistedPassed': passed,
                                 'bestPositivePrompt': protocol['positivePrompts'][int(np.argmax(score[:npos]))],
                                 'bestNegativePrompt': protocol['negativePrompts'][int(np.argmax(score[npos:]))]}
                                for row, positive, negative, margin, passed, score in zip(rows, pos, neg, margins, assisted, scores)]
                run['variants'][name] = {'seconds': seconds, 'amortizedSecondsPerImage': seconds / len(rows),
                                         'embeddingMaxAbsDeltaVsFirstRun': delta,
                                         'assisted': metrics(rows, assisted), 'nearestAtZeroDiagnosticOnly': metrics(rows, nearest),
                                         'rows': observations}
                np.save(out / f'embeddings-{seed}-{name.replace("+", "-")}.npy', vectors)
                print(json.dumps({'seed': seed, 'variant': name, 'seconds': seconds, 'metrics': metrics(rows, assisted)}, ensure_ascii=False), flush=True)
                (out / 'partial.json').write_text(json.dumps({'completedRuns': report['runs'], 'currentRun': run}, ensure_ascii=False, indent=2) + '\n')
            report['runs'].append(run)
    summary = {}
    for name in variants:
        runs = [run['variants'][name] for run in report['runs']]
        timings = [run['seconds'] for run in runs]
        summary[name] = {'medianSeconds': statistics.median(timings), 'minSeconds': min(timings), 'maxSeconds': max(timings),
                         'metricsEachRun': [run['assisted'] for run in runs],
                         'maxEmbeddingAbsDelta': max(run['embeddingMaxAbsDeltaVsFirstRun'] or 0 for run in runs)}
    report['summary'] = summary
    report['peakOwnRssMiB'] = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024
    first = report['runs'][0]['variants']
    report['imageParticipation'] = {'maxAbsDeltaRealVsWhiteWithSameOcr': float(np.max(np.abs(previous['image+ocr'] - previous['white+ocr']))),
                                   'changedDecisionsAtPrimaryMargin': [row['id'] for row, a, b in zip(rows, first['image+ocr']['rows'], first['white+ocr']['rows']) if a['assistedPassed'] != b['assistedPassed']]}
    main_metrics = first['image+ocr']['assisted']
    report['primaryUsefulImprovement'] = main_metrics['tp'] > report['baseline']['tp'] and main_metrics['fp'] <= report['baseline']['fp']
    report['role'] = 'EXPERIMENTAL_REVIEW_CANDIDATES_NOT_OFFICIAL_OR_LEGAL_FINDINGS'
    (out / 'observed.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'baseline': report['baseline'], 'primary': main_metrics, 'usefulImprovement': report['primaryUsefulImprovement'],
                      'peakOwnRssMiB': report['peakOwnRssMiB'], 'summary': summary}, ensure_ascii=False, indent=2), flush=True)


if __name__ == '__main__':
    main()
