import sqlite3
import struct
import json
import sys

GPKG_PATH = r'C:\Users\pranj\Downloads\attribute_table_Gpk.gpkg'

def parse_gpkg_geom(blob):
    """Parse a GeoPackage geometry blob (standard header + WKB)"""
    if not blob or len(blob) < 8:
        return None
    
    # GeoPackage binary header
    # Bytes 0-1: magic 'GP'
    # Byte 2: version
    # Byte 3: flags
    magic = blob[0:2]
    if magic == b'GP':
        flags = blob[3]
        envelope_type = (flags >> 1) & 0x07
        byte_order = flags & 0x01
        
        # Calculate envelope size
        env_sizes = {0: 0, 1: 32, 2: 48, 3: 48, 4: 64}
        env_size = env_sizes.get(envelope_type, 0)
        
        # SRS ID is at bytes 4-7
        header_size = 8 + env_size
        wkb_data = blob[header_size:]
    else:
        # Try raw WKB
        wkb_data = blob
    
    return parse_wkb_linestring(wkb_data)

def parse_wkb_linestring(data):
    """Parse WKB LineString geometry"""
    if not data or len(data) < 5:
        return None
    
    byte_order = data[0]  # 0=big, 1=little
    fmt = '<' if byte_order == 1 else '>'
    
    geom_type = struct.unpack(fmt + 'I', data[1:5])[0]
    
    # Handle multi-linestring (type 5)
    if geom_type == 5:
        num_geoms = struct.unpack(fmt + 'I', data[5:9])[0]
        # Just parse the first linestring
        return parse_wkb_linestring(data[9:])
    
    # LineString = type 2
    if geom_type != 2:
        # Try to handle as a simple linestring anyway
        pass
    
    offset = 5
    num_points = struct.unpack(fmt + 'I', data[offset:offset+4])[0]
    offset += 4
    
    coords = []
    for _ in range(num_points):
        if offset + 16 > len(data):
            break
        x, y = struct.unpack(fmt + 'dd', data[offset:offset+16])
        coords.append([round(x, 6), round(y, 6)])
        offset += 16
    
    return coords

def main():
    conn = sqlite3.connect(GPKG_PATH)
    cursor = conn.cursor()
    
    # List tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [r[0] for r in cursor.fetchall()]
    print(f"Tables: {tables}", file=sys.stderr)
    
    # Find the right table - look for geometry content tables
    cursor.execute("SELECT table_name, column_name FROM gpkg_geometry_columns")
    geom_tables = cursor.fetchall()
    print(f"Geometry tables: {geom_tables}", file=sys.stderr)
    
    if not geom_tables:
        print("No geometry tables found!", file=sys.stderr)
        sys.exit(1)
    
    table_name = geom_tables[0][0]
    geom_col = geom_tables[0][1]
    
    # Get column names
    cursor.execute(f"PRAGMA table_info({table_name})")
    columns = [r[1] for r in cursor.fetchall()]
    print(f"Columns: {columns}", file=sys.stderr)
    
    # Get all rows
    cursor.execute(f"SELECT * FROM {table_name}")
    rows = cursor.fetchall()
    print(f"Found {len(rows)} rows", file=sys.stderr)
    
    # Find geometry column index
    geom_idx = columns.index(geom_col)
    
    # Build GeoJSON features
    features = []
    for row in rows:
        props = {}
        for i, col in enumerate(columns):
            if i == geom_idx:
                continue
            val = row[i]
            if val is not None:
                props[col] = val
        
        geom_blob = row[geom_idx]
        coords = parse_gpkg_geom(geom_blob)
        
        if coords and len(coords) >= 2:
            feature = {
                "type": "Feature",
                "properties": props,
                "geometry": {
                    "type": "LineString",
                    "coordinates": coords
                }
            }
            features.append(feature)
    
    geojson = {
        "type": "FeatureCollection",
        "features": features
    }
    
    # Write to file
    output_path = r'C:\Users\pranj\.gemini\antigravity\scratch\smart-road-gis\roads_extracted.json'
    with open(output_path, 'w') as f:
        json.dump(geojson, f, indent=2)
    
    print(f"Exported {len(features)} features to {output_path}", file=sys.stderr)
    
    # Also print first 3 features for preview
    for feat in features[:3]:
        props = feat['properties']
        coords = feat['geometry']['coordinates']
        print(f"  Road: {props.get('road_name', props.get('name', 'unnamed'))} | "
              f"Points: {len(coords)} | "
              f"First: {coords[0]} | Last: {coords[-1]}", file=sys.stderr)
    
    conn.close()

if __name__ == '__main__':
    main()
