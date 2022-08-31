import pytest
from os import path
from pathlib import Path
from unittest.mock import MagicMock

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


# commenting these out for now, while we experiment with leaving audio files in s3 for reruns
#
# def test_remove_temps(local_file_manager: LocalFileManager, tmp_path):
#     """Test that directory is registered and path is returned
#     for passing to Shennong but neither is created
#     """
#     # tmp processing file
#     file = tmp_path / "tester.tst"
#     file.touch()
#     # tmp result file
#     result_path = Path(local_file_manager.get_tmp_result_path(tmp_path, ".tst"))
#     result_path.touch()
#     local_file_manager.remove_temps()
#     assert not path.exists(str(result_path))


# def test_context_manager(local_file_manager):
#     """Test that remove_temps is called on __exit__"""
#     local_file_manager.remove_temps = MagicMock()
#     with pytest.raises(RuntimeError):
#         with local_file_manager:
#             raise RuntimeError

#     with local_file_manager:
#         pass

#     assert local_file_manager.remove_temps.call_count == 2
