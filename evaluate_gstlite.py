"""
GSTLite rule-engine evaluation
------------------------------
1. Generates N synthetic invoices with KNOWN injected defects (ground truth).
2. Runs YOUR compliance engine on each one through audit_invoice() below.
3. Computes confusion matrix, precision, recall, specificity, FPR, F1,
   per-defect recall and latency.

Usage:
    python evaluate_gstlite.py --selftest          # checks the metric maths only
    python evaluate_gstlite.py -n 150 --seed 42    # real run (after wiring the adapter)

Outputs (in ./eval_output): invoices.json, ground_truth.csv, results.json

NOTE: This evaluates the RULE ENGINE on structured invoice data. OCR field
accuracy needs rendered PDFs/images with typed ground truth and is a separate test.
"""
import argparse, csv, json, os, random, statistics, string, time, sys

# Add gstlite-backend to system path to import real engine
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), "gstlite-backend"))

from app.services.compliance_engine import run_all_checks

# ----------------------------------------------------------------------------
# 1. ADAPTER  -- the ONLY part you must edit
# ----------------------------------------------------------------------------
DEFECTS = ["BLOCKED_ITC", "BAD_GSTIN", "POS_ERROR", "TAX_MATH", "DUPLICATE", "RULE37"]


class TaxpayerEntity:
    def __init__(self, state_code):
        self.gstin = f"{state_code}AAPCA1234F1Z5"
        self.name = "Apex Retail Hub"


def audit_invoice(inv: dict, history: list) -> dict:
    """
    Call your real engine here and return:
        {"flagged": bool, "defects": ["BLOCKED_ITC", ...]}   # subset of DEFECTS

    `inv` keys: invoice_no, date, vendor_gstin, buyer_state_code, description,
                taxable, cgst, sgst, igst, total, paid (bool), days_unpaid
    `history`: invoices already processed in this run (for duplicate checks).
    """
    buyer_state = inv.get("buyer_state_code", "27")
    biz = TaxpayerEntity(buyer_state)
    
    # Call the real compliance engine with history
    res = run_all_checks(parsed_data=inv, history=history, business=biz)
    findings = res.get("findings", [])
    
    defects = []
    for f in findings:
        title = getattr(f, "title", "")
        rule = getattr(f, "rule_reference", "")
        
        if "17(5)" in title or "17(5)" in rule or "Blocked" in title:
            if "BLOCKED_ITC" not in defects:
                defects.append("BLOCKED_ITC")
        if "GSTIN" in title:
            if "BAD_GSTIN" not in defects:
                defects.append("BAD_GSTIN")
        if "Place of Supply" in title or "PoS" in title:
            if "POS_ERROR" not in defects:
                defects.append("POS_ERROR")
        if "Tax Calculation" in title or "Calculation" in title:
            if "TAX_MATH" not in defects:
                defects.append("TAX_MATH")
        if "Duplicate" in title:
            if "DUPLICATE" not in defects:
                defects.append("DUPLICATE")
        if "180-Day" in title or "Rule 37" in title:
            if "RULE37" not in defects:
                defects.append("RULE37")
                
    flagged = len(defects) > 0 or res.get("status") != "validated" or res.get("risk") != "low"
    return {"flagged": flagged, "defects": defects}


# ----------------------------------------------------------------------------
# 2. GSTIN helpers (standard mod-36 checksum)
# ----------------------------------------------------------------------------
CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
STATES = {"27": "MH", "29": "KA", "33": "TN", "07": "DL", "24": "GJ", "32": "KL"}


def gstin_check_char(first14: str) -> str:
    total = 0
    for i, ch in enumerate(first14):
        prod = CHARS.index(ch) * (1 if i % 2 == 0 else 2)
        total += prod // 36 + prod % 36
    return CHARS[(36 - total % 36) % 36]


def make_gstin(rng, state_code):
    pan = "".join(rng.choices(string.ascii_uppercase, k=5)) + \
          "".join(rng.choices(string.digits, k=4)) + rng.choice(string.ascii_uppercase)
    first14 = f"{state_code}{pan}1Z"
    return first14 + gstin_check_char(first14)


def corrupt_gstin(g):
    bad = g[:-1] + rng_other_char(g[-1])
    return bad


def rng_other_char(c):
    return CHARS[(CHARS.index(c) + 7) % 36]


# ----------------------------------------------------------------------------
# 3. Synthetic invoice generator
# ----------------------------------------------------------------------------
CLEAN_ITEMS = ["IT consulting services", "Steel rods supply", "Laptop hardware",
               "Office furniture", "Packaging material", "Software licence"]
BLOCKED_ITEMS = ["Motor car purchase", "Outdoor catering services",
                 "Fitness club membership", "Employee personal expenses", "Food and beverages"]
BUYER_STATE = "27"


def build_invoice(rng, n, defect=None, history=None):
    vendor_state = rng.choice(list(STATES))
    gstin = make_gstin(rng, vendor_state)
    taxable = round(rng.uniform(5_000, 500_000), 2)
    rate = rng.choice([5, 12, 18, 28])
    tax = round(taxable * rate / 100, 2)
    intra = vendor_state == BUYER_STATE
    cgst = sgst = igst = 0.0
    if intra:
        cgst = sgst = round(tax / 2, 2)
    else:
        igst = tax
    desc = rng.choice(CLEAN_ITEMS)
    days_unpaid = rng.randint(0, 120)

    if defect == "BLOCKED_ITC":
        desc = rng.choice(BLOCKED_ITEMS)
    elif defect == "BAD_GSTIN":
        gstin = corrupt_gstin(gstin)
    elif defect == "POS_ERROR":           # wrong tax head for the supply type
        if intra:
            cgst = sgst = 0.0; igst = tax
        else:
            igst = 0.0; cgst = sgst = round(tax / 2, 2)
    elif defect == "TAX_MATH":            # total does not add up
        cgst = round(cgst * 1.1 + 1, 2) if intra else cgst
        igst = round(igst * 1.1 + 1, 2) if not intra else igst
    elif defect == "RULE37":
        days_unpaid = rng.randint(181, 400)

    total = round(taxable + cgst + sgst + igst, 2)
    if defect == "TAX_MATH":              # keep total at the *correct* value
        total = round(taxable + tax, 2)

    inv = dict(invoice_no=f"INV-{n:05d}", date="2026-%02d-%02d" % (rng.randint(1, 9), rng.randint(1, 28)),
               vendor_gstin=gstin, buyer_state_code=BUYER_STATE, description=desc,
               taxable=taxable, cgst=cgst, sgst=sgst, igst=igst, total=total,
               paid=days_unpaid == 0, days_unpaid=days_unpaid)
    if defect == "DUPLICATE" and history:
        src = rng.choice(history)
        inv.update(vendor_gstin=src["vendor_gstin"], invoice_no=src["invoice_no"],
                   taxable=src["taxable"], total=src["total"], cgst=src["cgst"],
                   sgst=src["sgst"], igst=src["igst"], date=src["date"])
    return inv


def generate(n, defect_rate, rng):
    invoices, truth = [], []
    for i in range(n):
        defect = rng.choice(DEFECTS) if rng.random() < defect_rate else None
        if defect == "DUPLICATE" and not invoices:
            defect = None
        inv = build_invoice(rng, i + 1, defect, invoices)
        invoices.append(inv)
        truth.append(defect)
    return invoices, truth


# ----------------------------------------------------------------------------
# 4. Metrics
# ----------------------------------------------------------------------------
def safe(a, b):
    return a / b if b else 0.0


def metrics(tp, fp, tn, fn):
    p, r = safe(tp, tp + fp), safe(tp, tp + fn)
    return dict(TP=tp, FP=fp, TN=tn, FN=fn,
                accuracy=safe(tp + tn, tp + tn + fp + fn),
                precision=p, recall=r,
                specificity=safe(tn, tn + fp),
                false_positive_rate=safe(fp, fp + tn),     # FP / (FP + TN)
                f1=safe(2 * p * r, p + r))


def selftest():
    m = metrics(tp=90, fp=2, tn=98, fn=10)
    assert abs(m["precision"] - 90 / 92) < 1e-9
    assert abs(m["recall"] - 0.90) < 1e-9
    assert abs(m["false_positive_rate"] - 2 / 100) < 1e-9
    assert abs(m["f1"] - 2 * (90 / 92) * 0.9 / ((90 / 92) + 0.9)) < 1e-9
    inv, tr = generate(50, 0.4, random.Random(1))
    assert len(inv) == 50 and any(tr)
    g = inv[0]["vendor_gstin"]
    assert gstin_check_char(g[:14]) == g[14] or tr[0] == "BAD_GSTIN"
    print("Selftest passed: metric formulas and generator work.")


# ----------------------------------------------------------------------------
# 5. Runner
# ----------------------------------------------------------------------------
def run(n, defect_rate, seed, outdir):
    rng = random.Random(seed)
    invoices, truth = generate(n, defect_rate, rng)
    os.makedirs(outdir, exist_ok=True)

    preds, lat, seen = [], [], []
    for inv in invoices:
        t0 = time.perf_counter()
        out = audit_invoice(inv, list(seen))
        lat.append((time.perf_counter() - t0) * 1000)
        preds.append(out)
        seen.append(inv)

    tp = fp = tn = fn = 0
    per = {d: [0, 0] for d in DEFECTS}          # [detected, total]
    for t, p in zip(truth, preds):
        actual, flagged = t is not None, bool(p["flagged"])
        tp += actual and flagged; fn += actual and not flagged
        fp += (not actual) and flagged; tn += (not actual) and not flagged
        if t:
            per[t][1] += 1
            per[t][0] += t in p.get("defects", [])

    res = metrics(tp, fp, tn, fn)
    res["n_invoices"] = n; res["seed"] = seed
    res["per_defect_recall"] = {d: dict(detected=a, total=b, recall=safe(a, b)) for d, (a, b) in per.items()}
    res["latency_ms"] = dict(mean=statistics.mean(lat),
                             p95=sorted(lat)[int(0.95 * len(lat)) - 1],
                             throughput_per_sec=1000 / statistics.mean(lat))

    json.dump(invoices, open(f"{outdir}/invoices.json", "w"), indent=1)
    with open(f"{outdir}/ground_truth.csv", "w", newline="") as f:
        w = csv.writer(f); w.writerow(["invoice_no", "defect"])
        for inv, t in zip(invoices, truth):
            w.writerow([inv["invoice_no"], t or "CLEAN"])
    json.dump(res, open(f"{outdir}/results.json", "w"), indent=2)

    print(f"\nInvoices: {n}  (defective: {sum(1 for t in truth if t)}, clean: {sum(1 for t in truth if not t)})")
    print(f"Confusion matrix  TP={tp}  FN={fn}  FP={fp}  TN={tn}")
    for k in ["accuracy", "precision", "recall", "specificity", "false_positive_rate", "f1"]:
        print(f"  {k:<20}{res[k] * 100:6.2f}%")
    print("Per-defect recall:")
    for d, v in res["per_defect_recall"].items():
        print(f"  {d:<12}{v['detected']}/{v['total']}  ({v['recall'] * 100:.1f}%)")
    print(f"Latency: mean {res['latency_ms']['mean']:.2f} ms, p95 {res['latency_ms']['p95']:.2f} ms, "
          f"~{res['latency_ms']['throughput_per_sec']:.0f} invoices/sec")
    print(f"\nSaved to {outdir}/  (results.json, ground_truth.csv, invoices.json)")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("-n", type=int, default=150)
    ap.add_argument("--defect-rate", type=float, default=0.4)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--out", default="eval_output")
    ap.add_argument("--selftest", action="store_true")
    a = ap.parse_args()
    selftest() if a.selftest else run(a.n, a.defect_rate, a.seed, a.out)
