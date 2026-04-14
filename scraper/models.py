from typing import TypedDict, Optional

class Faculty(TypedDict):
    name: str
    department: str
    profile_url: str

class FacultyWithURL(TypedDict):
    name: str
    department: str
    profile_url: str
    lab_url: Optional[str]   # None if not found

class RawMember(TypedDict, total=False):
    name: str
    role: str       # PI | PhD | Postdoc | Masters | Undergrad | Staff
    email: str      # optional
    photo: str      # optional, URL

class RawLab(TypedDict):
    professor_slug: str
    lab_url: str
    lab_name: str
    overview: str
    members: list[RawMember]
