from typing import Dict, List, Optional, Union
from pydantic import BaseModel, EmailStr


class BaseAnalysisConfig(BaseModel):
    frame_shift: float
    frame_length: float
    postprocessors: Optional[List[str]]


class StandardAnalysisConfig(BaseAnalysisConfig):
    window_type: str
    snip_edges: bool


class PKaldiAnalysisConfig(BaseAnalysisConfig):
    min_f0: int
    max_f0: int


class PCrepeAnalysisConfig(BaseAnalysisConfig):
    model_capacity: str


# todo: we'll need our own validator eventually
class JobIn(BaseModel):
    """Fields that must be included in POST request body to start a job"""

    analyses: Dict[
        str, Union[PCrepeAnalysisConfig, PKaldiAnalysisConfig, StandardAnalysisConfig]
    ]
    channel: int
    email: EmailStr
    files: List[str]
    # key should be the analysis name, e.g., 'spectrogram'
    res: str  # ['.npz', '.mat', '.pkl', '.h5f', '.ark', '']


class UserIn(BaseModel):
    """User Schema"""

    password: str
    is_admin: Optional[str]
    email: EmailStr
    full_name: Optional[str] = None
    username: str

    class Config:
        orm_mode = True


class TokenData(BaseModel):
    username: Optional[str] = None
