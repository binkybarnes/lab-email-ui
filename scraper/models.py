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
    lab_url_uncertain_reason: Optional[str]  # None = certain, string = uncertain with reason

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
