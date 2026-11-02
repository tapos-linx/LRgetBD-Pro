import csv
import json
import os

def generate_room_json(csv_filepath, json_filepath):
    if not os.path.exists(csv_filepath):
        print(f"❌ Error: Could not find '{csv_filepath}'")
        return

    data = {
        "divisions": [],
        "districts": [],
        "upazilas": [],
        "mouzas": []
    }

    div_tracker = {}
    dist_tracker = {}
    upa_tracker = {}
    mouza_tracker = {}

    div_id = 1
    dist_id = 1
    upa_id = 1
    mouza_id = 1

    print("⏳ Processing CSV data...")

    with open(csv_filepath, mode='r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        
        for row_num, row in enumerate(reader, start=2):
            try:
                div_en = row.get('division_en', '').strip()
                div_bn = row.get('division_bn', '').strip()
                
                dist_en = row.get('district_en', '').strip()
                dist_bn = row.get('district_bn', '').strip()
                
                upa_en = row.get('upazila_en', '').strip()
                upa_bn = row.get('upazila_bn', '').strip()
                
                mouza_en = row.get('mouza_en', '').strip()
                mouza_bn = row.get('mouza_bn', '').strip()
                jl_no = str(row.get('jl_no', '')).strip()

                if not div_en:
                    continue

                if div_en not in div_tracker:
                    div_tracker[div_en] = div_id
                    data["divisions"].append({
                        "id": div_id,
                        "nameEn": div_en,
                        "nameBn": div_bn
                    })
                    div_id += 1
                current_div_id = div_tracker[div_en]

                dist_key = f"{current_div_id}_{dist_en}"
                if dist_en and dist_key not in dist_tracker:
                    dist_tracker[dist_key] = dist_id
                    data["districts"].append({
                        "id": dist_id,
                        "divisionId": current_div_id,
                        "nameEn": dist_en,
                        "nameBn": dist_bn
                    })
                    dist_id += 1
                current_dist_id = dist_tracker.get(dist_key)

                if current_dist_id and upa_en:
                    upa_key = f"{current_dist_id}_{upa_en}"
                    if upa_key not in upa_tracker:
                        upa_tracker[upa_key] = upa_id
                        data["upazilas"].append({
                            "id": upa_id,
                            "districtId": current_dist_id,
                            "nameEn": upa_en,
                            "nameBn": upa_bn
                        })
                        upa_id += 1
                    current_upa_id = upa_tracker.get(upa_key)

                    if current_upa_id and mouza_en:
                        mouza_key = f"{current_upa_id}_{mouza_en}_{jl_no}"
                        if mouza_key not in mouza_tracker:
                            mouza_tracker[mouza_key] = mouza_id
                            data["mouzas"].append({
                                "id": mouza_id,
                                "upazilaId": current_upa_id,
                                "nameEn": mouza_en,
                                "nameBn": mouza_bn,
                                "jlNo": jl_no
                            })
                            mouza_id += 1

            except Exception as e:
                print(f"⚠️ Error processing row {row_num}: {e}")

    with open(json_filepath, 'w', encoding='utf-8') as jf:
        json.dump(data, jf, ensure_ascii=False, indent=2)
        
    print(f"\n✅ Successfully generated Room Database JSON at: {json_filepath}")
    print(f"📊 Stats: Divisions: {len(data['divisions'])}, Districts: {len(data['districts'])}, Upazilas: {len(data['upazilas'])}, Mouzas: {len(data['mouzas'])}")

if __name__ == "__main__":
    INPUT_CSV = "bangladesh_locations_raw.csv" 
    OUTPUT_JSON = "bd_locations.json"
    generate_room_json(INPUT_CSV, OUTPUT_JSON)
