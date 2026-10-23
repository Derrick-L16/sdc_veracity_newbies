# Count from photo

Staff can suggest a counted quantity from a photo instead of typing it.
The AI only suggests; staff confirm the number, and the normal count rules,
movement checks and manager approval apply unchanged.

## How staff use it

1. **Count** → choose the product (for example *Snack Biscuits B*).
2. **Count from photo** → take or choose one photo of the counting area.
3. Drag a box around **one** item. This tells the AI what to count.
4. **Count items**. Every detected item gets a green box:
   *"AI detected 39 items. Review and confirm the count."*
5. Tap a box to exclude a wrong detection; type a higher number for missed items.
6. Tick *"This photo covers the whole counting area"* → **Use this count**.
   The Counted quantity and a note (*"Counted from photo: AI detected 39."*) are filled in.
7. **Submit count** as usual.

Try it with `docs/test-data/photo-count/snack-biscuits-39.jpg` after importing
`docs/test-data/evidence-pack/csv-records/products.csv` (recorded 40 → difference −1).

Works best when items are the same product, seen from the same side, not heavily
stacked or hidden, in one clearly framed counting area.

## How it works

The app finds every area of the photo that looks like the example item
(normalised template matching at several sizes). No training data or model
download is needed.

| Where | What runs |
| --- | --- |
| Default: VS Code (`pnpm local`) and Replit | Built-in counter in the API server (`artifacts/api-server/src/lib/photo-count.ts`, Node + `sharp`). No setup, no key, no cost. |
| When RunPod is configured | The API sends the photo and product name to a RunPod Serverless **GPU** worker (`artifacts/api-server/detector/`). It runs **OWLv2**, a pretrained open-vocabulary detector, which finds every item matching the product name (so different flavours/colours count too). The staff example sets the expected size, shape and confidence. |

Measured on two test photos: the built-in counter got 39/39 snack packs but only
3 of 13 mixed-flavour cans; OWLv2 got 39/39 packs and 12 of 13 cans (one can
mostly hidden by a hand was missed, and one fridge-door shelf was counted).
Staff still review every result.

Route: `POST /api/vision/count` (Staff or Manager session, trusted origin).
Photos are downsized in the browser and are **not stored**; attach a photo as case
evidence separately if it should be kept.

## Optional: run counting on RunPod

You need a RunPod account (hackathon credits are applied to it). Serverless is
billed only while a request is being processed; with **Active workers = 0** an
idle endpoint costs nothing. Use a **GPU** endpoint: the image contains PyTorch
and the OWLv2 model (about 8 GB). The CPU/GPU choice is made when the endpoint is
created and cannot be changed later, so create a new endpoint to switch. A cold
GPU worker can take up to about a minute; warm requests take about a second.

### 1. Create the endpoint

RunPod console → **Serverless** → **New Endpoint**, then either:

- **GitHub repo** (no Docker needed on your PC): connect GitHub, choose this
  repository and branch, set **Dockerfile path** to
  `artifacts/api-server/detector/Dockerfile` and **build context** to
  `artifacts/api-server/detector`.
- **Docker image**: from `artifacts/api-server/detector/` run
  `docker build --platform linux/amd64 -t <dockerhub-user>/veracity-counter:latest .`,
  push it, and enter that image name.

Settings: **GPU** worker (16 GB or 24 GB tier; tick two or three GPU types for
availability), **Active workers 0**, Max workers 1, idle timeout ~5 s,
container disk **20 GB** or more.

### 2. Copy two values

- **Endpoint ID**: shown on the endpoint page (for example `abc123xyz`).
- **API key**: RunPod console → **Settings → API Keys → Create** (read/write).
  Treat it like a password: never commit it or paste it into chat or code.

### 3. Give them to the app

**Replit (production):** Tools → **Secrets** → add
`RUNPOD_API_KEY` and `RUNPOD_ENDPOINT_ID`, then redeploy / restart.

**VS Code (local):** in the terminal before starting the backend:

```powershell
$env:RUNPOD_API_KEY = "<your key>"
$env:RUNPOD_ENDPOINT_ID = "<your endpoint id>"
pnpm local
```

Remove both to go back to the built-in counter. If RunPod is misconfigured,
the dialog shows the reason (for example *"RunPod rejected the API key"*) and
staff can still type the count manually.

### Test the worker on your PC (optional)

```powershell
pip install -r artifacts/api-server/detector/requirements.txt
```

`count_objects.py` reads `{"image": "<base64>", "exemplar": {...}}` on stdin and
prints the result, the same as the RunPod handler returns.
