"""Convert the MIT-licensed Staunton STL set into one optimized GLB.

Each piece is decimated, reoriented to Y-up with its base at y=0 and centred on
the XZ origin, then scaled by a SINGLE factor (so relative piece heights are
preserved) and written as a node named K/Q/R/B/N/P in a single GLB scene.
"""
import numpy as np
import trimesh
from trimesh import Scene

SRC = "/tmp/Staunton-Pieces/Source/Staunton"
OUT = "/home/user/the-royal-study/public/models/pieces.glb"

# piece -> (file, target face count after decimation)
PIECES = {
    "K": ("King/King.STL", 9000),
    "Q": ("Queen/Queen.STL", 9000),
    "R": ("Rook/Rook.STL", 5500),
    "B": ("Bishop/Bishop.STL", 6500),
    "N": ("Knight/Knight.STL", 15000),
    "P": ("Pawn/Pawn.STL", 4500),
}

# Target KING height in board units (square = 1.0). Others scale to match.
KING_HEIGHT = 1.5

def load_piece(path, faces):
    m = trimesh.load(path, force="mesh")
    if len(m.faces) > faces:
        try:
            m = m.simplify_quadric_decimation(face_count=faces)
        except Exception as e:
            print("  decimate fallback:", e)
    m.merge_vertices()
    return m

# These STLs are already Y-up (height along Y), so no reorientation needed.
meshes = {}
for key, (rel, faces) in PIECES.items():
    m = load_piece(f"{SRC}/{rel}", faces)
    meshes[key] = m
    print(f"{key}: {len(m.faces)} faces after decimate")

# Single scale factor from the king's height (Y extent).
king_height = meshes["K"].bounds[1][1] - meshes["K"].bounds[0][1]
scale = KING_HEIGHT / king_height
print("global scale:", scale)

scene = Scene()
for key, m in meshes.items():
    m.apply_scale(scale)
    # Drop to base y=0, centre on XZ.
    lo, hi = m.bounds
    m.apply_translation([-(lo[0] + hi[0]) / 2, -lo[1], -(lo[2] + hi[2]) / 2])
    m.visual = trimesh.visual.ColorVisuals(m, vertex_colors=[235, 226, 200, 255])
    scene.add_geometry(m, node_name=key, geom_name=key)

import os
os.makedirs(os.path.dirname(OUT), exist_ok=True)
scene.export(OUT)
print("wrote", OUT, os.path.getsize(OUT), "bytes")
# Report node names + heights for the loader.
for key, m in meshes.items():
    print(f"  {key} height={m.bounds[1][1]-m.bounds[0][1]:.3f}")
