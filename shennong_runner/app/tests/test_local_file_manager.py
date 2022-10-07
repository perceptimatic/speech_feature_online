import pytest
from os import path

from app.analyse import LocalFileManager


@pytest.fixture()
def local_file_manager(tmpdir):
    """We'll patch the instance's temp dir with pytest's"""
    fm = LocalFileManager(path.join(str(tmpdir), "fm-test"))
    return fm
