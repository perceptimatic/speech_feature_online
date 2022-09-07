import pytest
from os import path

from app.analyse import LocalFileManager


@pytest.fixture()
def local_file_manager(tmpdir):
    """We'll patch the instance's temp dir with pytest's"""
    fm = LocalFileManager(path.join(str(tmpdir), "fm-test"))
    return fm


def test_register_result_dir(local_file_manager: LocalFileManager):
    """Test that the directory path is named but not created"""
    result_dir = local_file_manager.get_tmp_result_dir_name("foobar")
    assert local_file_manager.tmp_dir in path.dirname(result_dir)
    assert not path.exists(result_dir)


def test_register_result_path(local_file_manager: LocalFileManager):
    """Test that directory is registered and path is returned
    for passing to Shennong but neither is created
    """
    result_path = local_file_manager.get_tmp_result_path("foobar", "abc")
    assert local_file_manager.tmp_dir in path.dirname(result_path)
    assert "foobar" in result_path
    assert not path.exists(result_path)
