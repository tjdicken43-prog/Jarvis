# Shrink the Allen brain GLB (HuBMAP CCF, CC BY 4.0) to a small JS module: vertex-clustered meshes, int16 positions, base64.
import json, struct, sys, base64, numpy as np
src, out, G = sys.argv[1], sys.argv[2], int(sys.argv[3])
b = open(src, 'rb').read(); n = struct.unpack('<I', b[12:16])[0]; J = json.loads(b[20:20 + n]); B = b[20 + n + 8:]
def acc(i):
    A = J['accessors'][i]; v = J['bufferViews'][A['bufferView']]; off = v.get('byteOffset', 0) + A.get('byteOffset', 0)
    dt = {5126: np.float32, 5125: np.uint32, 5123: np.uint16}[A['componentType']]; c = {'SCALAR': 1, 'VEC3': 3}[A['type']]
    return np.frombuffer(B, dt, A['count'] * c, off).reshape(-1, c) if c > 1 else np.frombuffer(B, dt, A['count'], off)
P = [(m['name'], acc(m['primitives'][0]['attributes']['POSITION']), acc(m['primitives'][0]['indices'])) for m in J['meshes']]
allp = np.concatenate([p for _, p, _ in P]); lo, hi = allp.min(0), allp.max(0); h = (hi - lo).max() / G
res = []; tv = tt = 0
for name, p, ix in P:
    cell = np.floor((p - lo) / h).astype(np.int64); key = (cell[:, 0] * G * 4 + cell[:, 1]) * G * 4 + cell[:, 2]
    uk, inv = np.unique(key, return_inverse=True); cnt = np.bincount(inv); nv = np.zeros((len(uk), 3))
    for d in range(3): nv[:, d] = np.bincount(inv, p[:, d]) / cnt
    t = inv[ix.astype(np.int64)].reshape(-1, 3); t = t[(t[:, 0] != t[:, 1]) & (t[:, 1] != t[:, 2]) & (t[:, 0] != t[:, 2])]
    if len(t) == 0: continue
    q = np.round((nv - lo) / (hi - lo) * 65535 - 32768).astype(np.int16)
    it = t.astype(np.uint16 if len(nv) < 65536 else np.uint32)
    res.append({"n": name, "p": base64.b64encode(q.tobytes()).decode(), "i": base64.b64encode(it.tobytes()).decode(), "w": it.itemsize}); tv += len(nv); tt += len(t)
js = "// Allen human brain atlas meshes (HuBMAP CCF v1.2, CC BY 4.0), shrunk by hud/tools: int16 positions in [lo, hi]\nexport const BRAIN_MESH = " + json.dumps({"lo": lo.tolist(), "hi": hi.tolist(), "m": res}) + ";\n"
open(out, 'w').write(js); print(f"{tv} verts {tt} tris {len(js)/1e6:.2f} MB")
