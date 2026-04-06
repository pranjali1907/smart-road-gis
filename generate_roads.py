import json

d = json.load(open('roads_extracted.json'))

roads = []
for i, feat in enumerate(d['features']):
    p = feat['properties']
    coords = feat['geometry']['coordinates']
    
    fid = p.get('fid', i + 1)
    sr_no = p.get('sr.no', i + 1)
    road_id = f"RD-{str(i+1).zfill(4)}"
    
    road_name = p.get('road name') or ''
    road_type = p.get('road type') or ''
    sur_mat = p.get('sur materi') or ''
    zone = p.get('zone')
    ward_no = p.get('ward no')
    total_leng = p.get('total leng')
    width = p.get('width')
    from_ch = p.get('from china')
    to_ch = p.get('to chinage')
    contractor = p.get('contractor') or ''
    y_construc = p.get('y construc')
    la_repair = p.get('la repair')
    drainage = p.get('drinage ty') or ''
    maint = p.get('maintainan') or ''
    remark = p.get('remark') or ''
    
    road_obj = {
        "id": road_id,
        "srNo": sr_no,
        "fid": fid,
        "name": road_name,
        "fromChainage": from_ch if from_ch is not None else 0,
        "toChainage": to_ch if to_ch is not None else 0,
        "length": total_leng if total_leng is not None else 0,
        "width": width if width is not None else 0,
        "roadType": road_type,
        "contractor": contractor,
        "constructionDate": str(y_construc) if y_construc else "",
        "maintenanceDate": str(maint) if maint else "",
        "lastRepair": str(la_repair) if la_repair else "",
        "surfaceMaterial": sur_mat,
        "drainageType": drainage,
        "zone": str(zone) if zone is not None else "",
        "wardNo": str(ward_no) if ward_no is not None else "",
        "status": "Good",
        "remarks": remark,
        "geometry": {
            "type": "LineString",
            "coordinates": coords
        }
    }
    roads.append(road_obj)

# Generate the JS module
js_lines = []
js_lines.append("// Auto-generated from GeoPackage: attribute_table_Gpk.gpkg")
js_lines.append(f"// Total roads: {len(roads)}")
js_lines.append(f"// Generated at: {__import__('datetime').datetime.now().isoformat()}")
js_lines.append("")
js_lines.append(f"export const INITIAL_ROADS = {json.dumps(roads, indent=2)};")
js_lines.append("")
js_lines.append('export const ROAD_TYPES = ["NH", "SH", "MDR", "ODR", "Village", "concreat", "earthen", ""];')
js_lines.append('export const SURFACE_MATERIALS = ["Asphalt", "Concrete", "Gravel", "Earthen", "WBM", "rigid", ""];')
js_lines.append('export const DRAINAGE_TYPES = ["Open", "Closed", "None", "Under", "under", ""];')
js_lines.append('export const ROAD_STATUSES = ["Good", "Fair", "Poor", "Under Construction"];')
js_lines.append("export const ZONES = [")
# Collect unique zones
zones = sorted(set(str(r['zone']) for r in roads if r['zone']))
for z in zones:
    js_lines.append(f'  "{z}",')
js_lines.append("];")
js_lines.append("export const WARDS = [")
wards = sorted(set(str(r['wardNo']) for r in roads if r['wardNo']), key=lambda x: int(x) if x.isdigit() else 999)
for w in wards:
    js_lines.append(f'  "{w}",')
js_lines.append("];")
js_lines.append("")
js_lines.append("// Color mapping for road types")
js_lines.append("export const ROAD_TYPE_COLORS = {")
js_lines.append('  NH: "#ef4444",')
js_lines.append('  SH: "#f59e0b",')
js_lines.append('  MDR: "#3b82f6",')
js_lines.append('  ODR: "#10b981",')
js_lines.append('  Village: "#8b5cf6",')
js_lines.append('  concreat: "#06b6d4",')
js_lines.append('  earthen: "#a78bfa",')
js_lines.append('  "": "#94a3b8",')
js_lines.append("};")
js_lines.append("")
js_lines.append("export const STATUS_COLORS = {")
js_lines.append('  Good: "#10b981",')
js_lines.append('  Fair: "#f59e0b",')
js_lines.append('  Poor: "#ef4444",')
js_lines.append('  "Under Construction": "#6366f1",')
js_lines.append("};")

output = "\n".join(js_lines) + "\n"

out_path = r'C:\Users\pranj\.gemini\antigravity\scratch\smart-road-gis\src\data\sampleRoads.js'
with open(out_path, 'w', encoding='utf-8') as f:
    f.write(output)

print(f"Generated {len(roads)} roads to sampleRoads.js")
print(f"File size: {len(output)} bytes")
