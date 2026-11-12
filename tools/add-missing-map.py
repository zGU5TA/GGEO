#!/usr/bin/env python3
"""Acrescenta ao data/world-map.json os países/territórios que faltavam.

Fonte: Natural Earth 1:50m (ne_50m_admin_0_countries.geojson, domínio público).
Uso: python3 tools/add-missing-map.py <caminho do ne_50m_admin_0_countries.geojson>

- jogáveis:  Kosovo (KOS), Taiwan (TWN), Palestina (PSE), Saara Ocidental (ESH), Vaticano (VAT)
- fundidos:  Somalilândia -> SOM, Chipre do Norte -> CYP, Hong Kong e Macau -> CHN, Åland -> FIN
- neutros:   o resto (Groenlândia, Porto Rico, Malvinas...) vira terra neutra "_ISO3"
             (aparece no globo, mas não é país jogável)
Os contornos são simplificados (Douglas-Peucker) e arredondados a 2 casas,
com o sentido horário que o d3 espera. É idempotente: ids já presentes são pulados.
"""
import json, math, sys

PLAYABLE = {'KOS': 'KOS', 'TWN': 'TWN', 'PSX': 'PSE', 'SAH': 'ESH', 'VAT': 'VAT'}
MERGED = {'SOL': 'SOM', 'CYN': 'CYP', 'HKG': 'CHN', 'MAC': 'CHN', 'ALD': 'FIN'}
SKIP = {'ATA', 'KAS'}
TOLERANCE = 0.035  # graus


def dp(points, tol):
    if len(points) < 3:
        return points
    (x1, y1), (x2, y2) = points[0], points[-1]
    dx, dy = x2 - x1, y2 - y1
    norm = math.hypot(dx, dy)
    best, index = -1, 0
    for i in range(1, len(points) - 1):
        x, y = points[i]
        d = (math.hypot(x - x1, y - y1) if norm == 0
             else abs(dy * x - dx * y + x2 * y1 - y2 * x1) / norm)
        if d > best:
            best, index = d, i
    if best <= tol:
        return [points[0], points[-1]]
    return dp(points[:index + 1], tol)[:-1] + dp(points[index:], tol)


def area(ring):
    return sum(ring[i][0] * ring[(i + 1) % len(ring)][1] - ring[(i + 1) % len(ring)][0] * ring[i][1]
               for i in range(len(ring))) / 2


def simplify(geometry, tiny=False):
    if tiny:      # Vaticano: pequeno demais para simplificar (0,44 km²)
        ring = [[round(x, 3), round(y, 3)] for x, y in geometry['coordinates'][0]]
        if area(ring) > 0:
            ring.reverse()
        return [[ring]]
    polygons = geometry['coordinates'] if geometry['type'] == 'MultiPolygon' else [geometry['coordinates']]
    out = []
    for polygon in polygons:
        ring = [tuple(p[:2]) for p in polygon[0]]
        ring = dp(ring[:-1], TOLERANCE) + [ring[0]]
        ring = [[round(x, 2), round(y, 2)] for x, y in ring]
        if len(ring) < 4 or abs(area(ring)) < 1e-4:
            continue
        if area(ring) > 0:       # d3 quer o exterior no sentido horário
            ring.reverse()
        out.append([ring])
    return out


def main(ne_path):
    ne = json.load(open(ne_path))
    path = 'data/world-map.json'
    world = json.load(open(path))
    have = {f['id'] for f in world['features']}
    added = []
    for feature in ne['features']:
        props = feature['properties']
        code = props['ADM0_A3']
        if code in SKIP:
            continue
        if code in PLAYABLE:
            target = PLAYABLE[code]
        elif code in MERGED:
            target = MERGED[code]
        else:
            iso = props['ISO_A3'] if props['ISO_A3'] != '-99' else code
            if (iso if iso != 'SDS' else 'SSD') in have:
                continue
            target = '_' + code
        if code in PLAYABLE and target in have:
            continue
        if target in have and code not in MERGED:
            continue
        # fundidos: só entram uma vez (marcamos por ADM0 no id da feature extra)
        polygons = simplify(feature['geometry'], tiny=(code == 'VAT'))
        if not polygons:
            continue
        world['features'].append({
            'type': 'Feature', 'id': target, 'properties': {},
            'geometry': {'type': 'MultiPolygon', 'coordinates': polygons}})
        added.append((code, target))
    json.dump(world, open(path, 'w'), separators=(',', ':'))
    print(len(added), 'features adicionadas:', added)


main(sys.argv[1])
