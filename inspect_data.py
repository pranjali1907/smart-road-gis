import json

d = json.load(open('roads_extracted.json'))

# Show ALL property keys from first feature that has them
all_keys = set()
for f in d['features']:
    all_keys.update(f['properties'].keys())
print(f"All property keys: {sorted(all_keys)}")

# Find features WITH road names
named = [f for f in d['features'] if f['properties'].get('road name')]
print(f"\n=== Features with road name ({len(named)}) ===")
for f in named:
    p = f['properties']
    coords = f['geometry']['coordinates']
    print(f"\n  Name: {p.get('road name')}")
    print(f"  fid: {p.get('fid')}")
    print(f"  sr.no: {p.get('sr.no')}")
    print(f"  road type: {p.get('road type')}")
    print(f"  sur materi: {p.get('sur materi')}")
    print(f"  zone: {p.get('zone')}")
    print(f"  ward no: {p.get('ward no')}")
    print(f"  total leng: {p.get('total leng')}")
    print(f"  width: {p.get('width')}")
    print(f"  from china: {p.get('from china')}")
    print(f"  to chinage: {p.get('to chinage')}")
    print(f"  contractor: {p.get('contractor')}")
    print(f"  y construc: {p.get('y construc')}")
    print(f"  la repair: {p.get('la repair')}")
    print(f"  drainage ty: {p.get('drainage ty')}")
    print(f"  remark: {p.get('remark')}")
    print(f"  Points: {len(coords)}, first: {coords[0]}, last: {coords[-1]}")

# Stats on point counts
point_counts = [len(f['geometry']['coordinates']) for f in d['features']]
print(f"\n=== Geometry stats ===")
print(f"  Min points: {min(point_counts)}")
print(f"  Max points: {max(point_counts)}")
print(f"  Avg points: {sum(point_counts)/len(point_counts):.1f}")
print(f"  Total road segments: {len(d['features'])}")

# Count features by number of non-null props
has_data = [f for f in d['features'] if len([v for v in f['properties'].values() if v is not None]) > 2]
print(f"  Features with >2 non-null properties: {len(has_data)}")
