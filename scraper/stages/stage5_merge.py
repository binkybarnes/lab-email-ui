import json
import re
from models import RawLab


def make_slug(name: str) -> str:
    slug = name.lower()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug.strip())
    return slug


def build_member(raw: dict) -> dict:
    m = {
        "id": make_slug(raw["name"]),
        "name": raw["name"],
        "role": raw["role"],
    }
    if raw.get("email"):
        m["email"] = raw["email"]
    if raw.get("photo"):
        m["photo"] = raw["photo"]
    return m


def build_lab(raw: RawLab, department: str = "") -> dict:
    return {
        "id": make_slug(raw["lab_name"]),
        "name": raw["lab_name"],
        "department": department,
        "website": raw["lab_url"],
        "overview": raw["overview"],
        "members": [build_member(m) for m in raw["members"]],
    }


def build_output(raw_labs: list[RawLab], faculty_data: list[dict]) -> dict:
    # Map professor_slug to department
    slug_to_dept = {
        make_slug(f["name"]): f["department"]
        for f in faculty_data
    }
    
    # Group labs by department
    dept_map = {}
    for r in raw_labs:
        if not r.get("lab_name"):
            continue
            
        dept_name = slug_to_dept.get(r["professor_slug"], "Unknown")
        dept_id = make_slug(dept_name)
        
        if dept_id not in dept_map:
            dept_map[dept_id] = {
                "id": dept_id,
                "name": dept_name,
                "labs": []
            }
        dept_map[dept_id]["labs"].append(build_lab(r, dept_name))
        
    return {
        "departments": list(dept_map.values())
    }


async def run() -> None:
    from config import LABS_RAW_FILE, FACULTY_URLS_FILE, LABS_OUTPUT_FILE
    from verify import confirm

    print("Stage 5: Merging to final labs.json...")
    raw_labs: list[RawLab] = json.loads(LABS_RAW_FILE.read_text())
    faculty_data: list[dict] = json.loads(FACULTY_URLS_FILE.read_text())

    # Fill in lab_url from faculty_with_urls.json (stage 4 leaves it blank)
    url_map = {
        make_slug(f["name"]): f["lab_url"]
        for f in faculty_data
        if f.get("lab_url")
    }
    for lab in raw_labs:
        if not lab.get("lab_url"):
            lab["lab_url"] = url_map.get(lab["professor_slug"], "")

    output = build_output(raw_labs, faculty_data)
    
    total_labs = sum(len(d["labs"]) for d in output["departments"])
    total_members = sum(
        sum(len(l["members"]) for l in d["labs"])
        for d in output["departments"]
    )
    zero_member_labs = [
        l["name"] 
        for d in output["departments"]
        for l in d["labs"]
        if len(l["members"]) == 0
    ]

    print(f"\nTotal labs: {total_labs}")
    print(f"Total members: {total_members}")
    if zero_member_labs:
        print(f"\n⚠️  Labs with 0 members ({len(zero_member_labs)}) — extraction may have failed:")
        for name in zero_member_labs[:10]:
            print(f"  {name}")

    if not confirm(f"Write final labs.json with {total_labs} labs and {total_members} members?"):
        print("Aborted.")
        return

    LABS_OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    LABS_OUTPUT_FILE.write_text(json.dumps(output, indent=2))
    print(f"Saved to {LABS_OUTPUT_FILE}")
    print(f"\nTo use in the UI: cp {LABS_OUTPUT_FILE} ../src/data/labs.json")
