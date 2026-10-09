"""Build the globe's equirectangular SVG texture from Natural Earth land polygons."""
from __future__ import annotations

import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / "data/raw/natural-earth/ne_10m_land.shp"
OUTPUT = ROOT / "packages/client/public/visual_component/world-land.svg"
WIDTH, HEIGHT = 2048, 1024
SIMPLIFY_DEGREES = 0.035


def simplify_ring(points: list[tuple[float, float]], tolerance: float) -> list[tuple[float, float]]:
    """Ramer-Douglas-Peucker in lon/lat degrees, preserving ring closure."""
    if len(points) <= 4:
        return points
    ring = points[:-1] if points[0] == points[-1] else points
    if len(ring) <= 3:
        return ring
    keep = bytearray(len(ring))
    keep[0] = keep[-1] = 1
    stack = [(0, len(ring) - 1)]
    tolerance_squared = tolerance * tolerance
    while stack:
        first, last = stack.pop()
        ax, ay = ring[first]
        bx, by = ring[last]
        dx, dy = bx - ax, by - ay
        denominator = dx * dx + dy * dy
        farthest_distance = tolerance_squared
        farthest_index = -1
        for index in range(first + 1, last):
            px, py = ring[index]
            if denominator == 0:
                distance = (px - ax) ** 2 + (py - ay) ** 2
            else:
                projection = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / denominator))
                distance = (px - (ax + projection * dx)) ** 2 + (py - (ay + projection * dy)) ** 2
            if distance > farthest_distance:
                farthest_distance, farthest_index = distance, index
        if farthest_index >= 0:
            keep[farthest_index] = 1
            stack.extend(((first, farthest_index), (farthest_index, last)))
    return [point for point, retained in zip(ring, keep) if retained]


def read_land_records(path: Path) -> list[list[list[tuple[float, float]]]]:
    data = path.read_bytes()
    records = []
    offset = 100
    while offset < len(data):
        _, content_words = struct.unpack_from(">2i", data, offset)
        content = memoryview(data)[offset + 8 : offset + 8 + content_words * 2]
        shape_type = struct.unpack_from("<i", content, 0)[0]
        if shape_type != 5:
            raise ValueError(f"Expected Polygon records, got shape type {shape_type}")
        part_count, point_count = struct.unpack_from("<2i", content, 36)
        cursor = 44
        starts = struct.unpack_from(f"<{part_count}i", content, cursor)
        cursor += part_count * 4
        flat_points = struct.unpack_from(f"<{point_count * 2}d", content, cursor)
        points = list(zip(flat_points[::2], flat_points[1::2]))
        ends = (*starts[1:], point_count)
        rings = []
        for start, end in zip(starts, ends):
            ring = simplify_ring(points[start:end], SIMPLIFY_DEGREES)
            if len(ring) >= 3:
                rings.append(ring)
        records.append(rings)
        offset += 8 + content_words * 2
    return records


def project(longitude: float, latitude: float) -> tuple[float, float]:
    x = (longitude + 180.0) / 360.0 * WIDTH
    y = (90.0 - latitude) / 180.0 * HEIGHT
    return x, y


def main() -> None:
    records = read_land_records(SOURCE)
    chunks = [
        '<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="1024" viewBox="0 0 2048 1024">',
        '<metadata>Natural Earth 1:10m Land v5.1.1, public domain. Equirectangular lon/lat texture generated for the Rycorn globe.</metadata>',
        '<defs>',
        '<linearGradient id="ocean" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#082537"/><stop offset="0.5" stop-color="#123b50"/><stop offset="1" stop-color="#082537"/></linearGradient>',
        '<linearGradient id="land" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#a8bba9"/><stop offset="0.5" stop-color="#d7d1b5"/><stop offset="1" stop-color="#9bafa3"/></linearGradient>',
        '</defs>',
        '<rect width="2048" height="1024" fill="url(#ocean)"/>',
    ]
    for rings in records:
        path_data = []
        for ring in rings:
            coords = [project(lon, lat) for lon, lat in ring]
            if not coords:
                continue
            path_data.append(f'M{coords[0][0]:.2f},{coords[0][1]:.2f}')
            path_data.extend(f'L{x:.2f},{y:.2f}' for x, y in coords[1:])
            path_data.append('Z')
        if path_data:
            chunks.append(f'<path d="{"".join(path_data)}" fill="url(#land)" fill-rule="evenodd" stroke="#e6dec3" stroke-opacity="0.5" stroke-width="0.7" stroke-linejoin="round"/>')
    chunks.append('</svg>')
    OUTPUT.write_text('\n'.join(chunks) + '\n')
    print(f"Wrote {OUTPUT} from {SOURCE} ({OUTPUT.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
